/**
 * payhip-get-plans.js
 * Gets pricing_plan IDs by visiting each product page and intercepting
 * the checkout API call that fires when "Buy Now" is clicked.
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const fs   = require('fs');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');
const LINKS_FILE  = path.join(SCRIPTS_DIR, 'links.txt');
const OUTPUT_FILE = path.join(SCRIPTS_DIR, 'checkout-links.txt');

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseLinks() {
  return fs.readFileSync(LINKS_FILE, 'utf8')
    .split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => {
      const m = l.match(/^(.+?)\s*\|\s*(https:\/\/payhip\.com\/b\/\S+)$/);
      return m ? { name: m[1].trim(), url: m[2].trim() } : null;
    }).filter(Boolean);
}

async function getPlan(page, productUrl) {
  const key = productUrl.split('/b/')[1];
  const reqLog  = [];
  const respLog = [];

  const onReq = req => {
    const u = req.url();
    if (!u.includes('payhip.com')) return;
    const body = req.postData() || '';
    reqLog.push({ method: req.method(), url: u, body: body.slice(0, 800) });
  };

  const onResp = async res => {
    const u = res.url();
    if (!u.includes('payhip.com')) return;
    try {
      const ct = res.headers()['content-type'] || '';
      // Capture JSON and small HTML/JS that might carry plan IDs
      if (ct.includes('json') || ct.includes('javascript') || (ct.includes('html') && u.includes('checkout'))) {
        const text = await res.text().catch(() => '');
        if (text.length < 80000) respLog.push({ url: u, ct, body: text });
      }
    } catch {}
  };

  page.on('request',  onReq);
  page.on('response', onResp);

  try {
    // ── 1. Load product page ─────────────────────────────────────────────────
    await page.goto(productUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(1500);

    // ── 2. Mine page source before any click ────────────────────────────────
    const fromSource = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const res  = {};

      // Any order URL with pricing_plan already embedded
      const orderUrls = [...html.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>\\]+/g)]
        .map(m => m[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\/g, ''));
      const withPlan = orderUrls.filter(u => u.includes('pricing_plan'));
      if (withPlan.length) res.orderUrls = withPlan;

      // pricing_plan values anywhere in HTML
      const planMatches = [...html.matchAll(/pricing_plan[=_"':\s\\]+([A-Z0-9]{6,14})/gi)].map(m => m[1]);
      if (planMatches.length) res.planIds = [...new Set(planMatches)];

      // data-pricing-plan attributes
      const planElems = [...document.querySelectorAll('[data-pricing-plan],[data-plan-id],[data-checkout-plan]')]
        .map(e => e.dataset.pricingPlan || e.dataset.planId || e.dataset.checkoutPlan)
        .filter(Boolean);
      if (planElems.length) res.planAttrs = planElems;

      // Inline script blocks containing the product key and pricing_plan
      const scriptPlan = [...document.querySelectorAll('script:not([src])')]
        .map(s => s.textContent)
        .flatMap(t => [...t.matchAll(/pricing_plan['":\s=\\]+['"]([A-Z0-9]{6,14})['"]/gi)].map(m => m[1]));
      if (scriptPlan.length) res.scriptPlanIds = [...new Set(scriptPlan)];

      // What buy-related buttons exist?
      const buyBtns = [...document.querySelectorAll('button,a,[role="button"]')]
        .filter(el => {
          const t = (el.textContent || '').trim().toLowerCase();
          const c = (el.className || '').toLowerCase();
          const r = el.getBoundingClientRect();
          return r.width > 0 &&
            !t.includes('wishlist') && !c.includes('wishlist') &&
            (t === 'buy now' || t === 'add to cart' || t === 'get now' || t === 'buy' ||
             c.includes('add-to-cart') || c.includes('buy-now') || c.includes('buy-button') ||
             c.includes('js-buy') || c.includes('checkout'));
        })
        .map(el => ({
          tag: el.tagName, text: el.textContent.trim().slice(0, 40),
          cls: el.className.slice(0, 80), ds: JSON.stringify(el.dataset).slice(0, 200),
          href: el.href || null
        }));
      res.buyBtns = buyBtns;

      return res;
    });

    log(`  source: ${JSON.stringify(fromSource).slice(0, 600)}`);

    if (fromSource.orderUrls?.length) {
      log(`  ✓ order URL in source: ${fromSource.orderUrls[0]}`);
      return fromSource.orderUrls[0];
    }
    if (fromSource.planIds?.length) {
      const u = `https://payhip.com/order?link=${key}&pricing_plan=${fromSource.planIds[0]}`;
      log(`  ✓ plan in source HTML: ${u}`);
      return u;
    }
    if (fromSource.planAttrs?.length) {
      const u = `https://payhip.com/order?link=${key}&pricing_plan=${fromSource.planAttrs[0]}`;
      log(`  ✓ plan in data-attr: ${u}`);
      return u;
    }
    if (fromSource.scriptPlanIds?.length) {
      const u = `https://payhip.com/order?link=${key}&pricing_plan=${fromSource.scriptPlanIds[0]}`;
      log(`  ✓ plan in script: ${u}`);
      return u;
    }

    // ── 3. Click the actual "Buy Now" button (payhip-buy-button) ────────────
    log(`  buy buttons: ${JSON.stringify(fromSource.buyBtns?.map(b => b.text + '|' + b.cls.slice(0,40)) || [])}`);

    // Set up navigation capture BEFORE clicking
    let navUrl = null;
    const navHandler = frame => {
      if (frame === page.mainFrame()) {
        const u = frame.url();
        if (u.includes('/order') || u.includes('/checkout')) navUrl = u;
      }
    };
    page.on('framenavigated', navHandler);

    const clicked = await page.evaluate(() => {
      // Priority 1: payhip-buy-button (the "Buy Now" that triggers checkout)
      let btn = document.querySelector('button.payhip-buy-button, .payhip-buy-button');
      if (!btn) {
        // Priority 2: button whose visible text is exactly "Buy Now"
        btn = [...document.querySelectorAll('button')].find(b => {
          const t = b.textContent.trim().toLowerCase();
          const r = b.getBoundingClientRect();
          return r.width > 0 && (t === 'buy now' || t === 'buy');
        });
      }
      if (!btn) return null;
      btn.click();
      return { text: btn.textContent.trim().slice(0, 50), cls: btn.className.slice(0, 80) };
    });
    log(`  clicked: ${JSON.stringify(clicked)}`);

    // Wait for navigation or Ajax (whichever comes first)
    await sleep(4000);
    page.off('framenavigated', navHandler);

    // If page navigated to order URL, capture it
    const currentUrl = page.url();
    if (currentUrl.includes('/order') || currentUrl.includes('/checkout')) {
      log(`  ✓ Page navigated to: ${currentUrl}`);
      return currentUrl;
    }
    if (navUrl) {
      log(`  ✓ Frame nav to: ${navUrl}`);
      return navUrl;
    }

    // ── 4. Wait for checkout modal / network activity ────────────────────────
    await sleep(4000);

    // ── 5. Check intercepted JSON responses ─────────────────────────────────
    for (const r of respLog) {
      const body = r.body;
      if (!body.includes('pricing_plan') && !body.includes('plan_id') && !body.includes('order?link=')) continue;
      log(`  JSON from ${r.url.slice(0, 80)}: ${body.slice(0, 300)}`);

      const orderMatch = body.match(/https:\/\/payhip\.com\/order\?[^"'\s\\]+pricing_plan=[A-Z0-9]+/i);
      if (orderMatch) {
        const u = orderMatch[0].replace(/&amp;/g,'&').replace(/\\u0026/g,'&').replace(/\\/g,'');
        log(`  ✓ order URL in response: ${u}`);
        return u;
      }
      const planMatch = body.match(/pricing_plan['":\s=\\]+['"]([A-Z0-9]{6,14})['"]/i);
      if (planMatch) {
        const u = `https://payhip.com/order?link=${key}&pricing_plan=${planMatch[1]}`;
        log(`  ✓ plan in response: ${u}`);
        return u;
      }
    }

    // ── 6. Check POST request bodies ────────────────────────────────────────
    for (const r of reqLog) {
      if (!r.body) continue;
      if (r.body.includes('pricing_plan') || r.url.includes('pricing_plan')) {
        log(`  POST ${r.url.slice(0, 80)} body: ${r.body.slice(0, 200)}`);
        const planMatch = (r.body + r.url).match(/pricing_plan[=&"':\s]+([A-Z0-9]{6,14})/i);
        if (planMatch) {
          const u = `https://payhip.com/order?link=${key}&pricing_plan=${planMatch[1]}`;
          log(`  ✓ plan in POST: ${u}`);
          return u;
        }
      }
    }

    // ── 7. Inspect updated DOM after click ──────────────────────────────────
    const afterDom = await page.evaluate(k => {
      const html = document.documentElement.innerHTML;
      const res  = {};

      const orderUrls = [...html.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>\\]+/g)]
        .map(m => m[0].replace(/&amp;/g,'&').replace(/\\u0026/g,'&'))
        .filter(u => u.includes('pricing_plan'));
      if (orderUrls.length) res.orderUrls = [...new Set(orderUrls)];

      const planIds = [...html.matchAll(/pricing_plan[=_"':\s\\]+([A-Z0-9]{6,14})/gi)].map(m => m[1]);
      if (planIds.length) res.planIds = [...new Set(planIds)];

      // Iframes that loaded checkout
      const frames = [...document.querySelectorAll('iframe')]
        .map(f => f.src)
        .filter(s => s && (s.includes('payhip') || s.includes('order') || s.includes('checkout')));
      if (frames.length) res.iframes = frames;

      // Any visible modal content
      const modal = document.querySelector(
        '.modal.show,.modal-overlay.open,[id*="checkout"].show,[class*="checkout-modal"].open,' +
        '[id*="paywall"],[class*="paywall"],.purchase-modal'
      );
      if (modal) {
        const mHtml = modal.innerHTML;
        const mPlans = [...mHtml.matchAll(/pricing_plan[=_"':\s\\]+([A-Z0-9]{6,14})/gi)].map(m => m[1]);
        const mOrders = [...mHtml.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>\\]+/g)].map(m => m[0]);
        res.modal = { plans: mPlans, orders: mOrders, snippet: mHtml.slice(0, 300) };
      }

      // Check all active iframes for their document URL
      const allFrameUrls = [...document.querySelectorAll('iframe')]
        .map(f => ({ src: f.src, name: f.name, id: f.id }))
        .filter(f => f.src);
      if (allFrameUrls.length) res.allFrames = allFrameUrls;

      return res;
    }, key);

    log(`  afterDom: ${JSON.stringify(afterDom).slice(0, 600)}`);

    if (afterDom.orderUrls?.length) return afterDom.orderUrls[0];
    if (afterDom.modal?.orders?.length) return afterDom.modal.orders[0].replace(/&amp;/g,'&');
    if (afterDom.planIds?.length) return `https://payhip.com/order?link=${key}&pricing_plan=${afterDom.planIds[0]}`;
    if (afterDom.modal?.plans?.length) return `https://payhip.com/order?link=${key}&pricing_plan=${afterDom.modal.plans[0]}`;

    // ── 8. Try following checkout iframe into its own frame ──────────────────
    const frames = page.frames();
    log(`  Total frames: ${frames.length}`);
    for (const frame of frames) {
      const fu = frame.url();
      log(`  Frame URL: ${fu}`);
      if (fu.includes('payhip.com') && fu !== productUrl && !fu.includes('dashboard')) {
        if (fu.includes('pricing_plan')) return fu;
        // Try reading the frame's HTML
        try {
          const fHtml = await frame.evaluate(() => document.documentElement.innerHTML.slice(0, 5000));
          const mPlan = fHtml.match(/pricing_plan[=_"':\s]+([A-Z0-9]{6,14})/i);
          if (mPlan) return `https://payhip.com/order?link=${key}&pricing_plan=${mPlan[1]}`;
          const mOrder = fHtml.match(/https:\/\/payhip\.com\/order\?[^"'\s<>]+pricing_plan=[A-Z0-9]+/i);
          if (mOrder) return mOrder[0].replace(/&amp;/g,'&');
        } catch {}
      }
    }

    // ── 9. Final: dump all request URLs for debug ───────────────────────────
    await page.screenshot({ path: path.join(SCRIPTS_DIR, `debug-${key}.png`) });
    const allUrls = reqLog.map(r => r.url);
    log(`  ALL requests (${allUrls.length}): ${allUrls.slice(-15).join('\n    ')}`);

    return null;

  } finally {
    page.off('request',  onReq);
    page.off('response', onResp);
  }
}

(async () => {
  const allProducts = parseLinks();
  const bundle    = allProducts.find(p => p.url.includes('rj4IU'));
  const products  = allProducts.filter(p => !p.url.includes('rj4IU'));
  log(`Products: ${products.length} individual + 1 bundle`);

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 40, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);
  log('Session OK: ' + page.url());

  const results = [];

  for (const product of products) {
    const key = product.url.split('/b/')[1];
    log(`\n══ ${product.name} [${key}] ══`);
    try {
      const checkout = await getPlan(page, product.url);
      if (checkout) {
        log(`  ✓ ${checkout}`);
        results.push({ ...product, checkout });
      } else {
        log(`  ✗ Not found`);
        results.push({ ...product, checkout: null });
      }
    } catch (e) {
      log(`  ERROR: ${e.message}`);
      results.push({ ...product, checkout: null });
    }
    await sleep(400);
  }

  // Bundle already known
  results.push({
    ...bundle,
    checkout: 'https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL'
  });

  await browser.close();

  const found    = results.filter(r => r.checkout && r.checkout.includes('pricing_plan'));
  const notFound = results.filter(r => !r.checkout || !r.checkout.includes('pricing_plan'));

  log('\n═══════════════════════════════');
  log(`Found pricing_plan: ${found.length}/${results.length}`);
  found.forEach(r => log(`  ✓ ${r.url.split('/b/')[1]} → ${r.checkout}`));
  if (notFound.length) {
    log(`Not found:`);
    notFound.forEach(r => log(`  ✗ ${r.url.split('/b/')[1]} (${r.name})`));
  }

  if (found.length === results.length) {
    const lines = results.map(r => `${r.url} | ${r.checkout}`);
    fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
    log(`\nSaved all ${results.length} to ${OUTPUT_FILE}`);
  } else {
    log(`\nOnly ${found.length} found — NOT writing output file until all are resolved`);
  }
  log('═══════════════════════════════');
})();
