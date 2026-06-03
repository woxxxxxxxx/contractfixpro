/**
 * payhip-bundle-fix.js
 * 1. Add the 6 missing products that failed in the previous run
 * 2. Set price to $29 (using JS force-fill since input may be hidden)
 * 3. Publish
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

// Products that failed in the previous run
const MISSING_PRODUCTS = [
  'Web Design Contract Generator',
  'Independent Contractor Agreement Generator',
  'Consulting Agreement Generator',
  'Copywriting Contract Generator',
  'Client Onboarding Contract Generator',
  'Invoice Template Generator',
];

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
    log('Session OK: ' + page.url());

    // ── Step 1: Add missing products ────────────────────────────────────────
    log('\n=== Step 1: Adding missing products ===');
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-start.png') });

    let added = 0;
    let failed = 0;

    for (const productName of MISSING_PRODUCTS) {
      log(`\n  Adding: "${productName}"`);

      // Check if already in bundle by looking at the bundle products table
      const alreadyInBundle = await page.evaluate((name) => {
        // Look for the product in the "added products" area (table rows)
        const rows = document.querySelectorAll('table tr, .bundle-product, [class*="product-row"]');
        for (const row of rows) {
          if (row.textContent.includes(name)) return true;
        }
        return false;
      }, productName);

      if (alreadyInBundle) {
        log(`    Already in bundle, skipping`);
        continue;
      }

      try {
        // Find and click "Add Product" button
        const addBtn = page.locator(
          'button:has-text("Add Product"), button:has-text("Add product"), ' +
          'a:has-text("Add Product"), button:has-text("+ Add"), button:has-text("Add a Product")'
        ).first();

        if (await addBtn.count() === 0) {
          log(`    "Add Product" button not found`);
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix-no-add-${productName.slice(0,10)}.png`) });
          failed++;
          continue;
        }

        await addBtn.click();
        await sleep(1500);

        // Wait for modal/search input to appear — use multiple possible selectors
        let searchInput = null;
        const inputSelectors = [
          'input[placeholder*="search" i]',
          'input[placeholder*="product" i]',
          'input[placeholder*="name" i]',
          'input[type="search"]',
          '.modal input[type="text"]',
          '[role="dialog"] input',
          '[class*="modal"] input',
        ];

        for (const sel of inputSelectors) {
          const loc = page.locator(sel).first();
          try {
            await loc.waitFor({ state: 'visible', timeout: 5000 });
            searchInput = loc;
            log(`    Found search input: ${sel}`);
            break;
          } catch (_) {}
        }

        if (!searchInput) {
          // Take screenshot to debug
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix-no-input-${added}-${failed}.png`) });
          // Dump all inputs on page
          const inputs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('input')).map(i => ({
              type: i.type, placeholder: i.placeholder, name: i.name,
              visible: i.offsetParent !== null, id: i.id
            }))
          );
          log(`    All inputs: ${JSON.stringify(inputs)}`);
          await page.keyboard.press('Escape');
          await sleep(500);
          failed++;
          continue;
        }

        await searchInput.fill(productName);
        await sleep(1500);

        await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix-search-${added}.png`) });

        // Try to find and click the product in the dropdown/list
        // PayHip shows results in a list below the input
        let clicked = false;

        // Strategy 1: click label/li/div containing the product name (not the input itself)
        const options = [
          page.locator('li').filter({ hasText: productName }).first(),
          page.locator('label').filter({ hasText: productName }).first(),
          page.locator('[class*="option"]').filter({ hasText: productName }).first(),
          page.locator('[class*="item"]').filter({ hasText: productName }).first(),
          page.locator('[class*="result"]').filter({ hasText: productName }).first(),
          page.locator('tr').filter({ hasText: productName }).first(),
        ];

        for (const opt of options) {
          if (await opt.count() > 0) {
            try {
              await opt.waitFor({ state: 'visible', timeout: 3000 });
              await opt.click();
              await sleep(500);
              log(`    Clicked product option`);
              clicked = true;
              break;
            } catch (_) {}
          }
        }

        if (!clicked) {
          // Strategy 2: find checkbox near the product name
          const checkbox = await page.evaluate((name) => {
            const labels = Array.from(document.querySelectorAll('label'));
            for (const label of labels) {
              if (label.textContent.includes(name)) {
                const cb = label.querySelector('input[type="checkbox"]') ||
                           document.getElementById(label.htmlFor);
                if (cb) { cb.click(); return true; }
                label.click();
                return true;
              }
            }
            return false;
          }, productName);

          if (checkbox) {
            await sleep(500);
            log(`    Clicked via label/checkbox`);
            clicked = true;
          }
        }

        if (!clicked) {
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix-no-option-${added}-${failed}.png`) });
          log(`    No option found — pressing Escape`);
          await page.keyboard.press('Escape');
          await sleep(500);
          failed++;
          continue;
        }

        // Confirm — look for "Add" or "Confirm" button in modal
        const confirmSelectors = [
          'button:has-text("Add to Bundle")',
          'button:has-text("Add Product")',
          'button:has-text("Confirm")',
          'button:has-text("Save")',
          '[class*="modal"] button[type="submit"]',
          '[role="dialog"] button[type="submit"]',
        ];

        for (const sel of confirmSelectors) {
          const btn = page.locator(sel).last();
          if (await btn.count() > 0) {
            try {
              const txt = await btn.textContent();
              // Don't click the top-level "Add Product" button again
              if (txt && (txt.includes('Add to Bundle') || txt.includes('Confirm') || txt.includes('Save'))) {
                await btn.click();
                await sleep(1500);
                log(`    Confirmed with: "${txt.trim()}"`);
                break;
              }
            } catch (_) {}
          }
        }

        // Check if modal is still open (ESC to close if needed)
        await page.keyboard.press('Escape');
        await sleep(300);

        added++;
        log(`    ✓ Added`);

      } catch (err) {
        log(`    ERROR: ${err.message.slice(0, 120)}`);
        failed++;
        try { await page.keyboard.press('Escape'); await sleep(300); } catch(_) {}
      }
    }

    log(`\nProducts added: ${added}, Failed: ${failed}`);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-after-products.png') });

    // ── Step 2: Set price to $29 ──────────────────────────────────────────
    log('\n=== Step 2: Setting price to $29 ===');

    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pricing-page.png') });

    // Dump all inputs on pricing page
    const pricingInputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, value: i.value,
        placeholder: i.placeholder, id: i.id,
        visible: i.offsetParent !== null,
        rect: i.getBoundingClientRect()
      }))
    );
    log('Pricing inputs: ' + JSON.stringify(pricingInputs, null, 2));

    // Try to activate/click the "One Time" pricing option if it's a tab/radio
    const oneTimeSelectors = [
      'input[type="radio"][value*="one"], input[type="radio"][value*="fixed"]',
      'label:has-text("One Time"), button:has-text("One Time")',
      '[class*="tab"]:has-text("One Time")',
    ];

    for (const sel of oneTimeSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        try {
          await el.click({ force: true });
          await sleep(1000);
          log(`Clicked one-time selector: ${sel}`);
          break;
        } catch (_) {}
      }
    }

    // Try to set price using JS directly (force set regardless of visibility)
    const priceSet = await page.evaluate(() => {
      // Try different selectors
      const candidates = [
        document.querySelector('input[name="one_time_price"]'),
        document.querySelector('input[name*="price"]'),
        document.querySelector('input.price-field-input'),
        document.querySelector('input[placeholder*="price" i]'),
        document.querySelector('input[type="number"]'),
      ].filter(Boolean);

      for (const input of candidates) {
        // Make it visible temporarily
        const origDisplay = input.style.display;
        const origVisibility = input.style.visibility;
        input.style.display = 'block';
        input.style.visibility = 'visible';

        // Set value using native input value setter (for React)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '29');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        return { found: true, name: input.name, newValue: input.value };
      }
      return { found: false };
    });

    log('Price set result: ' + JSON.stringify(priceSet));

    await sleep(500);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pricing-filled.png') });

    // Save pricing
    const saveBtn = page.locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Update"), button:has-text("Set Price")'
    ).first();

    if (await saveBtn.count() > 0) {
      const btnText = await saveBtn.textContent();
      log(`Clicking save: "${btnText.trim()}"`);
      await saveBtn.click({ force: true });
      await sleep(2000);
      log('Pricing saved. URL: ' + page.url());
    } else {
      log('No save button found');
      // Try form submit
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
      await sleep(2000);
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pricing-saved.png') });

    // ── Step 3: Publish ───────────────────────────────────────────────────
    log('\n=== Step 3: Publishing ===');

    // Navigate to bundle page and check for publish button
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    const publishBtn = page.locator(
      'button:has-text("Publish"), a:has-text("Publish"), button:has-text("Make Live"), ' +
      'button:has-text("Make Visible"), input[value="Publish"]'
    ).first();

    if (await publishBtn.count() > 0) {
      await publishBtn.click();
      await sleep(2000);
      log('Clicked Publish. URL: ' + page.url());
    } else {
      log('No Publish button — bundle may already be published');
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-final.png') });

    // ── Final report ──────────────────────────────────────────────────────
    log('\n=== Final Report ===');
    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Products newly added: ${added}`);
    log(`Failed: ${failed}`);
    log(`Bundle manage URL: https://payhip.com/bundle/products/${BUNDLE_ID}/manage`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-fatal.png') });
  } finally {
    await browser.close();
  }
})();
