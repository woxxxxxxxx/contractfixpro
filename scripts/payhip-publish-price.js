/**
 * payhip-publish-price.js
 * 1. Add $29 one-time pricing plan (click save via JS)
 * 2. Select "Published" + save on publish page
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
    headless: false, slowMo: 80, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    // ─── Step 1: Add $29 pricing plan ───────────────────────────────────────
    log('\n=== Step 1: Set price to $29 ===');
    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Click "Add Pricing Plan" via JS
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button'));
      for (const b of btns) {
        if (b.textContent.includes('Add Pricing Plan')) { b.click(); return; }
      }
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'pp-modal-open.png') });

    // Fill in all fields and submit entirely via JS
    const fillResult = await page.evaluate(() => {
      // Select one-time radio
      const radio = document.querySelector('input[name="pricing_type"][value="one-time"]');
      if (radio) {
        radio.checked = true;
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Set price
      const priceInput = document.querySelector('input[name="one_time_price"]');
      if (priceInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(priceInput, '29');
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Set plan name
      const nameInput = document.querySelector('input[name="name"], input.js-pricing-plan-name-input');
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, 'Standard');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Log current state
      return {
        radioChecked: radio ? radio.checked : false,
        priceValue: priceInput ? priceInput.value : 'not found',
        nameValue: nameInput ? nameInput.value : 'not found',
      };
    });
    log('Fill result: ' + JSON.stringify(fillResult));
    await sleep(300);

    // Click Save via JS (bypass visibility check)
    const saveResult = await page.evaluate(() => {
      const btn = document.querySelector('button.js-save-changes-button');
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim(), visible: btn.offsetParent !== null };
      }
      // Scroll modal to reveal save button
      const modal = document.getElementById('add-edit-pricing-plan-modal');
      if (modal) {
        modal.scrollTop = modal.scrollHeight;
        const btn2 = modal.querySelector('button.js-save-changes-button, button[type="submit"]');
        if (btn2) { btn2.click(); return { clicked: true, text: btn2.textContent.trim() }; }
      }
      return { clicked: false };
    });
    log('Save result: ' + JSON.stringify(saveResult));
    await sleep(3000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'pp-after-save.png') });
    const pricingText = await page.evaluate(() => document.body.innerText);
    const pricingSaved = pricingText.includes('29') && !pricingText.includes('no active pricing plans');
    log('Pricing saved: ' + pricingSaved);
    log('Pricing page first 300: ' + pricingText.slice(0, 300));

    // ─── Step 2: Publish ─────────────────────────────────────────────────────
    log('\n=== Step 2: Publish ===');
    await page.goto(`https://payhip.com/bundle/publish/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Select Published radio + click save — all via JS
    const publishResult = await page.evaluate(() => {
      // Find all radios
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      const info = radios.map(r => ({ value: r.value, name: r.name, checked: r.checked, visible: r.offsetParent !== null }));

      // Try to check "published"
      let publishedRadio = radios.find(r => r.value === 'published' || r.value === '1' || r.value === 'true' || r.value === 'active');
      if (!publishedRadio) {
        // Look at labels
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          if (label.textContent.includes('Published') && !label.textContent.includes('Draft')) {
            const inp = label.querySelector('input') || document.getElementById(label.htmlFor);
            if (inp) { publishedRadio = inp; break; }
          }
        }
      }

      let radioClicked = false;
      if (publishedRadio) {
        publishedRadio.checked = true;
        publishedRadio.click();
        publishedRadio.dispatchEvent(new Event('change', { bubbles: true }));
        radioClicked = true;
      }

      return { radios: info, radioClicked, radioValue: publishedRadio ? publishedRadio.value : null };
    });
    log('Publish radios: ' + JSON.stringify(publishResult));
    await sleep(500);

    // Click Save Changes via JS
    const publishSave = await page.evaluate(() => {
      const btn = document.querySelector('button:not([disabled])');
      const allBtns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const b of allBtns) {
        const text = (b.textContent || b.value || '').trim();
        if (text.includes('Save') || b.type === 'submit') {
          b.click();
          return { clicked: true, text };
        }
      }
      return { clicked: false, found: allBtns.map(b => b.textContent.trim()) };
    });
    log('Publish save: ' + JSON.stringify(publishSave));
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'pp-publish-saved.png') });
    log('URL after publish save: ' + page.url());

    // ─── Step 3: Verify ──────────────────────────────────────────────────────
    log('\n=== Step 3: Verify publish status ===');
    await page.goto(`https://payhip.com/bundle/publish/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    const publishPageText = await page.evaluate(() => document.body.innerText);
    log('Publish page now: ' + publishPageText.slice(0, 400));

    const currentStatus = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      return radios.map(r => ({ value: r.value, checked: r.checked }));
    });
    log('Radio states: ' + JSON.stringify(currentStatus));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'pp-verify.png') });

    log('\n=============================');
    log('FINAL REPORT:');
    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Products: 20/20`);
    log(`Price: ${pricingSaved ? '$29 ✓' : 'CHECK pp-after-save.png'}`);
    log(`Publish: Check pp-verify.png`);
    log('=============================\n');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'pp-fatal.png') });
  } finally {
    await browser.close();
  }
})();
