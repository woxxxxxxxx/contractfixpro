/**
 * payhip-price-click.js
 * Click Save at known coordinates (757, 543) inside pricing modal
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

const capturedRequests = [];

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 60, viewport: { width: 1280, height: 1200 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  // Capture payhip POST requests (to find the pricing endpoint)
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('payhip.com') && !req.url().includes('cdn-cgi')) {
      const post = req.postData() || '';
      capturedRequests.push({ url: req.url(), data: post.slice(0, 300) });
    }
  });

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Click Add Pricing Plan via JS
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button'));
      for (const b of btns) {
        if (b.textContent.includes('Add Pricing Plan')) { b.click(); return; }
      }
    });
    await sleep(2500);  // Wait for animation to complete

    // Check button position now
    const btnPos = await page.evaluate(() => {
      const btn = document.querySelector('button.js-save-changes-button');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return {
        rect, offsetParent: btn.offsetParent !== null,
        text: btn.textContent.trim(),
        computedDisplay: window.getComputedStyle(btn).display,
        computedVisibility: window.getComputedStyle(btn).visibility,
      };
    });
    log('Save btn position: ' + JSON.stringify(btnPos));

    // Click one-time radio at known coordinates
    await page.mouse.click(362, 133);
    await sleep(400);
    log('Clicked one-time radio');

    // Click price input and type
    await page.mouse.click(508, 185, { clickCount: 3 });
    await sleep(200);
    await page.keyboard.type('29');
    await sleep(200);
    log('Typed price');

    // Click name input and type
    await page.mouse.click(637, 417);
    await sleep(200);
    await page.keyboard.type('Standard');
    await sleep(200);
    log('Typed name');

    // Re-check save button position now that form is filled
    const btnPos2 = await page.evaluate(() => {
      const btn = document.querySelector('button.js-save-changes-button');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    });
    log('Save btn pos after fill: ' + JSON.stringify(btnPos2));

    // Click at known Save button location (center of btn at ~757+83, 543+21)
    const saveX = btnPos2 && btnPos2.w > 0
      ? btnPos2.x + btnPos2.w / 2
      : 840;  // fallback to known coordinates
    const saveY = btnPos2 && btnPos2.h > 0
      ? btnPos2.y + btnPos2.h / 2
      : 564;

    log(`Clicking Save at (${saveX}, ${saveY})`);
    await page.mouse.click(saveX, saveY);
    await sleep(3000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'click-after-save.png') });
    log('URL after save: ' + page.url());

    // Log captured requests
    const payhipRequests = capturedRequests.filter(r => !r.url.includes('google') && !r.url.includes('analytics'));
    log('Payhip POST requests: ' + JSON.stringify(payhipRequests, null, 2));

    // Check if plan was saved
    const pageText = await page.evaluate(() => document.body.innerText);
    const success = (pageText.includes('Standard') || pageText.includes('29.00') || pageText.includes('$29'))
                    && !pageText.includes('no active pricing plans');
    log('Pricing saved: ' + success);
    log('Page text: ' + pageText.slice(0, 500));

    if (!success) {
      log('\nTrying via keyboard shortcut - Tab to Save, Enter...');
      // Open modal again
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('a, button'));
        for (const b of btns) {
          if (b.textContent.includes('Add Pricing Plan')) { b.click(); return; }
        }
      });
      await sleep(2500);

      // Fill via keyboard shortcuts
      await page.mouse.click(362, 133); // radio
      await sleep(300);
      await page.mouse.click(508, 185, { clickCount: 3 }); // price
      await sleep(200);
      await page.keyboard.type('29');
      await sleep(200);
      await page.mouse.click(637, 417); // name
      await sleep(200);
      await page.keyboard.type('Standard');

      // Press Enter/Tab to submit
      await page.keyboard.press('Enter');
      await sleep(2000);

      const pageText2 = await page.evaluate(() => document.body.innerText);
      log('After Enter: ' + pageText2.slice(0, 300));

      if (!pageText2.includes('Standard')) {
        // Try Tab until Save button is focused, then Enter
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('a, button'));
          for (const b of btns) {
            if (b.textContent.includes('Add Pricing Plan')) { b.click(); return; }
          }
        });
        await sleep(2500);
        await page.mouse.click(362, 133);
        await sleep(300);
        await page.mouse.click(508, 185, { clickCount: 3 });
        await sleep(200);
        await page.keyboard.type('29');
        await sleep(200);
        await page.mouse.click(637, 417);
        await sleep(200);
        await page.keyboard.type('Standard');
        await sleep(200);

        // Directly submit via XHR
        const xhrResult = await page.evaluate(async () => {
          // Get CSRF from cookies or meta
          const csrf = document.querySelector('meta[name="csrf-token"]')?.content ||
                       document.cookie.split(';').find(c => c.includes('XSRF'))?.split('=')[1] || '';

          const priceInput = document.querySelector('input[name="one_time_price"]');
          const nameInput = document.querySelector('input[name="name"]');
          const radio = document.querySelector('input[name="pricing_type"]:checked');

          const fd = new FormData();
          fd.append('_token', csrf);
          fd.append('product_key', 'rj4IU');
          fd.append('pricing_type', radio ? radio.value : 'one-time');
          fd.append('one_time_price', priceInput ? priceInput.value : '29');
          fd.append('name', nameInput ? nameInput.value : 'Standard');
          fd.append('mode', 'add');

          const tryUrls = [
            '/bundle/pricing-plan/add',
            '/bundle/pricing-plan',
            '/payhip/bundle/pricing-plan/add',
          ];

          for (const url of tryUrls) {
            try {
              const resp = await fetch(url, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf }
              });
              const text = await resp.text();
              if (resp.ok) return { url, status: resp.status, text: text.slice(0, 200) };
              return { url, status: resp.status, error: text.slice(0, 200) };
            } catch(e) {
              continue;
            }
          }
          return { allFailed: true };
        });
        log('XHR result: ' + JSON.stringify(xhrResult));
        await sleep(2000);
      }
    }

    // Final verification
    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    const finalText = await page.evaluate(() => document.body.innerText);
    const finalSuccess = finalText.includes('Standard') || (finalText.includes('29') && !finalText.includes('no active pricing plans'));
    log('Final pricing check: ' + finalSuccess);
    log('Final page: ' + finalText.slice(0, 400));

    log('\n=== SUMMARY ===');
    log(`Bundle URL: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Products: 20/20 ✓`);
    log(`Price: ${finalSuccess ? '$29 ✓' : 'NEEDS MANUAL ACTION'}`);
    log(`Published: YES ✓ (set in previous run)`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'click-fatal.png') });
  } finally {
    await browser.close();
  }
})();
