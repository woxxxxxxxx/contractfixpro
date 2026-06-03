/**
 * payhip-bundle-final.js
 * 1. Verify pricing was saved (or re-save $29)
 * 2. Navigate directly to publish page and publish
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

const BUNDLE_ID = 'rj4IU';

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 60, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    // ─── Step 1: Check pricing page ─────────────────────────────────────────
    log('\n=== Step 1: Check pricing ===');
    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-pricing.png') });

    const pricingPageText = await page.evaluate(() => document.body.innerText);
    log('Pricing page text: ' + pricingPageText.slice(0, 500));

    // Check if $29 is already there
    const has29 = pricingPageText.includes('29') || pricingPageText.includes('$29');
    log('Has $29: ' + has29);

    if (!has29) {
      log('Need to add $29 plan...');

      // Click "Add Pricing Plan"
      const addBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        for (const b of btns) {
          const rect = b.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 &&
              (b.textContent.includes('Add Pricing Plan') || b.textContent.includes('Add Plan'))) {
            b.click();
            return b.textContent.trim();
          }
        }
        return null;
      });
      log('Add plan btn: ' + addBtn);
      await sleep(2000);

      // Select one-time, set price to 29
      await page.evaluate(() => {
        const radio = document.querySelector('input[name="pricing_type"][value="one-time"]');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      await sleep(500);

      await page.evaluate(() => {
        const inp = document.querySelector('input[name="one_time_price"]');
        if (!inp) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, '29');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await sleep(300);

      // Click save — using JS to avoid modal overlay issues
      const saved = await page.evaluate(() => {
        const btn = document.querySelector('button.js-save-changes-button, button[class*="save"]');
        if (btn) { btn.click(); return btn.textContent.trim(); }
        // Try form submit
        const form = document.querySelector('form');
        if (form) { form.submit(); return 'form-submit'; }
        return null;
      });
      log('Saved: ' + saved);
      await sleep(3000);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-pricing-saved.png') });
      log('URL after save: ' + page.url());
    } else {
      log('$29 pricing already set!');
    }

    // Close any open modal via ESC and navigate away
    await page.keyboard.press('Escape');
    await sleep(500);

    // ─── Step 2: Publish ─────────────────────────────────────────────────────
    log('\n=== Step 2: Publish ===');

    // Navigate directly to publish page
    await page.goto(`https://payhip.com/bundle/publish/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-publish-page.png') });
    log('Publish page URL: ' + page.url());

    const publishText = await page.evaluate(() => document.body.innerText);
    log('Publish page text: ' + publishText.slice(0, 400));

    // Click publish button if present
    const publishClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      for (const btn of btns) {
        const rect = btn.getBoundingClientRect();
        const text = (btn.textContent || btn.value || '').trim().toLowerCase();
        if (rect.width > 0 && rect.height > 0 &&
            (text.includes('publish') || text.includes('make live') || text.includes('go live') ||
             text.includes('launch'))) {
          btn.click();
          return (btn.textContent || btn.value || '').trim();
        }
      }
      // List all visible buttons
      return { notFound: true, btns: Array.from(document.querySelectorAll('button, a[class*="btn"]'))
        .filter(b => b.getBoundingClientRect().width > 0)
        .map(b => b.textContent.trim().slice(0, 40)) };
    });
    log('Publish click: ' + JSON.stringify(publishClicked));
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-after-publish.png') });
    log('URL after publish: ' + page.url());

    // ─── Step 3: Verify bundle ───────────────────────────────────────────────
    log('\n=== Step 3: Verify ===');
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    const productsText = await page.evaluate(() => document.body.innerText);
    const isDraft = productsText.includes('DRAFT') || productsText.toLowerCase().includes('draft');
    log('Products page has DRAFT: ' + isDraft);

    // Check bundle products count on manage page
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    const allProductNames = [
      'Freelance Contract Generator', 'Photography Contract Generator',
      'Web Design Contract Generator', 'NDA Generator',
      'Independent Contractor Agreement Generator', 'Service Agreement Generator',
      'Consulting Agreement Generator', 'Social Media Management Contract Generator',
      'Graphic Design Contract Generator', 'Copywriting Contract Generator',
      'Virtual Assistant Contract Generator', 'Logo Design Contract Generator',
      'Brand Ambassador Contract Generator', 'Videography Contract Generator',
      'Influencer Brand Deal Contract Generator', 'Music Producer Contract Generator',
      'Video Editing Contract Generator', 'Client Onboarding Contract Generator',
      'Website Maintenance Contract Generator', 'Invoice Template Generator',
    ];

    const manageText = await page.evaluate(() => document.body.innerText);
    const present = allProductNames.filter(n => manageText.includes(n));
    const missing = allProductNames.filter(n => !manageText.includes(n));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-verify.png') });

    log('\n=============================');
    log('FINAL REPORT:');
    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Products in bundle: ${present.length}/20`);
    if (missing.length > 0) log(`Missing: ${JSON.stringify(missing)}`);
    log(`Published: ${isDraft ? 'NO (still has DRAFT somewhere)' : 'YES (no DRAFT badge)'}`);
    log('=============================\n');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-fatal.png') });
  } finally {
    await browser.close();
  }
})();
