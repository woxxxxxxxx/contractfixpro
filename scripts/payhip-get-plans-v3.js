/**
 * payhip-get-plans-v3.js
 * Fresh context per product (empty cart, no login) → click payhip-buy-button
 * → capture checkout frame URL → extract pricing_plan or buy?cart_links format.
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const fs   = require('fs');
const SCRIPTS_DIR = __dirname;
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

function cleanUrl(u) {
  return u.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\/g, '');
}

async function getCheckoutUrl(browser, productUrl) {
  const key = productUrl.split('/b/')[1];

  // Fresh context = empty cart, no seller session
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await ctx.newPage();

  const checkoutUrls  = [];  // frame/page URLs that look like checkout
  const respPlanIds   = [];  // pricing_plan values found in JSON responses

  // ── Intercept all frame navigations ────────────────────────────────────────
  const onFrameNav = frame => {
    const u = frame.url();
    if (!u || u === 'about:blank') return;
    if (u.includes('payhip.com') && u !== productUrl) {
      log(`    frame nav: ${u.slice(0, 120)}`);
      checkoutUrls.push(u);
    }
  };
  page.on('framenavigated', onFrameNav);

  // ── Intercept all requests to spot order/buy URLs ───────────────────────────
  const onReq = req => {
    const u = req.url();
    if (u.includes('payhip.com') &&
        (u.includes('/order?') || (u.includes('/buy?') && u.includes('cart')))) {
      log(`    req: ${u.slice(0, 120)}`);
      checkoutUrls.push(u);
    }
  };
  page.on('request', onReq);

  // ── Intercept JSON responses for pricing_plan ───────────────────────────────
  const onResp = async res => {
    const u = res.url();
    if (!u.includes('payhip.com')) return;
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('json')) {
        const txt = await res.text().catch(() => '');
        if (txt.includes('pricing_plan') || txt.includes('plan_id')) {
          log(`    json resp (${u.slice(0,60)}): ${txt.slice(0, 200)}`);
          const m = txt.match(/pricing_plan['":\s=]+['"]?([A-Z0-9]{6,14})['"]?/i);
          if (m) respPlanIds.push(m[1]);
        }
      }
    } catch {}
  };
  page.on('response', onResp);

  try {
    // ── 1. Load product page ──────────────────────────────────────────────────
    await page.goto(productUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(1500);

    // ── 2. Check page source for pricing_plan before clicking ─────────────────
    const fromSrc = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;

      const orderUrls = [...html.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>\\]+/g)]
        .map(m => m[0]).map(u => u.replace(/&amp;/g,'&').replace(/\\u0026/g,'&'))
        .filter(u => u.includes('pricing_plan'));
      if (orderUrls.length) return { type: 'orderUrl', val: orderUrls[0] };

      const planIds = [...html.matchAll(/pricing_plan[=_"':\s\\]+([A-Z0-9]{6,14})/gi)].map(m => m[1]);
      if (planIds.length) return { type: 'planId', val: [...new Set(planIds)][0] };

      return null;
    });

    if (fromSrc) {
      if (fromSrc.type === 'orderUrl') {
        log(`  ✓ order URL in page source`);
        return fromSrc.val;
      }
      log(`  ✓ plan ID in page source: ${fromSrc.val}`);
      return `https://payhip.com/order?link=${key}&pricing_plan=${fromSrc.val}`;
    }

    // ── 3. Click the payhip-buy-button ("Buy Now") ────────────────────────────
    const btnInfo = await page.evaluate(() => {
      // First try the dedicated payhip-buy-button class
      let btn = document.querySelector('button.payhip-buy-button, .payhip-buy-button');
      if (!btn) {
        // Fallback: button with exact text "Buy Now" that is visible
        btn = [...document.querySelectorAll('button')].find(b => {
          const t = b.textContent.trim().toLowerCase();
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (t === 'buy now' || t === 'buy');
        });
      }
      if (!btn) return null;
      btn.click();
      return { text: btn.textContent.trim().slice(0,40), cls: btn.className.slice(0,80) };
    });
    log(`  clicked: ${JSON.stringify(btnInfo)}`);

    if (!btnInfo) {
      log(`  WARNING: no buy button found`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `debug-${key}.png`) });
    }

    // ── 4. Wait for checkout to load ──────────────────────────────────────────
    await sleep(4000);

    // Check if page itself navigated
    const currentUrl = page.url();
    if (currentUrl !== productUrl && currentUrl.includes('payhip.com')) {
      log(`  page nav → ${currentUrl.slice(0, 120)}`);
      checkoutUrls.push(currentUrl);
    }

    // Inspect all frames
    for (const frame of page.frames()) {
      const fu = frame.url();
      if (fu && fu !== productUrl && fu !== 'about:blank' && fu.includes('payhip.com')) {
        log(`  frame: ${fu.slice(0, 120)}`);
        checkoutUrls.push(fu);
        // Also inspect that frame's HTML for pricing_plan
        try {
          const fHtml = await frame.evaluate(() => document.documentElement.innerHTML);
          const m = fHtml.match(/pricing_plan[=_"':\s]+([A-Z0-9]{6,14})/i);
          if (m) {
            log(`    frame contains pricing_plan: ${m[1]}`);
            return `https://payhip.com/order?link=${key}&pricing_plan=${m[1]}`;
          }
          const mo = fHtml.match(/https:\/\/payhip\.com\/order\?[^"'\s<>\\]+pricing_plan=[A-Z0-9]+/i);
          if (mo) {
            log(`    frame contains order URL: ${mo[0]}`);
            return cleanUrl(mo[0]);
          }
        } catch {}
      }
    }

    // ── 5. Inspect updated DOM for pricing_plan ───────────────────────────────
    const domAfter = await page.evaluate(k => {
      const html = document.documentElement.innerHTML;
      const orderUrls = [...html.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>\\]+/g)]
        .map(m => m[0]).filter(u => u.includes('pricing_plan'));
      const planIds = [...html.matchAll(/pricing_plan[=_"':\s\\]+([A-Z0-9]{6,14})/gi)].map(m => m[1]);
      return { orderUrls: [...new Set(orderUrls)], planIds: [...new Set(planIds)] };
    }, key);

    if (domAfter.orderUrls.length) return cleanUrl(domAfter.orderUrls[0]);
    if (domAfter.planIds.length) return `https://payhip.com/order?link=${key}&pricing_plan=${domAfter.planIds[0]}`;

    // ── 6. Check JSON response intercepted plan IDs ────────────────────────────
    if (respPlanIds.length) {
      return `https://payhip.com/order?link=${key}&pricing_plan=${respPlanIds[0]}`;
    }

    // ── 7. Analyse captured checkout URLs ─────────────────────────────────────
    const cleanUrls = checkoutUrls.map(cleanUrl);
    log(`  captured checkout URLs (${cleanUrls.length}):`);
    cleanUrls.forEach(u => log(`    ${u.slice(0, 120)}`));

    // Prefer URL that already has pricing_plan
    const withPlan = cleanUrls.find(u => u.includes('pricing_plan'));
    if (withPlan) return withPlan;

    // Try order? URL
    const orderUrl = cleanUrls.find(u => u.includes('/order?'));
    if (orderUrl) return orderUrl;

    // Use buy? URL (clean single-product form: remove extra cart_links)
    const buyUrl = cleanUrls.find(u => u.includes('/buy?') && u.includes('cart_links'));
    if (buyUrl) {
      // Strip session param and keep only this product
      const clean = `https://payhip.com/buy?cart_links[]=${key}&qty[${key}]=1`;
      log(`  → using buy URL: ${clean}`);
      return clean;
    }

    // ── 8. Last resort: navigate directly to the buy URL and mine its content ──
    log(`  Trying direct buy URL...`);
    const directBuy = `https://payhip.com/buy?cart_links[]=${key}&qty[${key}]=1`;
    const buyCheckoutUrls2 = [];
    const onReq2 = req => {
      const u = req.url();
      if (u.includes('payhip.com') && u.includes('order')) buyCheckoutUrls2.push(u);
    };
    page.on('request', onReq2);

    await page.goto(directBuy, { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(2000);

    const directUrl = page.url();
    if (directUrl.includes('pricing_plan')) { page.off('request', onReq2); return directUrl; }

    const directPlan = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const m = html.match(/pricing_plan[=_"':\s]+([A-Z0-9]{6,14})/i);
      return m ? m[1] : null;
    });
    page.off('request', onReq2);
    if (directPlan) return `https://payhip.com/order?link=${key}&pricing_plan=${directPlan}`;

    const orderReq = buyCheckoutUrls2.find(u => u.includes('pricing_plan'));
    if (orderReq) return orderReq;

    return directBuy; // final fallback: the bare buy URL

  } finally {
    page.off('framenavigated', onFrameNav);
    page.off('request', onReq);
    page.off('response', onResp);
    await ctx.close().catch(() => {});
  }
}

(async () => {
  const allProducts = parseLinks();
  const bundle   = allProducts.find(p => p.url.includes('rj4IU'));
  const products = allProducts.filter(p => !p.url.includes('rj4IU'));
  log(`${products.length} individual products + 1 bundle`);

  const browser = await chromium.launch({
    headless: false, slowMo: 40,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const results = [];

  for (const product of products) {
    const key = product.url.split('/b/')[1];
    log(`\n══ ${product.name} [${key}] ══`);
    try {
      const checkout = await getCheckoutUrl(browser, product.url);
      log(`  → ${checkout}`);
      results.push({ ...product, checkout });
    } catch (e) {
      log(`  ERROR: ${e.message}`);
      results.push({ ...product, checkout: null });
    }
    await sleep(500);
  }

  // Bundle already known
  results.push({ ...bundle, checkout: 'https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL' });

  await browser.close();

  log('\n═══════════════════════════════════════');
  const withPlan   = results.filter(r => r.checkout?.includes('pricing_plan'));
  const withBuy    = results.filter(r => r.checkout?.includes('/buy?'));
  const missing    = results.filter(r => !r.checkout);
  log(`pricing_plan URLs: ${withPlan.length}`);
  log(`buy? URLs:         ${withBuy.length}`);
  log(`missing:           ${missing.length}`);
  results.forEach(r => log(`  ${r.url.split('/b/')[1].padEnd(8)} → ${r.checkout?.slice(0,100) || 'NULL'}`));

  if (missing.length === 0) {
    const lines = results.map(r => `${r.url} | ${r.checkout}`);
    fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
    log(`\nSaved ${results.length} entries → ${OUTPUT_FILE}`);
  } else {
    log(`\nNOT saving — ${missing.length} products still missing checkout URL`);
  }
  log('═══════════════════════════════════════');
})();
