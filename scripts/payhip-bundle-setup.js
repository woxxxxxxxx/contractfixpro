/**
 * payhip-bundle-setup.js
 * 1. Navigate to bundle manage page
 * 2. Add all 20 contract products
 * 3. Set price to $29
 * 4. Publish
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

const PRODUCTS = [
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

const BUNDLE_ID = 'rj4IU';

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 80, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    // Verify session
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    log('Logged in: ' + page.url());

    // ── Step 1: Navigate to bundle manage page ────────────────────────────────
    log('\n=== Step 1: Navigate to bundle manage page ===');
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(2000);
    log('Bundle manage URL: ' + page.url());
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bundle-manage.png') });

    // ── Step 2: Add all 20 products ───────────────────────────────────────────
    log('\n=== Step 2: Adding products ===');
    let added = 0;
    let alreadyPresent = 0;
    let failed = 0;

    for (const productName of PRODUCTS) {
      log(`  Adding: "${productName}"`);
      try {
        // Check if already added
        const alreadyAdded = await page.evaluate((name) => {
          const text = document.body.innerText;
          return text.includes(name);
        }, productName);

        if (alreadyAdded) {
          // Could be in the list OR in the search results — need to verify it's actually added
          // Check if there's a remove button next to it
          const isInBundle = await page.evaluate((name) => {
            const els = Array.from(document.querySelectorAll('*'));
            for (const el of els) {
              if (el.textContent.trim() === name || el.textContent.includes(name)) {
                // Check if parent row has a "remove" indicator
                const row = el.closest('tr, li, [class*="row"], [class*="item"]');
                if (row) {
                  const hasRemove = row.querySelector('[class*="remove"], [class*="delete"], button[class*="remove"]');
                  if (hasRemove) return true;
                }
              }
            }
            return false;
          }, productName);

          if (isInBundle) {
            log(`    Already in bundle`);
            alreadyPresent++;
            continue;
          }
        }

        // Click "Add Product" button
        const addBtn = page.locator(
          'button:has-text("Add Product"), button:has-text("Add product"), ' +
          'a:has-text("Add Product"), button:has-text("+ Add")'
        ).first();

        if (await addBtn.count() === 0) {
          log(`    "Add Product" button not found — taking screenshot`);
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `bundle-no-add-btn.png`) });
          failed++;
          break;
        }

        await addBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCRIPTS_DIR, `bundle-add-modal.png`) });

        // Search for the product in the modal/dropdown
        const searchInput = page.locator(
          'input[placeholder*="search" i], input[placeholder*="product" i], ' +
          'input[type="search"], input[type="text"]'
        ).first();

        if (await searchInput.count() > 0) {
          await searchInput.fill(productName);
          await page.waitForTimeout(1000);
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `bundle-search-${added}.png`) });
        }

        // Click the product from the list
        const productOption = page.locator('label, li, tr, div[class*="option"], div[class*="item"]')
          .filter({ hasText: productName }).first();

        if (await productOption.count() > 0) {
          await productOption.click();
          await page.waitForTimeout(500);
          log(`    Selected in list`);
        } else {
          // Try checkbox approach
          const checkbox = page.locator(`input[type="checkbox"]`).filter({ hasText: productName }).first();
          if (await checkbox.count() > 0) {
            await checkbox.check();
            await page.waitForTimeout(500);
          } else {
            log(`    Product option not found in modal`);
            // Try pressing Escape to close modal and continue
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            failed++;
            continue;
          }
        }

        // Confirm/submit the selection
        const confirmBtn = page.locator(
          'button:has-text("Add"), button:has-text("Confirm"), ' +
          'button:has-text("Save"), button[type="submit"]'
        ).last();

        if (await confirmBtn.count() > 0) {
          const btnText = await confirmBtn.textContent();
          if (!btnText.includes('Add Product') && !btnText.includes('+ Add')) {
            await confirmBtn.click();
            await page.waitForTimeout(1500);
          }
        }

        added++;
        log(`    ✓ Added`);

      } catch (err) {
        log(`    ERROR: ${err.message.slice(0, 100)}`);
        failed++;
        try { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } catch(_) {}
      }
    }

    log(`\nProducts added: ${added}, Already present: ${alreadyPresent}, Failed: ${failed}`);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bundle-after-products.png') });

    // ── Step 3: Set price to $29 ──────────────────────────────────────────────
    log('\n=== Step 3: Setting price to $29 ===');

    // Look for a "Pricing" tab
    const pricingTab = page.locator(
      'a:has-text("Pricing"), button:has-text("Pricing"), [role="tab"]:has-text("Pricing")'
    ).first();

    if (await pricingTab.count() > 0) {
      await pricingTab.click();
      await page.waitForTimeout(1500);
      log('Clicked Pricing tab. URL: ' + page.url());
    } else {
      // Try direct URL
      log('No Pricing tab found, trying direct URL...');
      await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/pricing`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bundle-pricing.png') });

    // Find and set price input
    const priceInput = page.locator('input[name*="price" i], input[placeholder*="price" i], input[type="number"]').first();
    if (await priceInput.count() > 0) {
      await priceInput.click({ clickCount: 3 });
      await priceInput.fill('29');
      await page.waitForTimeout(300);
      log('Set price to 29');

      // Save pricing
      const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        log('Saved pricing');
      }
    } else {
      log('Price input not found');
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bundle-pricing-notfound.png') });
    }

    // ── Step 4: Publish ───────────────────────────────────────────────────────
    log('\n=== Step 4: Publishing bundle ===');

    const publishBtn = page.locator(
      'button:has-text("Publish"), a:has-text("Publish"), button:has-text("Make Live")'
    ).first();

    if (await publishBtn.count() > 0) {
      await publishBtn.click();
      await page.waitForTimeout(2000);
      log('Clicked Publish. URL: ' + page.url());
    } else {
      log('No Publish button found — bundle may already be published');
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bundle-final.png') });

    // ── Step 5: Verify and report ─────────────────────────────────────────────
    log('\n=== Step 5: Report ===');
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const isDraft = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).some(el =>
        el.textContent.trim() === 'DRAFT' && el.offsetParent !== null
      );
    });

    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Products added in this run: ${added}`);
    log(`Already present: ${alreadyPresent}`);
    log(`Failed: ${failed}`);
    log(`Published: ${isDraft ? 'NO (still DRAFT)' : 'YES ✓'}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bundle-fatal.png') });
  } finally {
    await browser.close();
  }
})();
