/**
 * payhip-price-intercept.js
 * Intercepts the pricing save request to get the endpoint,
 * then replays it directly to set $29 price.
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
    headless: false, slowMo: 80, viewport: { width: 1280, height: 1200 }  // taller viewport
  });
  const page = browser.pages()[0] || await browser.newPage();

  // Intercept all requests to find the pricing save endpoint
  const capturedRequests = [];
  page.on('request', req => {
    const method = req.method();
    const url = req.url();
    if ((method === 'POST' || method === 'PUT') && url.includes('payhip.com')) {
      const postData = req.postData() || '';
      capturedRequests.push({ method, url, postData: postData.slice(0, 200) });
      log(`CAPTURED REQUEST: ${method} ${url} | data: ${postData.slice(0, 100)}`);
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

    // Click Add Pricing Plan
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button'));
      for (const b of btns) {
        if (b.textContent.includes('Add Pricing Plan')) { b.click(); return; }
      }
    });
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'intercept-modal.png') });

    // Get modal + button positions (with taller viewport)
    const positions = await page.evaluate(() => {
      const modal = document.getElementById('add-edit-pricing-plan-modal');
      const radio = document.querySelector('input[name="pricing_type"][value="one-time"]');
      const priceInput = document.querySelector('input[name="one_time_price"]');
      const nameInput = document.querySelector('input[name="name"]');
      const saveBtn = document.querySelector('button.js-save-changes-button');
      const footer = modal ? modal.querySelector('.modal-footer') : null;
      const cancelBtn = modal ? modal.querySelector('button:not(.js-save-changes-button)') : null;

      return {
        modalRect: modal ? modal.getBoundingClientRect() : null,
        modalBodyRect: modal ? modal.querySelector('.modal-body')?.getBoundingClientRect() : null,
        footerRect: footer ? footer.getBoundingClientRect() : null,
        footerHTML: footer ? footer.innerHTML.slice(0, 200) : null,
        radioRect: radio ? radio.getBoundingClientRect() : null,
        priceRect: priceInput ? priceInput.getBoundingClientRect() : null,
        nameRect: nameInput ? nameInput.getBoundingClientRect() : null,
        saveBtnRect: saveBtn ? saveBtn.getBoundingClientRect() : null,
        saveBtnVisible: saveBtn ? saveBtn.offsetParent !== null : false,
        cancelBtnText: cancelBtn ? cancelBtn.textContent.trim() : null,
        cancelBtnRect: cancelBtn ? cancelBtn.getBoundingClientRect() : null,
        viewportH: window.innerHeight,
      };
    });
    log('Positions: ' + JSON.stringify(positions, null, 2));

    // Fill form via mouse clicks at correct coordinates
    if (positions.radioRect && positions.radioRect.width > 0) {
      await page.mouse.click(
        positions.radioRect.x + positions.radioRect.width/2,
        positions.radioRect.y + positions.radioRect.height/2
      );
      await sleep(300);
      log('Clicked one-time radio');
    }

    if (positions.priceRect && positions.priceRect.width > 0) {
      await page.mouse.click(
        positions.priceRect.x + positions.priceRect.width/2,
        positions.priceRect.y + positions.priceRect.height/2,
        { clickCount: 3 }
      );
      await sleep(200);
      await page.keyboard.type('29');
      log('Typed price 29');
    }

    if (positions.nameRect && positions.nameRect.width > 0) {
      await page.mouse.click(
        positions.nameRect.x + positions.nameRect.width/2,
        positions.nameRect.y + positions.nameRect.height/2
      );
      await sleep(200);
      await page.keyboard.type('Standard');
      log('Typed name Standard');
    }

    // Try to click save button if it has visible coordinates
    if (positions.saveBtnRect && positions.saveBtnRect.width > 0) {
      await page.mouse.click(
        positions.saveBtnRect.x + positions.saveBtnRect.width/2,
        positions.saveBtnRect.y + positions.saveBtnRect.height/2
      );
      log(`Clicked save at (${positions.saveBtnRect.x}, ${positions.saveBtnRect.y})`);
    } else {
      // Force save via JS — bypass all visibility
      log('Trying force JS submit...');
      const forceResult = await page.evaluate(() => {
        const modal = document.getElementById('add-edit-pricing-plan-modal');
        if (!modal) return 'no-modal';

        // Get all buttons
        const allBtns = Array.from(modal.querySelectorAll('button'));
        const info = allBtns.map(b => ({
          text: b.textContent.trim(),
          class: b.className,
          display: window.getComputedStyle(b).display,
          visibility: window.getComputedStyle(b).visibility,
          opacity: window.getComputedStyle(b).opacity,
          rect: b.getBoundingClientRect()
        }));

        // Force-reveal and click the save button
        const saveBtn = modal.querySelector('button.js-save-changes-button');
        if (saveBtn) {
          // Override styles
          saveBtn.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;top:10px!important;left:10px!important;z-index:99999!important;';
          const rect = saveBtn.getBoundingClientRect();
          return { info, rect, text: saveBtn.textContent.trim() };
        }
        return { info, noSaveBtn: true };
      });
      log('Force result: ' + JSON.stringify(forceResult));
      await sleep(500);

      // Now click at coordinates of force-revealed button
      const btnPos = await page.evaluate(() => {
        const btn = document.querySelector('button.js-save-changes-button');
        if (btn) return btn.getBoundingClientRect();
        return null;
      });
      log('Force button pos: ' + JSON.stringify(btnPos));

      if (btnPos && btnPos.width > 0) {
        await page.mouse.click(btnPos.x + btnPos.width/2, btnPos.y + btnPos.height/2);
        log(`Clicked force-revealed save button at (${btnPos.x}, ${btnPos.y})`);
      }
    }

    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'intercept-after-save.png') });
    log('URL after save: ' + page.url());
    log('Captured requests: ' + JSON.stringify(capturedRequests, null, 2));

    const pageText = await page.evaluate(() => document.body.innerText);
    const success = pageText.includes('Standard') || (pageText.includes('29') && !pageText.includes('no active pricing plans'));
    log('Success: ' + success);
    log('Page text: ' + pageText.slice(0, 400));

    // If we captured a request, re-play it
    if (capturedRequests.length === 0 && !success) {
      log('\nNo request captured and save failed. Trying direct fetch...');

      // Try to discover the pricing API endpoint
      const apiResult = await page.evaluate(async () => {
        const endpoints = [
          '/bundle/pricing-plan/add',
          '/bundle/pricing/add',
          '/api/bundle/pricing',
          '/bundle/add-pricing-plan',
        ];

        for (const endpoint of endpoints) {
          const fd = new FormData();
          fd.append('product_key', 'rj4IU');
          fd.append('pricing_type', 'one-time');
          fd.append('one_time_price', '29');
          fd.append('name', 'Standard');

          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              body: fd,
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
              credentials: 'same-origin'
            });
            const text = await resp.text();
            if (resp.status < 400) {
              return { endpoint, status: resp.status, text: text.slice(0, 200) };
            }
          } catch(e) {}
        }
        return { tried: endpoints, failed: true };
      });
      log('API result: ' + JSON.stringify(apiResult));
    }

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'intercept-fatal.png') });
  } finally {
    log('All captured requests: ' + JSON.stringify(capturedRequests, null, 2));
    await browser.close();
  }
})();
