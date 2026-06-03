/**
 * payhip-get-checkout-urls.js
 * For each product in links.txt, click "Buy Now" and capture the checkout URL.
 * Saves mapping to checkout-links.txt.
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const fs   = require('fs');
const SCRIPTS_DIR  = __dirname;
const SESSION_DIR  = path.join(SCRIPTS_DIR, 'browser-session');
const LINKS_FILE   = path.join(SCRIPTS_DIR, 'links.txt');
const OUTPUT_FILE  = path.join(SCRIPTS_DIR, 'checkout-links.txt');

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Parse links.txt  →  [{name, url}]
function parseLinks() {
  return fs.readFileSync(LINKS_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const m = l.match(/^(.+?)\s*\|\s*(https:\/\/payhip\.com\/b\/\S+)$/);
      return m ? { name: m[1].trim(), url: m[2].trim() } : null;
    })
    .filter(Boolean);
}

async function getCheckoutUrl(page, productUrl) {
  const capturedUrls = [];

  // Intercept all requests to payhip.com/order or /checkout
  const onRequest = req => {
    const u = req.url();
    if (u.includes('payhip.com/order') || u.includes('payhip.com/checkout')) {
      capturedUrls.push(u);
    }
  };
  page.on('request', onRequest);

  // Also intercept navigations
  const onNav = frame => {
    if (frame === page.mainFrame()) {
      const u = frame.url();
      if (u.includes('payhip.com/order') || u.includes('payhip.com/checkout')) {
        capturedUrls.push(u);
      }
    }
  };
  page.on('framenavigated', onNav);

  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(2000);

    // Look for the pricing plan data embedded in the page
    // PayHip includes pricing plan IDs in the page HTML/JS
    const planData = await page.evaluate(() => {
      // Method 1: look for data attributes on buy buttons
      const btn = document.querySelector(
        '[data-product-key], [data-link-key], .buy-button, .js-buy-button, ' +
        'button[data-plan-id], a[data-plan-id], [data-pricing-plan]'
      );
      if (btn) {
        return {
          planId: btn.dataset.planId || btn.dataset.pricingPlan || btn.dataset.productKey,
          linkKey: btn.dataset.linkKey,
          href: btn.href || null
        };
      }

      // Method 2: search all anchor tags for /order links
      const links = Array.from(document.querySelectorAll('a[href*="/order"], a[href*="checkout"]'));
      if (links.length > 0) return { href: links[0].href };

      // Method 3: check window/payhip globals
      const pb = window.Payhip || window.payhip || window.payhipData;
      if (pb) return { global: JSON.stringify(pb).slice(0, 300) };

      // Method 4: look in page source for pricing plan IDs
      const html = document.documentElement.innerHTML;
      const planMatch = html.match(/pricing_plan[=_"':]+([A-Z0-9]{8,12})/i);
      const linkMatch = html.match(/order\?link=([A-Za-z0-9]+)/);
      return { planMatch: planMatch?.[1], linkMatch: linkMatch?.[1] };
    });
    log(`  Plan data: ${JSON.stringify(planData)}`);

    // Method: find and click the "Buy Now" / "Add to Cart" / "Get it now" button
    const buyBtnSelectors = [
      'a.add-to-cart-btn', 'button.add-to-cart-btn',
      '.js-buy-button', '.buy-button',
      'a[href*="/order"]', 'a[href*="checkout"]',
      'button:has-text("Buy Now")', 'button:has-text("Add to Cart")',
      'button:has-text("Get it now")', 'a:has-text("Buy Now")',
      'a:has-text("Add to Cart")', 'a:has-text("Get it")',
      '.product-actions a', '.product-action a',
    ];

    let btnClicked = false;
    for (const sel of buyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0) {
          const btnText = await btn.evaluate(el => el.textContent?.trim() || el.href || '');
          const btnHref = await btn.evaluate(el => el.href || '');
          log(`  Found button "${sel}": "${btnText}" href="${btnHref}"`);

          // If the href is already an order URL, capture it directly
          if (btnHref && btnHref.includes('/order')) {
            capturedUrls.push(btnHref);
            btnClicked = true;
            break;
          }

          // Otherwise click and wait for navigation or modal
          await btn.click({ timeout: 5000 });
          btnClicked = true;
          await sleep(3000);
          break;
        }
      } catch {}
    }

    if (!btnClicked) {
      log('  WARNING: No buy button found, trying JS search');
      const jsBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('a, button'));
        for (const b of btns) {
          const t = (b.textContent || '').toLowerCase().trim();
          const h = (b.href || '').toLowerCase();
          if (t.includes('buy') || t.includes('cart') || t.includes('get it') ||
              h.includes('order') || h.includes('checkout')) {
            const rect = b.getBoundingClientRect();
            if (rect.width > 0) {
              b.click();
              return { text: b.textContent.trim(), href: b.href };
            }
          }
        }
        return null;
      });
      if (jsBtn) {
        log(`  JS btn clicked: ${JSON.stringify(jsBtn)}`);
        if (jsBtn.href?.includes('/order')) capturedUrls.push(jsBtn.href);
        await sleep(2000);
      }
    }

    // Check current URL after click
    const currentUrl = page.url();
    if (currentUrl.includes('/order') || currentUrl.includes('/checkout')) {
      capturedUrls.push(currentUrl);
    }

    // Check for embedded checkout iframe or modal with order URL
    const modalUrl = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const f of iframes) {
        if (f.src?.includes('order') || f.src?.includes('checkout')) return f.src;
      }
      // Look for any element with data attributes
      const els = Array.from(document.querySelectorAll('[data-plan-id], [data-pricing-plan]'));
      if (els.length > 0) {
        return 'plan:' + (els[0].dataset.planId || els[0].dataset.pricingPlan);
      }
      // Search page source for order URLs
      const m = document.documentElement.innerHTML.match(/https:\/\/payhip\.com\/order\?[^"'\s]+/);
      return m ? m[0] : null;
    });
    if (modalUrl) {
      log(`  Modal/source URL: ${modalUrl}`);
      if (modalUrl.startsWith('http')) capturedUrls.push(modalUrl);
    }

    // Extract pricing plan from page HTML directly
    const pageHtmlPlan = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      // Look for order URL pattern
      const orderMatch = html.match(/https:\/\/payhip\.com\/order\?link=[^"'\s&]+(?:&pricing_plan=[^"'\s]+)?/g);
      if (orderMatch) return orderMatch;
      // Look for pricing plan attribute
      const planAttr = html.match(/data-pricing-plan="([^"]+)"/g);
      if (planAttr) return planAttr;
      // Look for JS variable
      const jsVar = html.match(/pricing_plan['":\s=]+['"]([A-Z0-9]+)['"]/ig);
      if (jsVar) return jsVar;
      return null;
    });
    if (pageHtmlPlan) log(`  Page HTML plan refs: ${JSON.stringify(pageHtmlPlan).slice(0, 200)}`);

  } finally {
    page.off('request', onRequest);
    page.off('framenavigated', onNav);
  }

  // Return first captured order URL
  const orderUrls = capturedUrls.filter(u => u.includes('/order') || u.includes('/checkout'));
  log(`  Captured URLs: ${JSON.stringify(orderUrls)}`);
  return orderUrls[0] || null;
}

(async () => {
  const products = parseLinks();
  log(`Loaded ${products.length} products from links.txt`);

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  // Verify session
  await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);
  log('Session OK, URL: ' + page.url());

  const results = [];

  for (const product of products) {
    log(`\n--- ${product.name} (${product.url}) ---`);
    try {
      const checkoutUrl = await getCheckoutUrl(page, product.url);
      if (checkoutUrl) {
        log(`  ✓ Checkout URL: ${checkoutUrl}`);
        results.push({ name: product.name, original: product.url, checkout: checkoutUrl });
      } else {
        // Fallback: construct from link key (order?link=KEY)
        const key = product.url.split('/b/')[1];
        const fallback = `https://payhip.com/order?link=${key}`;
        log(`  ⚠ No checkout URL captured, using fallback: ${fallback}`);
        results.push({ name: product.name, original: product.url, checkout: fallback, fallback: true });
      }
    } catch (e) {
      log(`  ERROR: ${e.message}`);
      const key = product.url.split('/b/')[1];
      results.push({ name: product.name, original: product.url, checkout: `https://payhip.com/order?link=${key}`, error: true });
    }
    await sleep(500);
  }

  await browser.close();

  // Write checkout-links.txt
  const lines = results.map(r => `${r.original} | ${r.checkout}`);
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf8');
  log('\n=============================');
  log('CHECKOUT URL MAPPING:');
  results.forEach(r => log(`  ${r.name}: ${r.checkout}${r.fallback ? ' [FALLBACK]' : ''}${r.error ? ' [ERROR]' : ''}`));
  log(`\nSaved to: ${OUTPUT_FILE}`);
  log('=============================');
})();
