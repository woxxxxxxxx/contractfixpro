/**
 * payhip-settings-debug.js
 * Debug settings page - check for iframes, wait for React, inspect all elements
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

    // ── Navigate via the manage page tabs (mimic real user clicking Settings) ─
    log('\n=== Navigate via Products tab ===');
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Click the Settings link in the tab bar
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const settingsLink = links.find(a => a.textContent.trim() === 'Settings' && a.href.includes('bundle'));
      if (settingsLink) settingsLink.click();
    });
    await sleep(3000);
    log('After Settings click: ' + page.url());
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'debug-settings.png') });

    // Check for iframes
    const iframes = page.frames();
    log('Frames count: ' + iframes.length);
    for (const frame of iframes) {
      log('  Frame URL: ' + frame.url());
    }

    // Get full body HTML to understand structure
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
    log('Body HTML: ' + bodyHTML);

    // Check if there's a React root or Vue app
    const appInfo = await page.evaluate(() => {
      const root = document.getElementById('root') || document.getElementById('app') ||
                   document.querySelector('[data-reactroot]') || document.querySelector('#vue-app');
      return root ? { found: true, id: root.id, childCount: root.children.length, innerHTML: root.innerHTML.slice(0, 500) } : { found: false };
    });
    log('App root: ' + JSON.stringify(appInfo));

    // Wait longer for any lazy loading
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'debug-settings-waited.png') });

    const bodyAfterWait = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 500),
      inputCount: document.querySelectorAll('input').length,
      formCount: document.querySelectorAll('form').length,
      childCount: document.body.children.length
    }));
    log('After wait: ' + JSON.stringify(bodyAfterWait));

    // Try scrolling to trigger lazy load
    await page.mouse.wheel(0, 500);
    await sleep(1000);

    const allInputsAfterScroll = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, textarea, [contenteditable]')).map(el => ({
        tag: el.tagName, name: el.name, id: el.id, type: el.type,
        placeholder: el.placeholder, value: (el.value || el.textContent || '').slice(0, 80),
        rect: el.getBoundingClientRect()
      }));
    });
    log('Inputs after scroll: ' + JSON.stringify(allInputsAfterScroll));

    // ── Try the bundle's Settings via the product edit route ─────────────────
    log('\n=== Try /bundle/settings/ with domcontentloaded ===');
    await page.goto(`https://payhip.com/bundle/settings/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(5000);  // Long wait for React

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'debug-settings-long.png') });

    const longWaitResult = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 1000),
      html: document.body.innerHTML.slice(0, 2000),
      inputCount: document.querySelectorAll('input').length,
      inputs: Array.from(document.querySelectorAll('input, textarea')).map(el => ({
        name: el.name, id: el.id, placeholder: el.placeholder,
        value: el.value.slice(0, 60), rect: el.getBoundingClientRect()
      }))
    }));
    log('Long wait body text: ' + longWaitResult.text);
    log('Long wait inputs: ' + JSON.stringify(longWaitResult.inputs));
    log('Long wait HTML: ' + longWaitResult.html);

    // ── Maybe it's a page with an accordion — look for the bundle name as link ─
    log('\n=== Check for inline edit / pencil icon on product page ===');
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Find the bundle row and look for its edit link
    const bundleEditLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      // Find the "Edit" link in the bundle's row
      const bundleEl = links.find(a => a.href.includes('rj4IU') && a.textContent.trim() === 'ContractFixPro Bundle');
      if (bundleEl) {
        let parent = bundleEl.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!parent) break;
          const editLink = Array.from(parent.querySelectorAll('a')).find(a => a.textContent.trim() === 'Edit');
          if (editLink) return { href: editLink.href, text: editLink.textContent.trim() };
          parent = parent.parentElement;
        }
      }
      // Also look for Manage and return that
      const manageLink = links.find(a => a.href.includes('rj4IU') && a.textContent.trim() === 'Manage');
      return manageLink ? { href: manageLink.href, manage: true } : null;
    });
    log('Bundle edit/manage link: ' + JSON.stringify(bundleEditLink));

    // Navigate to the bundle manage page and click Settings
    await page.goto('https://payhip.com/bundle/products/rj4IU', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    log('Bundle manage URL: ' + page.url());
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'debug-manage.png') });

    // Get all tab URLs
    const tabLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const rect = a.getBoundingClientRect();
        return rect.width > 0 && a.href && a.href.includes('payhip.com/bundle');
      }).map(a => ({ text: a.textContent.trim(), href: a.href }));
    });
    log('Tab links: ' + JSON.stringify(tabLinks));

    // Actually navigate to /bundle/settings and inspect EVERY element (no filter)
    log('\n=== Unfiltered DOM inspection of Settings ===');
    await page.goto(`https://payhip.com/bundle/settings/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(4000);

    const allElements = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10 && el.children.length === 0) {
          const text = (el.textContent || el.value || '').trim().slice(0, 60);
          if (text) els.push({
            tag: el.tagName,
            text,
            class: el.className.slice(0, 40),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
          });
        }
      });
      return els.slice(0, 60);
    });
    log('All visible leaf elements: ' + JSON.stringify(allElements, null, 2));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'debug-settings-final.png') });

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'debug-fatal.png') });
  } finally {
    await browser.close();
  }
})();
