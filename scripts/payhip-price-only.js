/**
 * payhip-price-only.js
 * Set $29 pricing plan by actually interacting with the modal using real mouse events
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

    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Click Add Pricing Plan
    await page.locator('a:has-text("Add Pricing Plan")').first().click();
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'price-modal.png') });

    // Dump position of key modal elements
    const elements = await page.evaluate(() => {
      const result = {};

      const radio = document.querySelector('input[name="pricing_type"][value="one-time"]');
      if (radio) result.oneTimeRadio = radio.getBoundingClientRect();

      const priceInput = document.querySelector('input[name="one_time_price"]');
      if (priceInput) result.priceInput = priceInput.getBoundingClientRect();

      const nameInput = document.querySelector('input[name="name"]');
      if (nameInput) result.nameInput = nameInput.getBoundingClientRect();

      const saveBtn = document.querySelector('button.js-save-changes-button');
      if (saveBtn) result.saveBtn = { ...saveBtn.getBoundingClientRect(), visible: saveBtn.offsetParent !== null };

      const modal = document.getElementById('add-edit-pricing-plan-modal');
      if (modal) {
        const body = modal.querySelector('.modal-body');
        result.modalBody = body ? body.getBoundingClientRect() : null;
        result.modalScrollHeight = body ? body.scrollHeight : 0;
        result.modalClientHeight = body ? body.clientHeight : 0;
      }

      return result;
    });
    log('Element positions: ' + JSON.stringify(elements, null, 2));

    // Click one-time radio using actual mouse if it has valid coordinates
    if (elements.oneTimeRadio && elements.oneTimeRadio.width > 0) {
      const x = elements.oneTimeRadio.x + elements.oneTimeRadio.width / 2;
      const y = elements.oneTimeRadio.y + elements.oneTimeRadio.height / 2;
      await page.mouse.click(x, y);
      await sleep(300);
      log(`Clicked one-time radio at (${x}, ${y})`);
    }

    // Click and fill price input
    if (elements.priceInput && elements.priceInput.width > 0) {
      const x = elements.priceInput.x + elements.priceInput.width / 2;
      const y = elements.priceInput.y + elements.priceInput.height / 2;
      await page.mouse.click(x, y, { clickCount: 3 });
      await sleep(200);
      await page.keyboard.type('29');
      await sleep(200);
      log(`Filled price at (${x}, ${y})`);
    }

    // Fill name input
    if (elements.nameInput && elements.nameInput.width > 0) {
      const x = elements.nameInput.x + elements.nameInput.width / 2;
      const y = elements.nameInput.y + elements.nameInput.height / 2;
      await page.mouse.click(x, y);
      await sleep(200);
      await page.keyboard.type('Standard');
      await sleep(200);
      log(`Filled name at (${x}, ${y})`);
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'price-filled.png') });

    // Scroll modal body to reveal save button
    if (elements.modalBody) {
      await page.evaluate(() => {
        const modal = document.getElementById('add-edit-pricing-plan-modal');
        const body = modal ? modal.querySelector('.modal-body') : null;
        if (body) body.scrollTop = body.scrollHeight;
      });
      await sleep(500);
      log('Scrolled modal body');
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'price-scrolled.png') });

    // Get save button position again (after scroll)
    const saveBtnPos = await page.evaluate(() => {
      const saveBtn = document.querySelector('button.js-save-changes-button');
      if (!saveBtn) return null;
      return {
        rect: saveBtn.getBoundingClientRect(),
        visible: saveBtn.offsetParent !== null,
        text: saveBtn.textContent.trim()
      };
    });
    log('Save button after scroll: ' + JSON.stringify(saveBtnPos));

    // Click save button
    if (saveBtnPos && saveBtnPos.rect.width > 0 && saveBtnPos.rect.height > 0) {
      const x = saveBtnPos.rect.x + saveBtnPos.rect.width / 2;
      const y = saveBtnPos.rect.y + saveBtnPos.rect.height / 2;
      await page.mouse.click(x, y);
      log(`Clicked save button at (${x}, ${y})`);
    } else {
      // If still not visible, try the modal footer
      const footerResult = await page.evaluate(() => {
        const footer = document.querySelector('.modal-footer');
        if (footer) {
          const rect = footer.getBoundingClientRect();
          const btn = footer.querySelector('button');
          if (btn) {
            const btnRect = btn.getBoundingClientRect();
            return { footerRect: rect, btnRect, btnText: btn.textContent.trim() };
          }
          return { footerRect: rect };
        }
        return null;
      });
      log('Footer: ' + JSON.stringify(footerResult));

      if (footerResult && footerResult.btnRect && footerResult.btnRect.width > 0) {
        await page.mouse.click(
          footerResult.btnRect.x + footerResult.btnRect.width / 2,
          footerResult.btnRect.y + footerResult.btnRect.height / 2
        );
        log('Clicked footer button');
      } else {
        // Last resort: use keyboard Tab+Enter to submit
        await page.keyboard.press('Tab');
        await sleep(100);
        await page.keyboard.press('Tab');
        await sleep(100);
        await page.keyboard.press('Enter');
        log('Pressed Tab+Tab+Enter to submit');
      }
    }

    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'price-after-save.png') });
    log('URL after save: ' + page.url());

    // Verify
    const finalText = await page.evaluate(() => document.body.innerText);
    const hasPlan = finalText.includes('Standard') || (finalText.includes('29') && !finalText.includes('no active pricing plans'));
    log('Pricing plan saved: ' + hasPlan);
    log('Page text: ' + finalText.slice(0, 500));

    log('\n=== DONE ===');
    log(`Bundle: https://payhip.com/bundle/products/${BUNDLE_ID}`);
    log(`Pricing plan: ${hasPlan ? '$29 ✓' : 'FAILED — check screenshots'}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'price-fatal.png') });
  } finally {
    await browser.close();
  }
})();
