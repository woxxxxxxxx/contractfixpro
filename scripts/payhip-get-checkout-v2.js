/**
 * payhip-get-checkout-v2.js
 * Intercept XHR/fetch + inspect modal DOM to extract pricing_plan IDs.
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

async function getCheckoutUrl(page, productUrl) {
  const linkKey = productUrl.split('/b/')[1];
  const xhrPayloads  = [];
  const xhrUrls      = [];
  const xhrResponses = [];

  // Intercept ALL requests
  const onRequest = req => {
    const u = req.url();
    if (u.includes('payhip.com')) {
      xhrUrls.push({ method: req.method(), url: u.replace(/&amp;/g,'&') });
    }
  };
  page.on('request', onRequest);

  // Intercept responses to capture checkout info
  const onResponse = async res => {
    const u = res.url();
    if (u.includes('payhip.com') &&
        (u.includes('checkout') || u.includes('pricing') || u.includes('cart') || u.includes('order'))) {
      try {
        const text = await res.text().catch(() => '');
        if (text.length < 50000) xhrResponses.push({ url: u, body: text.slice(0, 2000) });
      } catch {}
    }
  };
  page.on('response', onResponse);

  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1500);

    // Extract from page HTML before clicking anything
    const pageData = await page.evaluate((lk) => {
      const html = document.documentElement.innerHTML;
      const results = {};

      // 1. Find all order URLs in page source
      const orderUrls = [...html.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>]+/g)]
        .map(m => m[0].replace(/&amp;/g, '&'));
      if (orderUrls.length) results.orderUrls = [...new Set(orderUrls)];

      // 2. Find pricing_plan values
      const planIds = [...html.matchAll(/pricing_plan[=_"':,\s]+([A-Z0-9]{6,14})/gi)]
        .map(m => m[1]);
      if (planIds.length) results.planIds = [...new Set(planIds)];

      // 3. data-pricing-plan attributes
      const els = document.querySelectorAll('[data-pricing-plan], [data-plan-id], [data-checkout-link]');
      if (els.length) {
        results.dataAttrs = Array.from(els).map(e => ({
          planId: e.dataset.pricingPlan || e.dataset.planId,
          checkoutLink: e.dataset.checkoutLink,
          tag: e.tagName,
          class: e.className.slice(0,40)
        }));
      }

      // 4. Embedded JSON/JS data
      const jsonBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(m => m[1])
        .filter(s => s.includes('pricing_plan') || s.includes('plan_id') || s.includes('order?link='));
      if (jsonBlocks.length) {
        results.scriptData = jsonBlocks.map(s => s.slice(0, 500));
      }

      // 5. Look for add-to-cart button data
      const btn = document.querySelector('.add-to-cart-btn, .js-add-to-cart, [data-product-key]');
      if (btn) {
        results.btnData = {
          dataset: JSON.stringify(btn.dataset),
          href: btn.href || null,
          onclick: btn.getAttribute('onclick') || null
        };
      }

      return results;
    }, linkKey);

    log(`  Page data: ${JSON.stringify(pageData).slice(0, 400)}`);

    // If we found order URLs in the page source, use the first one
    if (pageData.orderUrls?.length) {
      const orderUrl = pageData.orderUrls.find(u => u.includes(linkKey));
      if (orderUrl) {
        log(`  ✓ Found in page source: ${orderUrl}`);
        return orderUrl;
      }
    }

    // Click "Buy Now" button
    const clicked = await page.evaluate(() => {
      const selectors = [
        '.add-to-cart-btn', 'button.js-add-to-cart',
        '.buy-button', '.js-buy-button',
        'a[data-product-key]', 'button[data-product-key]',
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.getBoundingClientRect().width > 0) {
          btn.click();
          return { sel, text: btn.textContent.trim(), dataset: JSON.stringify(btn.dataset), href: btn.href };
        }
      }
      // Try text-based search
      for (const btn of document.querySelectorAll('button, a')) {
        const t = btn.textContent.trim().toLowerCase();
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && (t === 'buy now' || t === 'add to cart' || t === 'get now')) {
          btn.click();
          return { text: btn.textContent.trim(), dataset: JSON.stringify(btn.dataset), href: btn.href };
        }
      }
      return null;
    });
    log(`  Clicked: ${JSON.stringify(clicked)}`);

    await sleep(2500);  // Wait for modal/AJAX

    // Now inspect modal content for pricing plan
    const modalData = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const results = {};

      // Order URLs that appeared after click
      const orderUrls = [...html.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>]+/g)]
        .map(m => m[0].replace(/&amp;/g, '&'));
      if (orderUrls.length) results.orderUrls = [...new Set(orderUrls)];

      // Plan IDs in modal
      const planIds = [...html.matchAll(/pricing_plan[=_"':,\s]+([A-Z0-9]{6,14})/gi)]
        .map(m => m[1]);
      if (planIds.length) results.planIds = [...new Set(planIds)];

      // Look for checkout iframe or embed
      const iframes = Array.from(document.querySelectorAll('iframe[src*="order"], iframe[src*="checkout"]'));
      if (iframes.length) results.iframeSrcs = iframes.map(f => f.src);

      // Look for visible checkout form or modal
      const modal = document.querySelector(
        '.modal.show, .modal-overlay.open, [id*="checkout"], [id*="cart"], [class*="checkout-modal"]'
      );
      if (modal) {
        const modalHtml = modal.innerHTML;
        const planMatch = [...modalHtml.matchAll(/pricing_plan[=_"':,\s]+([A-Z0-9]{6,14})/gi)].map(m => m[1]);
        const orderMatch = [...modalHtml.matchAll(/https:\/\/payhip\.com\/order\?[^"'\s<>]+/g)].map(m => m[0]);
        results.modal = {
          planIds: planMatch,
          orderUrls: orderMatch,
          htmlSnippet: modalHtml.slice(0, 500)
        };
      }

      // Check all forms
      const forms = Array.from(document.querySelectorAll('form[action*="order"], form[action*="checkout"]'));
      if (forms.length) {
        results.forms = forms.map(f => ({
          action: f.action,
          inputs: Array.from(f.querySelectorAll('input[name]')).map(i => ({ name: i.name, value: i.value }))
        }));
      }

      return results;
    });

    log(`  Modal data: ${JSON.stringify(modalData).slice(0, 600)}`);

    // Check intercepted XHR responses
    for (const resp of xhrResponses) {
      log(`  XHR response from ${resp.url.slice(0, 80)}: ${resp.body.slice(0, 200)}`);
      const planMatch = resp.body.match(/pricing_plan[=_"':,\s]+([A-Z0-9]{6,14})/i);
      if (planMatch) {
        const checkoutUrl = `https://payhip.com/order?link=${linkKey}&pricing_plan=${planMatch[1]}`;
        log(`  ✓ Found plan in XHR response: ${checkoutUrl}`);
        return checkoutUrl;
      }
      const orderMatch = resp.body.match(/https:\/\/payhip\.com\/order\?[^"'\s]+/);
      if (orderMatch) return orderMatch[0].replace(/&amp;/g, '&');
    }

    // Check XHR URLs
    const checkoutRequest = xhrUrls.find(r => r.url.includes('/order') && r.url.includes('pricing_plan'));
    if (checkoutRequest) {
      log(`  ✓ Found in XHR URL: ${checkoutRequest.url}`);
      return checkoutRequest.url;
    }

    // If modal had plan IDs, construct URL
    if (modalData.modal?.planIds?.length) {
      const plan = modalData.modal.planIds[0];
      return `https://payhip.com/order?link=${linkKey}&pricing_plan=${plan}`;
    }
    if (modalData.planIds?.length) {
      const plan = modalData.planIds[0];
      return `https://payhip.com/order?link=${linkKey}&pricing_plan=${plan}`;
    }
    if (modalData.orderUrls?.length) {
      return modalData.orderUrls.find(u => u.includes(linkKey)) || modalData.orderUrls[0];
    }

    // Take a screenshot to see what happened
    await page.screenshot({ path: path.join(SCRIPTS_DIR, `checkout-${linkKey}.png`) });

    // Log all intercepted XHR URLs for debugging
    const payhipXhr = xhrUrls.filter(u => u.url.includes('payhip'));
    log(`  All PayHip XHR URLs: ${JSON.stringify(payhipXhr.slice(-10))}`);

    return null;

  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
  }
}

(async () => {
  const products = parseLinks();
  log(`Loaded ${products.length} products`);

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);
  log('Session OK');

  const results = [];

  for (const product of products) {
    const linkKey = product.url.split('/b/')[1];
    log(`\n--- ${product.name} [${linkKey}] ---`);
    try {
      const checkoutUrl = await getCheckoutUrl(page, product.url);
      if (checkoutUrl && checkoutUrl.includes('pricing_plan')) {
        log(`  ✓ FULL checkout: ${checkoutUrl}`);
        results.push({ ...product, checkout: checkoutUrl });
      } else {
        // Use simple order URL — for single-plan products this works
        const simple = `https://payhip.com/order?link=${linkKey}`;
        log(`  → Simple checkout: ${simple}`);
        results.push({ ...product, checkout: simple });
      }
    } catch (e) {
      log(`  ERROR: ${e.message}`);
      results.push({ ...product, checkout: `https://payhip.com/order?link=${linkKey}` });
    }
    await sleep(300);
  }

  await browser.close();

  // Write checkout-links.txt
  const lines = results.map(r => `${r.url} | ${r.checkout}`);
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
  log('\n=============================');
  log('FINAL MAPPING:');
  results.forEach(r => log(`  ${r.url.split('/b/')[1]} → ${r.checkout}`));
  log(`\nSaved: ${OUTPUT_FILE}`);
  log('=============================');
})();
