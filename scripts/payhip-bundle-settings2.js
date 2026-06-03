/**
 * payhip-bundle-settings2.js
 * Deep-inspect Settings and Pages builder to find editable fields
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

const TITLE = 'ContractFixPro Bundle - All 20 Contract Templates';
const DESCRIPTION = 'Get all 20 professional contract templates in one purchase. Includes Freelance, NDA, Service Agreement, Photography, Web Design, and 15 more. Editable Word & PDF format. Instant download.';

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 80, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    // ── SETTINGS: wait for React to render ────────────────────────────────────
    log('\n=== Settings (with full load wait) ===');
    await page.goto(`https://payhip.com/bundle/settings/${BUNDLE_ID}`, {
      waitUntil: 'networkidle', timeout: 30000
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs2-settings.png') });

    // Full DOM dump of all interactive elements
    const settingsDom = await page.evaluate(() => {
      const all = [];
      document.querySelectorAll('input, textarea, select, button, [contenteditable]').forEach(el => {
        const rect = el.getBoundingClientRect();
        all.push({
          tag: el.tagName,
          type: el.type || '',
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          value: (el.value || el.textContent || '').slice(0, 80),
          contenteditable: el.contentEditable,
          class: el.className.slice(0, 60),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          visible: rect.width > 0 && rect.height > 0
        });
      });
      return all;
    });
    log('Settings DOM elements: ' + JSON.stringify(settingsDom, null, 2));

    // Get full page text to see what's on the page
    const settingsText = await page.evaluate(() => document.body.innerText);
    log('Settings page text: ' + settingsText.slice(0, 1000));

    // ── Try clicking the Settings nav item to ensure we're on the right tab ──
    // Bundle settings might be at a different URL
    const settingsNavLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const rect = a.getBoundingClientRect();
        return rect.width > 0 && (a.textContent.includes('Settings') || a.href.includes('settings'));
      }).map(a => ({ text: a.textContent.trim(), href: a.href }));
    });
    log('Settings nav links: ' + JSON.stringify(settingsNavLinks));

    // If we see the bundle title as text, look for edit buttons
    const editBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).filter(el => {
        const rect = el.getBoundingClientRect();
        const text = el.textContent.trim().toLowerCase();
        return rect.width > 0 && (text === 'edit' || text.includes('edit title') || text.includes('rename'));
      }).map(el => ({ tag: el.tagName, text: el.textContent.trim(), href: el.href || '' }));
    });
    log('Edit buttons: ' + JSON.stringify(editBtns));

    // ── Try the bundle edit URL (not /settings but /edit) ────────────────────
    log('\n=== Trying bundle edit URL ===');
    const editUrls = [
      `https://payhip.com/bundle/edit/${BUNDLE_ID}`,
      `https://payhip.com/product/edit/rj4IU`,
    ];

    for (const url of editUrls) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const urlNow = page.url();
      const title = await page.title();
      log(`Tried ${url} -> ${urlNow} (${title})`);

      if (!urlNow.includes('404') && urlNow !== 'https://payhip.com/') {
        await page.screenshot({ path: path.join(SCRIPTS_DIR, `bs2-edit-${url.split('/').pop()}.png`) });

        const editInputs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('input, textarea'))
            .filter(el => el.getBoundingClientRect().width > 0)
            .map(el => ({
              tag: el.tagName, name: el.name, id: el.id,
              placeholder: el.placeholder, value: el.value.slice(0, 80)
            }));
        });
        log('Edit inputs at ' + url + ': ' + JSON.stringify(editInputs));

        if (editInputs.length > 0) {
          log('Found inputs at: ' + urlNow);
          break;
        }
      }
    }

    // ── Try the Pages builder URL directly ────────────────────────────────────
    log('\n=== Pages Builder ===');
    const builderUrl = `https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU`;
    await page.goto(builderUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(4000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs2-builder.png') });
    log('Builder URL: ' + page.url());
    log('Builder title: ' + await page.title());

    const builderText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    log('Builder text: ' + builderText);

    const builderInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({
          tag: el.tagName, name: el.name, id: el.id,
          placeholder: el.placeholder || '',
          value: (el.value || el.textContent || '').slice(0, 80),
          class: el.className.slice(0, 60)
        }));
    });
    log('Builder inputs: ' + JSON.stringify(builderInputs, null, 2));

    // ── Check the /b/rj4IU page source for editable fields ───────────────────
    log('\n=== Public page /b/rj4IU ===');
    await page.goto('https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL', { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs2-public.png') });
    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 800));
    log('Public page text: ' + publicText);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs2-fatal.png') });
  } finally {
    await browser.close();
  }
})();
