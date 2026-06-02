/**
 * payhip-publish-bundle.js
 * Finds the ContractFixPro Bundle product (DRAFT) and publishes it.
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SESSION_DIR = path.join(__dirname, 'browser-session');

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1280, height: 800 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    log('URL: ' + page.url());

    // The bundle ID is rj4IU — navigate directly to its manage/edit page
    // Try the manage URL first
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Find the bundle's Manage button (it shows as DRAFT)
    // The bundle should be the first product (ContractFixPro Bundle - All 20 Contracts)
    await page.screenshot({ path: path.join(__dirname, 'bundle-before.png') });

    // Click "Manage" for the bundle (only bundle has Manage instead of Edit)
    const manageBtn = page.locator('button:has-text("Manage"), a:has-text("Manage")').first();
    if (await manageBtn.count() > 0) {
      await manageBtn.click();
      await page.waitForTimeout(2000);
      log('Manage URL: ' + page.url());
    } else {
      // Try direct URL for bundle edit
      log('Manage button not found, trying direct edit URL...');
      await page.goto('https://payhip.com/bundle/' + 'rj4IU' + '/edit', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      log('Direct edit URL: ' + page.url());
    }

    await page.screenshot({ path: path.join(__dirname, 'bundle-manage.png') });

    // Look for "Publish" button or visibility toggle
    // PayHip bundles may have a "Publish" button or a "Make Visible" option
    const publishBtn = page.locator(
      'button:has-text("Publish"), button:has-text("Make Visible"), ' +
      'button:has-text("Set as Active"), input[value="Publish"], ' +
      'a:has-text("Publish")'
    ).first();

    if (await publishBtn.count() > 0) {
      log('Found publish button, clicking...');
      await publishBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(__dirname, 'bundle-after-publish.png') });
      log('Clicked publish. URL: ' + page.url());
    } else {
      // Look for a status toggle/radio/select
      log('No publish button found, looking for status controls...');
      const statusInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, button'));
        return inputs.map(el => ({
          tag: el.tagName,
          type: el.type || '',
          name: el.name || '',
          value: el.value || '',
          text: el.textContent?.trim()?.slice(0, 50) || '',
          visible: el.offsetParent !== null
        })).filter(el => el.visible && (
          /publish|visible|active|status|draft/i.test(el.text + el.name + el.value)
        ));
      });
      log('Status controls found: ' + JSON.stringify(statusInfo, null, 2));
      await page.screenshot({ path: path.join(__dirname, 'bundle-status-controls.png') });
    }

    // Go back to products to verify
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(__dirname, 'bundle-verify.png') });

    // Check if DRAFT badge is gone
    const draftVisible = await page.evaluate(() => {
      const drafts = Array.from(document.querySelectorAll('*'));
      return drafts.some(el => el.textContent.trim() === 'DRAFT' && el.offsetParent !== null);
    });
    log(draftVisible ? 'DRAFT badge still visible — manual action needed' : '✓ No DRAFT badge — bundle is published!');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
  } finally {
    await browser.close();
  }
})();
