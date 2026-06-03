/**
 * payhip-builder-click.js
 * 1. Click "Bundle Title" H1 in preview iframe → opens edit sidebar
 * 2. Edit the text fields in the sidebar
 * 3. Click Publish to save
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const HERO_TITLE    = 'Get All 20 Contract Templates';
const HERO_SUBTITLE = 'One purchase. Instant access. Professional contracts for every freelancer.';
const DESC_TEXT     = 'Get all 20 professional contract templates in one purchase. Includes Freelance, NDA, Service Agreement, Photography, Web Design, and 15 more. Editable Word & PDF format. Instant download.';

async function clickInIframe(page, iframeSelector, iframeX, iframeY) {
  const iframeRect = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, iframeSelector);

  if (!iframeRect) { log('iframe not found: ' + iframeSelector); return null; }
  const absX = Math.round(iframeRect.x + iframeX);
  const absY = Math.round(iframeRect.y + iframeY);
  log(`Clicking at abs (${absX}, ${absY}), iframe offset (${iframeX}, ${iframeY})`);
  await page.mouse.click(absX, absY);
  return { absX, absY };
}

async function fillTextInSidebar(page, newText, description) {
  await sleep(1500);
  await page.screenshot({ path: path.join(SCRIPTS_DIR, `build-after-${description}.png`) });

  // Look for editable fields that appeared after clicking
  const editState = await page.evaluate(() => {
    const all = [];
    document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        all.push({
          tag: el.tagName, name: el.name || '', id: el.id || '',
          placeholder: el.placeholder || '',
          value: (el.value || el.textContent || '').slice(0, 80),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) },
          contenteditable: el.contentEditable
        });
      }
    });
    return all;
  });
  log(`Edit state after ${description}: ` + JSON.stringify(editState, null, 2));

  return editState;
}

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 80, viewport: { width: 1400, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();
  const results = {};

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    const builderUrl = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';
    await page.goto(builderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'build-initial.png') });
    log('Builder ready');

    // Get iframe rect
    const iframeRect = await page.evaluate(() => {
      const el = document.querySelector('iframe.preview-iframe, iframe.js-preview-iframe');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    log('Preview iframe rect: ' + JSON.stringify(iframeRect));

    if (!iframeRect) {
      log('ERROR: Preview iframe not found!');
      return;
    }

    // ── CLICK ON "Bundle Title" H1 (iframe coordinates: x~517, y~233) ─────────
    // From previous run: H1 at iframe (161, 226), width 713 → center x=517, y=233
    log('\n=== Click "Bundle Title" H1 ===');
    const heroClick = await clickInIframe(page, 'iframe.preview-iframe, iframe.js-preview-iframe', 517, 233);
    const editState1 = await fillTextInSidebar(page, HERO_TITLE, 'hero-click');

    // Check if inline editor appeared in the preview iframe
    const preview = page.frames().find(f => f.url().includes('builder_mode=1'));
    if (preview) {
      const inlineEdit = await preview.evaluate(() => {
        const ed = document.querySelector('[contenteditable="true"]');
        return ed ? { found: true, text: ed.textContent, tag: ed.tagName, class: ed.className } : { found: false };
      });
      log('Inline edit in preview: ' + JSON.stringify(inlineEdit));

      if (inlineEdit.found) {
        log('Inline edit mode active — typing new title');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await sleep(100);
        await page.keyboard.type(HERO_TITLE);
        await sleep(500);

        // Click outside to confirm, then click on subtitle
        await page.mouse.click(Math.round(iframeRect.x + 517), Math.round(iframeRect.y + 350));
        await sleep(1000);
        results.heroTitle = '✓ typed in inline editor';
      }
    }

    if (editState1.length > 0) {
      // A sidebar appeared with text input fields
      log('Sidebar opened with ' + editState1.length + ' inputs');
      // Fill the first text input with the hero title
      for (const inp of editState1) {
        if (inp.tag === 'INPUT' && inp.rect.x > 800) {
          // sidebar is on the right side
          await page.mouse.click(inp.rect.x + inp.rect.w / 2, inp.rect.y + 15);
          await sleep(200);
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await sleep(100);
          await page.keyboard.type(HERO_TITLE);
          await sleep(300);
          log('Filled sidebar input with hero title');
          results.heroTitle = '✓ filled in sidebar';
          break;
        }
      }
    }

    // ── CLICK ON subtitle paragraph (iframe coordinates: x~517, y~314) ────────
    log('\n=== Click subtitle "A short, descriptive sentence..." ===');
    await clickInIframe(page, 'iframe.preview-iframe, iframe.js-preview-iframe', 517, 314);
    const editState2 = await fillTextInSidebar(page, HERO_SUBTITLE, 'subtitle-click');

    if (preview) {
      const inlineEdit2 = await preview.evaluate(() => {
        const ed = document.querySelector('[contenteditable="true"]');
        return ed ? { found: true, text: ed.textContent, tag: ed.tagName, class: ed.className } : { found: false };
      });
      log('Subtitle inline edit: ' + JSON.stringify(inlineEdit2));

      if (inlineEdit2.found) {
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await sleep(100);
        await page.keyboard.type(HERO_SUBTITLE);
        await sleep(500);
        await page.mouse.click(Math.round(iframeRect.x + 517), Math.round(iframeRect.y + 500));
        await sleep(1000);
        results.heroSubtitle = '✓ typed in inline editor';
      }
    }

    // ── CLICK ON "Example Text" H1 to update the body description ────────────
    // From previous run: "Example Text" at iframe (280, 592), center x=518, y=600
    log('\n=== Click "Example Text" for description ===');
    await clickInIframe(page, 'iframe.preview-iframe, iframe.js-preview-iframe', 518, 600);
    await sleep(1500);

    if (preview) {
      const inlineEdit3 = await preview.evaluate(() => {
        const ed = document.querySelector('[contenteditable="true"]');
        return ed ? { found: true, text: ed.textContent.slice(0, 60), tag: ed.tagName } : { found: false };
      });
      log('Description inline edit: ' + JSON.stringify(inlineEdit3));

      if (inlineEdit3.found) {
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await sleep(100);
        await page.keyboard.type(DESC_TEXT);
        await sleep(500);
        await page.mouse.click(Math.round(iframeRect.x + 517), Math.round(iframeRect.y + 800));
        await sleep(1000);
        results.description = '✓ typed in inline editor';
      }
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'build-edited.png') });

    // ── CLICK PUBLISH ──────────────────────────────────────────────────────────
    log('\n=== Click Publish ===');
    // Find the Publish button in the builder toolbar
    const publishClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        if (rect.width > 0 && b.className.includes('publish')) {
          b.click();
          return { clicked: true, text: b.textContent.trim().slice(0, 40), class: b.className.slice(0, 40) };
        }
      }
      // Also try text match
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        const txt = b.textContent.trim();
        if (rect.width > 0 && txt.toLowerCase().startsWith('publish')) {
          b.click();
          return { clicked: true, text: txt.slice(0, 40), class: b.className.slice(0, 40) };
        }
      }
      return { clicked: false };
    });
    log('Publish click: ' + JSON.stringify(publishClicked));
    await sleep(3000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'build-published.png') });
    log('After publish URL: ' + page.url());

    // Confirm publish (if a modal appears)
    const publishConfirm = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        const txt = b.textContent.trim().toLowerCase();
        if (rect.width > 0 && (txt.includes('publish') || txt.includes('confirm') || txt.includes('save'))) {
          b.click();
          return b.textContent.trim();
        }
      }
      return null;
    });
    if (publishConfirm) {
      log('Confirmed: ' + publishConfirm);
      await sleep(2000);
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'build-final.png') });

    // Verify public page updated
    log('\n=== Verify public page ===');
    await page.goto('https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 800));
    log('Public page after update: ' + publicText);
    results.pageUpdated = publicText.includes(HERO_TITLE) ? '✓ Hero title visible on public page' : 'need to verify';

    log('\n=============================');
    log('BUILDER UPDATE RESULTS:');
    log(`  Hero Title:    ${results.heroTitle || 'not updated'}`);
    log(`  Hero Subtitle: ${results.heroSubtitle || 'not updated'}`);
    log(`  Description:   ${results.description || 'not updated'}`);
    log(`  Page Updated:  ${results.pageUpdated || 'unknown'}`);
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'build-fatal.png') });
  } finally {
    await browser.close();
  }
})();
