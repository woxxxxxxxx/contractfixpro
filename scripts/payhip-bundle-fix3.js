/**
 * payhip-bundle-fix3.js
 * 1. Add remaining products by clicking a.js-custom-item-row-link precisely
 * 2. Create $29 pricing plan (pricing page shows "no active plans" — need to ADD one)
 * 3. Publish via "Publish" tab link
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

const BUNDLE_ID = 'rj4IU';

// All 20 products — will skip ones already in bundle
const ALL_PRODUCTS = [
  'Freelance Contract Generator',
  'Photography Contract Generator',
  'Web Design Contract Generator',
  'NDA Generator',
  'Independent Contractor Agreement Generator',
  'Service Agreement Generator',
  'Consulting Agreement Generator',
  'Social Media Management Contract Generator',
  'Graphic Design Contract Generator',
  'Copywriting Contract Generator',
  'Virtual Assistant Contract Generator',
  'Logo Design Contract Generator',
  'Brand Ambassador Contract Generator',
  'Videography Contract Generator',
  'Influencer Brand Deal Contract Generator',
  'Music Producer Contract Generator',
  'Video Editing Contract Generator',
  'Client Onboarding Contract Generator',
  'Website Maintenance Contract Generator',
  'Invoice Template Generator',
];

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
    log('Session OK: ' + page.url());

    // ─── Step 1: Audit which products are already in the bundle ─────────────
    log('\n=== Step 1: Check current bundle products ===');
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    const bundlePageText = await page.evaluate(() => document.body.innerText);
    const alreadyInBundle = ALL_PRODUCTS.filter(n => bundlePageText.includes(n));
    const needToAdd = ALL_PRODUCTS.filter(n => !bundlePageText.includes(n));

    log(`Already in bundle (${alreadyInBundle.length}): ${JSON.stringify(alreadyInBundle)}`);
    log(`Need to add (${needToAdd.length}): ${JSON.stringify(needToAdd)}`);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-start.png') });

    // ─── Step 2: Add missing products ───────────────────────────────────────
    log('\n=== Step 2: Adding missing products ===');
    let added = 0;

    for (const productName of needToAdd) {
      log(`\n  Adding: "${productName}"`);

      try {
        // Navigate fresh to manage page
        await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
          waitUntil: 'domcontentloaded', timeout: 30000
        });
        await sleep(1500);

        // Click Add Product button
        await page.locator('button:has-text("Add Product")').first().click();
        await sleep(1500);

        // Wait for search input to be visible
        const searchInput = page.locator('input.js-search-input, input[placeholder="Search"]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 10000 });

        // Fill search
        await searchInput.fill(productName);
        await sleep(1500);

        // Click the specific custom-item-row link matching our product name exactly
        const clicked = await page.evaluate((name) => {
          // Strategy 1: click a.js-custom-item-row-link with exact text
          const links = Array.from(document.querySelectorAll('a.js-custom-item-row-link'));
          for (const link of links) {
            if (link.textContent.trim() === name) {
              link.click();
              return { method: 'link-exact', text: link.textContent.trim() };
            }
          }

          // Strategy 2: click div.custom-item-row that contains exact name
          const rows = Array.from(document.querySelectorAll('div.custom-item-row'));
          for (const row of rows) {
            const link = row.querySelector('a');
            if (link && link.textContent.trim() === name) {
              link.click();
              return { method: 'row-link', text: link.textContent.trim() };
            }
            if (row.textContent.trim() === name) {
              row.click();
              return { method: 'row-click', text: row.textContent.trim() };
            }
          }

          // Strategy 3: look for any visible element with exact text match
          const all = Array.from(document.querySelectorAll('li, label, a, div'));
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && el.textContent.trim() === name) {
              el.click();
              return { method: 'exact-text', tag: el.tagName, text: el.textContent.trim() };
            }
          }

          // Log what IS available
          const available = Array.from(document.querySelectorAll('a.js-custom-item-row-link'))
            .map(a => a.textContent.trim());
          return { method: 'failed', available };
        }, productName);

        log(`    Click result: ${JSON.stringify(clicked)}`);
        await sleep(800);

        if (clicked.method !== 'failed') {
          added++;
          log(`    ✓ Added`);
        } else {
          log(`    FAILED — available: ${JSON.stringify(clicked.available)}`);
          await page.keyboard.press('Escape');
          await sleep(300);
        }

      } catch (err) {
        log(`    ERROR: ${err.message.slice(0, 120)}`);
        try { await page.keyboard.press('Escape'); await sleep(300); } catch(_) {}
      }
    }

    log(`\nNewly added: ${added}/${needToAdd.length}`);

    // ─── Verify final product list ───────────────────────────────────────────
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    const finalText = await page.evaluate(() => document.body.innerText);
    const finalPresent = ALL_PRODUCTS.filter(n => finalText.includes(n));
    const finalMissing = ALL_PRODUCTS.filter(n => !finalText.includes(n));

    log(`\nFinal bundle products (${finalPresent.length}/20): ${JSON.stringify(finalPresent)}`);
    if (finalMissing.length > 0) log(`Still missing: ${JSON.stringify(finalMissing)}`);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-after-products.png') });

    // ─── Step 3: Create pricing plan at $29 ─────────────────────────────────
    log('\n=== Step 3: Setting price to $29 ===');
    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-pricing-before.png') });

    // Dump all buttons (including ones with children) on pricing page
    const allBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a[class*="btn"], a[href*="add"], a[href*="new"]'))
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 60),
            href: el.href || '',
            class: el.className.slice(0, 60),
            visible: rect.width > 0 && rect.height > 0,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) }
          };
        }).filter(el => el.visible);
    });
    log('All buttons on pricing page: ' + JSON.stringify(allBtns, null, 2));

    // The page shows "no active pricing plans" — need to click "Add pricing plan" or similar
    // Look for any "Add" button or link
    const addPlanClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a'));
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        const text = el.textContent.trim().toLowerCase();
        if (rect.width > 0 && rect.height > 0 &&
            (text.includes('add') || text.includes('new') || text.includes('create'))) {
          el.click();
          return { clicked: true, text: el.textContent.trim(), tag: el.tagName, href: el.href || '' };
        }
      }
      return { clicked: false };
    });
    log('Add plan click: ' + JSON.stringify(addPlanClicked));
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-pricing-after-add-click.png') });
    log('URL after add click: ' + page.url());

    // Now there should be a form with price input
    // Check current inputs
    const pricingInputsNow = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        name: i.name, type: i.type, value: i.value, placeholder: i.placeholder,
        id: i.id, class: i.className.slice(0, 60),
        visible: i.offsetParent !== null,
        rect: i.getBoundingClientRect()
      }));
    });
    log('Inputs now: ' + JSON.stringify(pricingInputsNow));

    // Try to select "one-time" pricing type if options are now visible
    const oneTimeRadio = page.locator('input[name="pricing_type"][value="one-time"]').first();
    if (await oneTimeRadio.count() > 0) {
      try {
        await oneTimeRadio.click({ force: true });
        await sleep(500);
        log('Clicked one-time radio');
      } catch(_) {
        await page.evaluate(() => {
          const radio = document.querySelector('input[name="pricing_type"][value="one-time"]');
          if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        log('Set one-time radio via JS');
      }
    }

    // Find and fill price input
    const priceInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[name*="price"], input[name="one_time_price"]'));
      return inputs.map(i => ({ name: i.name, value: i.value, rect: i.getBoundingClientRect() }));
    });
    log('Price inputs: ' + JSON.stringify(priceInputs));

    // Set price via JS
    const priceSetResult = await page.evaluate(() => {
      const priceInput = document.querySelector('input[name="one_time_price"]') ||
                         document.querySelector('input[name*="price"]');
      if (!priceInput) return { found: false };

      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(priceInput, '29');
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, name: priceInput.name, value: priceInput.value };
    });
    log('Price set: ' + JSON.stringify(priceSetResult));

    await sleep(300);

    // Try clicking the save/submit button using force
    const saveResult = await page.evaluate(() => {
      // Find all buttons
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const btn of btns) {
        const text = (btn.textContent || btn.value || '').trim().toLowerCase();
        if (text.includes('save') || text.includes('add plan') || text.includes('create') ||
            btn.type === 'submit' || btn.className.includes('js-save')) {
          btn.click();
          return { clicked: true, text: btn.textContent.trim(), class: btn.className.slice(0, 40) };
        }
      }
      return { clicked: false, allBtns: btns.map(b => b.textContent.trim().slice(0, 30)) };
    });
    log('Save result: ' + JSON.stringify(saveResult));
    await sleep(2000);
    log('URL after save: ' + page.url());

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-pricing-after-save.png') });

    // ─── Step 4: Publish via "Publish" tab ──────────────────────────────────
    log('\n=== Step 4: Publishing ===');
    // We saw "Publish" in the nav — click it
    const publishLink = page.locator('a:has-text("Publish")').first();
    if (await publishLink.count() > 0) {
      await publishLink.click();
      await sleep(2000);
      log('Clicked Publish nav link. URL: ' + page.url());
    } else {
      await page.goto(`https://payhip.com/bundle/publish/${BUNDLE_ID}`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await sleep(2000);
      log('Navigated to publish URL: ' + page.url());
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-publish-page.png') });

    // Look for publish/make live button on publish page
    const publishPageBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, input[type="submit"], a[class*="btn"]'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({ text: el.textContent.trim().slice(0, 60), class: el.className.slice(0, 50), tag: el.tagName }));
    });
    log('Publish page buttons: ' + JSON.stringify(publishPageBtns));

    const publishBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      for (const btn of btns) {
        const rect = btn.getBoundingClientRect();
        const text = (btn.textContent || btn.value || '').trim().toLowerCase();
        if (rect.width > 0 && rect.height > 0 &&
            (text.includes('publish') || text.includes('make live') || text.includes('go live'))) {
          btn.click();
          return { clicked: true, text: btn.textContent.trim() };
        }
      }
      return { clicked: false };
    });
    log('Publish click: ' + JSON.stringify(publishBtn));
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-final.png') });
    log('Final URL: ' + page.url());

    // ─── Final Report ────────────────────────────────────────────────────────
    log('\n=== FINAL REPORT ===');
    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Products in bundle: ${finalPresent.length}/20`);
    log(`Products added this run: ${added}`);
    log(`Missing products: ${JSON.stringify(finalMissing)}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix3-fatal.png') });
  } finally {
    await browser.close();
  }
})();
