/**
 * payhip-bundle-fix2.js
 * 1. Debug and add remaining 4 missing products
 * 2. Set price to $29 by clicking the visible pricing tab UI
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

const BUNDLE_ID = 'rj4IU';
const MISSING = [
  'Independent Contractor Agreement Generator',
  'Copywriting Contract Generator',
  'Client Onboarding Contract Generator',
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
    log('Session OK');

    // ─── DEBUG: What does the Add Product modal look like? ───────────────────
    log('\n=== Step 0: Debug the Add Product modal ===');
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Dump all visible text elements to understand the page structure
    const pageInfo = await page.evaluate(() => {
      const visible = [];
      document.querySelectorAll('button, a, input, select, h1, h2, h3, p, label').forEach(el => {
        if (el.offsetParent !== null || el.getBoundingClientRect().width > 0) {
          const text = (el.textContent || el.value || el.placeholder || '').trim().slice(0, 60);
          if (text) visible.push({ tag: el.tagName, text, class: el.className.slice(0, 40) });
        }
      });
      return visible.slice(0, 50);
    });
    log('Visible elements: ' + JSON.stringify(pageInfo, null, 2));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix2-manage.png') });

    // ─── Step 1: Add missing products ───────────────────────────────────────
    log('\n=== Step 1: Adding missing products ===');
    let added = 0;

    for (const productName of MISSING) {
      log(`\n  Adding: "${productName}"`);

      try {
        // Reload the manage page fresh each time (cleaner state)
        await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
          waitUntil: 'domcontentloaded', timeout: 30000
        });
        await sleep(2000);

        // Check if product is already in bundle
        const alreadyAdded = await page.evaluate((name) => {
          return document.body.innerText.includes(name);
        }, productName);

        if (alreadyAdded) {
          log(`    May already be present — verifying...`);
          // Check if it's in the actual bundle list (not just search results placeholder)
          // Take screenshot to verify
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix2-already-${productName.slice(0,10)}.png`) });
        }

        // Click Add Product
        const addBtn = page.locator(
          'button:has-text("Add Product"), button:has-text("Add product"), ' +
          'button:has-text("Add a product"), a:has-text("Add Product")'
        ).first();

        if (await addBtn.count() === 0) {
          log(`    No "Add Product" button found`);
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix2-no-btn-${productName.slice(0,10)}.png`) });
          continue;
        }

        await addBtn.click();
        log(`    Clicked Add Product`);
        await sleep(2000); // Wait longer for modal to open

        await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix2-modal-${productName.slice(0,10)}.png`) });

        // Dump ALL inputs (including invisible) to understand modal structure
        const modalInputs = await page.evaluate(() =>
          Array.from(document.querySelectorAll('input')).map(i => ({
            type: i.type, placeholder: i.placeholder, name: i.name,
            id: i.id, class: i.className.slice(0, 60),
            visible: i.offsetParent !== null,
            rect: i.getBoundingClientRect()
          }))
        );
        log('    All inputs after clicking Add: ' + JSON.stringify(modalInputs));

        // Dump all visible text elements
        const modalVisible = await page.evaluate(() => {
          const visible = [];
          document.querySelectorAll('button, input, li, label, div[class*="modal"], div[class*="dialog"]').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top > 0) {
              const text = (el.textContent || el.value || el.placeholder || '').trim().slice(0, 60);
              if (text) visible.push({ tag: el.tagName, text, rect: {x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width)} });
            }
          });
          return visible.slice(0, 30);
        });
        log('    Visible elements in modal: ' + JSON.stringify(modalVisible));

        // Try search input with longer wait
        let searchFilled = false;
        const inputCandidates = [
          'input[placeholder="Search"]',
          'input[placeholder*="search" i]',
          'input[placeholder*="product" i]',
          '[class*="modal"] input',
          '[class*="dialog"] input',
          '[role="dialog"] input',
          'input[type="text"]:visible',
        ];

        for (const sel of inputCandidates) {
          const inputs = await page.locator(sel).all();
          for (const inp of inputs) {
            try {
              const box = await inp.boundingBox();
              if (box && box.width > 0 && box.height > 0) {
                await inp.fill(productName);
                await sleep(1500);
                log(`    Filled search input (${sel}) with product name`);
                searchFilled = true;
                break;
              }
            } catch(_) {}
          }
          if (searchFilled) break;
        }

        if (!searchFilled) {
          // Try clicking anywhere that might be the search area, then type
          log(`    Trying to click search area and type...`);
          try {
            // Press Tab a few times to find the search input
            await page.keyboard.press('Tab');
            await sleep(200);
            await page.keyboard.type(productName.slice(0, 5));
            await sleep(1000);
            const afterType = await page.evaluate(() =>
              Array.from(document.querySelectorAll('input')).map(i => ({
                value: i.value, visible: i.offsetParent !== null
              }))
            );
            log(`    After typing: ${JSON.stringify(afterType)}`);
          } catch(e) {}
        }

        await page.screenshot({ path: path.join(SCRIPTS_DIR, `fix2-search-${productName.slice(0,10)}.png`) });

        // Try to find the product in results
        let clicked = false;

        // Look for any list item, label, or div containing the product name
        const resultEls = await page.evaluate((name) => {
          const all = Array.from(document.querySelectorAll('li, label, tr, [class*="option"], [class*="item"], [class*="result"]'));
          return all.filter(el => {
            const rect = el.getBoundingClientRect();
            return el.textContent.includes(name) && rect.width > 0 && rect.height > 0;
          }).map(el => ({
            tag: el.tagName, text: el.textContent.trim().slice(0, 60),
            class: el.className.slice(0, 40)
          }));
        }, productName);

        log(`    Result elements for "${productName}": ${JSON.stringify(resultEls)}`);

        if (resultEls.length > 0) {
          // Click the first matching element
          const clickResult = await page.evaluate((name) => {
            const all = Array.from(document.querySelectorAll('li, label, tr, [class*="option"], [class*="item"]'));
            for (const el of all) {
              const rect = el.getBoundingClientRect();
              if (el.textContent.includes(name) && rect.width > 0 && rect.height > 0) {
                el.click();
                return { clicked: true, tag: el.tagName, text: el.textContent.trim().slice(0, 50) };
              }
            }
            return { clicked: false };
          }, productName);

          log(`    Click result: ${JSON.stringify(clickResult)}`);
          if (clickResult.clicked) {
            await sleep(500);
            clicked = true;
          }
        }

        if (!clicked) {
          log(`    Could not find/click product option`);
        }

        // Look for confirm button
        const confirmBtns = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.filter(b => {
            const rect = b.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && b.textContent.trim().length > 0;
          }).map(b => ({ text: b.textContent.trim().slice(0, 40), class: b.className.slice(0, 40) }));
        });
        log(`    Buttons: ${JSON.stringify(confirmBtns)}`);

        // Click Add/Confirm if visible
        const confirmClick = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for (const b of btns) {
            const rect = b.getBoundingClientRect();
            const txt = b.textContent.trim();
            if (rect.width > 0 && rect.height > 0 &&
                (txt === 'Add' || txt === 'Add to Bundle' || txt === 'Confirm' || txt === 'Save')) {
              b.click();
              return txt;
            }
          }
          return null;
        });

        if (confirmClick) {
          log(`    Clicked confirm: "${confirmClick}"`);
          await sleep(1500);
        }

        await page.keyboard.press('Escape');
        await sleep(500);

        if (clicked) {
          added++;
          log(`    ✓ Added (hopefully)`);
        }

      } catch (err) {
        log(`    ERROR: ${err.message.slice(0, 120)}`);
        try { await page.keyboard.press('Escape'); await sleep(300); } catch(_) {}
      }
    }

    log(`\nProducts attempted: ${MISSING.length}, clicked: ${added}`);

    // ─── Step 2: Set price to $29 ───────────────────────────────────────────
    log('\n=== Step 2: Setting price to $29 ===');

    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix2-pricing.png') });

    // Dump ALL visible elements on pricing page
    const pricingVisible = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 5 && rect.height > 5 && el.children.length === 0) {
          const text = (el.textContent || '').trim().slice(0, 60);
          if (text) els.push({ tag: el.tagName, text, class: el.className.slice(0, 40), rect: { x: Math.round(rect.x), y: Math.round(rect.y) } });
        }
      });
      return els.slice(0, 60);
    });
    log('Pricing visible elements: ' + JSON.stringify(pricingVisible, null, 2));

    // Try clicking the "One Time" pricing card/tab (it's probably a visible card)
    const clickedTab = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        const text = el.textContent.trim();
        if (rect.width > 0 && rect.height > 0 &&
            (text === 'One Time' || text === 'One-Time' || text.includes('One Time') && text.length < 30)) {
          el.click();
          return { clicked: true, text, tag: el.tagName };
        }
      }
      return { clicked: false };
    });
    log('Clicked pricing tab: ' + JSON.stringify(clickedTab));
    await sleep(1000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix2-pricing-after-tab.png') });

    // Now look for the price input that might have become visible
    const priceInputInfo = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input'));
      return all.map(i => ({
        name: i.name, value: i.value, type: i.type,
        visible: i.offsetParent !== null,
        rect: i.getBoundingClientRect()
      }));
    });
    log('Price inputs after tab click: ' + JSON.stringify(priceInputInfo));

    // Use JavaScript to directly submit the pricing form via XHR/fetch
    // First, get the CSRF token if any
    const csrfToken = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="csrf-token"], meta[name="_token"]');
      return meta ? meta.content : null;
    });
    log('CSRF token: ' + csrfToken);

    // Try to submit pricing via fetch API
    const fetchResult = await page.evaluate(async (bundleId, csrf) => {
      const formData = new FormData();
      formData.append('product_key', bundleId);
      formData.append('pricing_type', 'one-time');
      formData.append('one_time_price', '29');

      const headers = {};
      if (csrf) headers['X-CSRF-TOKEN'] = csrf;

      try {
        // Try the same-page form submission approach
        const form = document.querySelector('form');
        if (form) {
          const action = form.action || window.location.href;
          const method = form.method || 'POST';

          // Set input values
          const priceInput = form.querySelector('input[name="one_time_price"]');
          if (priceInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(priceInput, '29');
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
            priceInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Select one-time radio
          const oneTimeRadio = form.querySelector('input[name="pricing_type"][value="one-time"]');
          if (oneTimeRadio) {
            oneTimeRadio.checked = true;
            oneTimeRadio.dispatchEvent(new Event('change', { bubbles: true }));
          }

          return { formFound: true, action, inputSet: !!priceInput, radioSet: !!oneTimeRadio };
        }
        return { formFound: false };
      } catch(e) {
        return { error: e.message };
      }
    }, BUNDLE_ID, csrfToken);

    log('Fetch/form result: ' + JSON.stringify(fetchResult));

    await sleep(500);

    // Now try to click the save button using force
    const saveClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || '').trim();
        if (txt.includes('Save') || txt.includes('Update') || btn.type === 'submit' ||
            btn.className.includes('save') || btn.className.includes('js-save')) {
          btn.click();
          return { clicked: true, text: txt, class: btn.className.slice(0, 40) };
        }
      }
      return { clicked: false };
    });
    log('Save click: ' + JSON.stringify(saveClicked));
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix2-pricing-after-save.png') });
    log('URL after save: ' + page.url());

    // ─── Step 3: Report current state ───────────────────────────────────────
    log('\n=== Step 3: Check bundle state ===');
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix2-bundle-final.png') });

    const bundleText = await page.evaluate(() => document.body.innerText);
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

    const present = allProductNames.filter(n => bundleText.includes(n));
    const missing = allProductNames.filter(n => !bundleText.includes(n));

    log(`Products found in bundle page: ${present.length}/20`);
    log(`Present: ${JSON.stringify(present)}`);
    log(`Missing from page: ${JSON.stringify(missing)}`);
    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix2-fatal.png') });
  } finally {
    await browser.close();
  }
})();
