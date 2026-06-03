/**
 * payhip-bundle-settings.js
 * Update bundle title, description, page content, confirm price, publish
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
const HERO_TITLE = 'Get All 20 Contract Templates';
const HERO_SUBTITLE = 'One purchase. Instant access. Professional contracts for every freelancer.';

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 80, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();
  const results = {};

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK: ' + page.url());

    // ── SETTINGS TAB ──────────────────────────────────────────────────────────
    log('\n=== Settings Tab ===');
    await page.goto(`https://payhip.com/bundle/settings/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-settings.png') });
    log('Settings URL: ' + page.url());

    // Dump all inputs/textareas
    const settingsInputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="text"], input[type="email"], textarea, input:not([type])'))
        .map(el => ({
          tag: el.tagName, name: el.name, id: el.id,
          placeholder: el.placeholder, value: el.value.slice(0, 60),
          visible: el.offsetParent !== null
        }))
    );
    log('Settings inputs: ' + JSON.stringify(settingsInputs, null, 2));

    // Update title
    const titleUpdated = await page.evaluate((title) => {
      const candidates = [
        document.querySelector('input[name="name"]'),
        document.querySelector('input[name="title"]'),
        document.querySelector('input[placeholder*="title" i]'),
        document.querySelector('input[placeholder*="name" i]'),
      ].filter(Boolean);

      for (const input of candidates) {
        if (input.offsetParent !== null || input.getBoundingClientRect().width > 0) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, title);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { updated: true, name: input.name, id: input.id };
        }
      }
      return { updated: false, candidates: candidates.map(c => ({ name: c.name, id: c.id })) };
    }, TITLE);
    log('Title update: ' + JSON.stringify(titleUpdated));

    // Update description
    const descUpdated = await page.evaluate((desc) => {
      const candidates = [
        document.querySelector('textarea[name="description"]'),
        document.querySelector('textarea[name="summary"]'),
        document.querySelector('textarea[placeholder*="description" i]'),
        document.querySelector('textarea'),
      ].filter(Boolean);

      for (const ta of candidates) {
        if (ta.offsetParent !== null || ta.getBoundingClientRect().width > 0) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(ta, desc);
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          return { updated: true, name: ta.name, id: ta.id };
        }
      }
      return { updated: false, candidates: candidates.map(c => ({ name: c.name, id: c.id })) };
    }, DESCRIPTION);
    log('Description update: ' + JSON.stringify(descUpdated));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-settings-filled.png') });

    // Save settings
    const settingsSaved = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        const text = (b.textContent || b.value || '').trim();
        if (rect.width > 0 && (text.includes('Save') || text.includes('Update') || b.type === 'submit')) {
          b.click();
          return text;
        }
      }
      // Try form submit
      const form = document.querySelector('form');
      if (form) { form.submit(); return 'form-submit'; }
      return null;
    });
    log('Settings save: ' + settingsSaved);
    await sleep(3000);
    log('URL after settings save: ' + page.url());
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-settings-saved.png') });

    // Check if we got a success message
    const settingsPageText = await page.evaluate(() => document.body.innerText);
    results.title = settingsPageText.includes(TITLE.slice(0, 20)) ? 'updated' : 'check needed';
    results.description = descUpdated.updated ? 'updated' : 'check needed';

    // ── PAGES TAB ─────────────────────────────────────────────────────────────
    log('\n=== Pages Tab ===');
    await page.goto(`https://payhip.com/bundle/pages/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-pages.png') });
    log('Pages URL: ' + page.url());

    // Dump all visible elements on pages tab
    const pagesElements = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll('input, textarea, button, a[class*="btn"], h1, h2, label, [class*="tab"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          els.push({
            tag: el.tagName,
            text: (el.textContent || el.value || el.placeholder || '').trim().slice(0, 60),
            name: el.name || '', id: el.id || '',
            href: el.href || '',
            class: el.className.slice(0, 50)
          });
        }
      });
      return els;
    });
    log('Pages elements: ' + JSON.stringify(pagesElements, null, 2));

    // The pages tab likely shows landing page sections. Look for the page editor.
    // Try clicking "Edit" or "Manage" on the pages listing
    const editPageClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        const text = b.textContent.trim().toLowerCase();
        if (rect.width > 0 && rect.height > 0 && (text === 'edit' || text === 'manage' || text === 'customize')) {
          b.click();
          return { clicked: true, text: b.textContent.trim(), href: b.href || '' };
        }
      }
      return { clicked: false };
    });
    log('Edit page click: ' + JSON.stringify(editPageClicked));
    await sleep(2000);
    log('After pages click URL: ' + page.url());
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-pages-after-click.png') });

    // Check if we navigated to a page editor
    const currentUrl = page.url();
    if (currentUrl.includes('/pages/')) {
      log('On pages editor');
    } else {
      // Try direct URL patterns for bundle page editing
      const pageUrls = [
        `https://payhip.com/bundle/page/${BUNDLE_ID}/edit`,
        `https://payhip.com/bundle/pages/${BUNDLE_ID}/edit`,
        `https://payhip.com/bundle/page-builder/${BUNDLE_ID}`,
      ];
      for (const url of pageUrls) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(1500);
        const urlNow = page.url();
        log('Tried: ' + url + ' -> ' + urlNow);
        if (!urlNow.includes('404') && urlNow !== url.replace('/edit', '') && urlNow !== 'https://payhip.com/') {
          break;
        }
      }
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-page-editor.png') });
    log('Page editor URL: ' + page.url());

    // Dump all inputs in page editor
    const editorInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, textarea'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({
          tag: el.tagName, name: el.name, id: el.id,
          placeholder: el.placeholder, value: el.value.slice(0, 80),
          class: el.className.slice(0, 50)
        }));
    });
    log('Page editor inputs: ' + JSON.stringify(editorInputs, null, 2));

    // Try to find and update hero title and subtitle
    const heroUpdated = await page.evaluate(({ heroTitle, heroSubtitle }) => {
      const results = {};

      // Look for hero title input
      const titleCandidates = [
        document.querySelector('input[name*="hero_title"], input[name*="headline"]'),
        document.querySelector('input[placeholder*="title" i]'),
        document.querySelector('input[placeholder*="headline" i]'),
        document.querySelector('input[name*="title"]'),
      ].filter(Boolean);

      for (const inp of titleCandidates) {
        if (inp.getBoundingClientRect().width > 0) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, heroTitle);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          results.heroTitle = { updated: true, name: inp.name, id: inp.id };
          break;
        }
      }

      // Look for subtitle/description input
      const subtitleCandidates = [
        document.querySelector('textarea[name*="subtitle"], textarea[name*="description"]'),
        document.querySelector('input[name*="subtitle"], input[placeholder*="subtitle" i]'),
        document.querySelector('textarea[placeholder*="subtitle" i]'),
        document.querySelector('textarea'),
      ].filter(Boolean);

      for (const inp of subtitleCandidates) {
        if (inp.getBoundingClientRect().width > 0) {
          const tag = inp.tagName;
          const setter = tag === 'TEXTAREA'
            ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
            : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, heroSubtitle);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          results.heroSubtitle = { updated: true, name: inp.name, id: inp.id };
          break;
        }
      }

      return results;
    }, { heroTitle: HERO_TITLE, heroSubtitle: HERO_SUBTITLE });
    log('Hero update: ' + JSON.stringify(heroUpdated));

    // Try to remove the hero image
    const imageRemoved = await page.evaluate(() => {
      // Look for remove/delete image buttons
      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const b of btns) {
        const text = b.textContent.trim().toLowerCase();
        const cls = b.className.toLowerCase();
        const rect = b.getBoundingClientRect();
        if (rect.width > 0 && (text.includes('remove') || text.includes('delete') || cls.includes('remove') || cls.includes('delete')) &&
            (text.includes('image') || text.includes('photo') || text.includes('cover') || cls.includes('image'))) {
          b.click();
          return { clicked: true, text: b.textContent.trim() };
        }
      }
      return { clicked: false };
    });
    log('Image remove: ' + JSON.stringify(imageRemoved));

    // Save page changes
    const pageSaved = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        const text = (b.textContent || b.value || '').trim();
        if (rect.width > 0 && (text.includes('Save') || text.includes('Update') || b.type === 'submit')) {
          b.click();
          return text;
        }
      }
      return null;
    });
    log('Page save: ' + pageSaved);
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-pages-saved.png') });
    log('URL after page save: ' + page.url());

    results.heroTitle = heroUpdated.heroTitle ? 'updated' : 'check needed';
    results.heroSubtitle = heroUpdated.heroSubtitle ? 'updated' : 'check needed';

    // ── PRICING TAB ───────────────────────────────────────────────────────────
    log('\n=== Pricing Tab ===');
    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-pricing.png') });

    const pricingText = await page.evaluate(() => document.body.innerText);
    const has29 = pricingText.includes('29.00') || pricingText.includes('$29');
    log('Pricing page text: ' + pricingText.slice(0, 300));
    log('Has $29 price: ' + has29);
    results.pricing = has29 ? '$29 confirmed ✓' : 'check needed';

    // ── PUBLISH ───────────────────────────────────────────────────────────────
    log('\n=== Publish Tab ===');
    await page.goto(`https://payhip.com/bundle/publish/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-publish.png') });

    const publishPageText = await page.evaluate(() => document.body.innerText);
    log('Publish page: ' + publishPageText.slice(0, 300));

    // Check if "published" radio is already selected
    const publishStatus = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      return radios.map(r => ({ value: r.value, name: r.name, checked: r.checked }));
    });
    log('Publish status: ' + JSON.stringify(publishStatus));

    const publishedRadio = publishStatus.find(r => r.value === 'published' && r.checked);
    if (publishedRadio) {
      log('Already published ✓');
      results.published = 'already published ✓';
    } else {
      // Select published and save
      await page.evaluate(() => {
        const radio = document.querySelector('input[name="publish_status"][value="published"]');
        if (radio) { radio.checked = true; radio.click(); radio.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      await sleep(300);
      const saveResult = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const b of btns) {
          const rect = b.getBoundingClientRect();
          const text = (b.textContent || b.value || '').trim();
          if (rect.width > 0 && (text.includes('Save') || b.type === 'submit')) {
            b.click();
            return text;
          }
        }
        return null;
      });
      log('Publish save: ' + saveResult);
      await sleep(2000);
      results.published = 'published ✓';
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-publish-final.png') });

    // ── FINAL REPORT ──────────────────────────────────────────────────────────
    log('\n=============================');
    log('RESULTS:');
    log(`  Bundle URL:   https://payhip.com/b/${BUNDLE_ID}`);
    log(`  Title:        ${results.title}`);
    log(`  Description:  ${results.description}`);
    log(`  Hero Title:   ${results.heroTitle}`);
    log(`  Hero Subtitle:${results.heroSubtitle}`);
    log(`  Price:        ${results.pricing}`);
    log(`  Published:    ${results.published}`);
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'bs-fatal.png') });
  } finally {
    await browser.close();
  }
})();
