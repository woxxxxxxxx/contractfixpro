/**
 * payhip-builder-frame.js
 * Use frame.click() to directly interact with builder preview iframe elements
 * Then update text via inline edit or sidebar
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

async function waitForFrame(page, urlFragment, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const f = page.frames().find(f => f.url().includes(urlFragment));
    if (f) return f;
    await sleep(500);
  }
  return null;
}

async function dumpSidebar(page, label) {
  await sleep(1500);
  await page.screenshot({ path: path.join(SCRIPTS_DIR, `frame-${label}.png`) });

  // Dump all inputs visible in the main page (sidebar)
  const sidebarInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(el => ({
        tag: el.tagName,
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        value: (el.value || el.textContent || '').slice(0, 80),
        class: (el.className || '').toString().slice(0, 60),
        rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width) }
      }));
  });
  log(`[${label}] Sidebar inputs: ${JSON.stringify(sidebarInputs)}`);
  return sidebarInputs;
}

async function dumpPreviewEditables(frame, label) {
  const editables = await frame.evaluate(() => {
    return Array.from(document.querySelectorAll('[contenteditable="true"], input, textarea'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(el => ({
        tag: el.tagName,
        class: (el.className || '').toString().slice(0, 60),
        text: (el.textContent || el.value || '').slice(0, 80),
        rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) }
      }));
  });
  log(`[${label}] Preview editables: ${JSON.stringify(editables)}`);
  return editables;
}

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1400, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();
  const results = {};

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    const builderUrl = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';
    await page.goto(builderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(8000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'frame-loaded.png') });
    log('Builder loaded');

    // Find the preview iframe frame
    const preview = await waitForFrame(page, 'builder_mode=1');
    if (!preview) {
      log('ERROR: preview frame not found');
      const allFrames = page.frames().map(f => f.url().slice(0, 100));
      log('Available frames: ' + JSON.stringify(allFrames));
      return;
    }
    log('Preview frame: ' + preview.url().slice(0, 100));

    // Dump all elements in preview iframe
    const previewElements = await preview.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, p, [class*="heading"], [class*="title"], [class*="subtitle"]'))
        .filter(el => el.children.length === 0)
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            class: (el.className || '').toString().slice(0, 80),
            text: el.textContent.trim().slice(0, 100),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
          };
        });
    });
    log('Preview elements: ' + JSON.stringify(previewElements, null, 2));

    // ── Approach 1: Use frame.click() on h1.js-builder-heading-text ─────────
    log('\n=== Approach 1: frame.click() on H1 ===');
    const h1Selector = 'h1.heading-text, h1.js-builder-heading-text, [class*="heading-text"]';

    try {
      await preview.click(h1Selector, { timeout: 5000 });
      log('Single-clicked H1 in frame');
      await sleep(2000);

      const sidebar1 = await dumpSidebar(page, 'h1-single');
      const editable1 = await dumpPreviewEditables(preview, 'h1-single');

      // If sidebar opened with text fields, fill them
      if (sidebar1.some(el => el.rect.x > 1000 && (el.tag === 'INPUT' || el.tag === 'TEXTAREA'))) {
        log('Sidebar has text fields on the right side');
        for (const inp of sidebar1) {
          if (inp.rect.x > 1000 && (inp.tag === 'INPUT' || inp.tag === 'TEXTAREA')) {
            await page.mouse.click(inp.rect.x + inp.rect.w / 2, inp.rect.y + 15);
            await sleep(200);
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.keyboard.type(HERO_TITLE);
            await sleep(300);
            results.heroTitle = '✓ filled in sidebar';
            log('Filled sidebar field: ' + HERO_TITLE);
            break;
          }
        }
      }

      // Try double-click to enter inline edit mode
      if (!results.heroTitle) {
        log('Trying double-click for inline edit');
        await preview.dblclick(h1Selector, { timeout: 5000 });
        await sleep(1500);

        const editable2 = await dumpPreviewEditables(preview, 'h1-dblclick');
        if (editable2.length > 0) {
          const editableEl = editable2[0];
          log('Found editable after dblclick: ' + JSON.stringify(editableEl));
          await preview.keyboard.down('Control');
          await preview.keyboard.press('a');
          await preview.keyboard.up('Control');
          await sleep(100);
          await preview.keyboard.type(HERO_TITLE);
          await sleep(500);
          results.heroTitle = '✓ typed via inline edit (dblclick)';
          log('Typed title in preview inline edit');

          // Click outside to confirm
          await preview.click('body', { position: { x: 400, y: 700 } });
          await sleep(1000);
        }
      }
    } catch (e) {
      log('Frame click approach error: ' + e.message);
    }

    // ── Approach 2: Intercept builder's PostMessage or internal API ──────────
    if (!results.heroTitle) {
      log('\n=== Approach 2: Inspect builder window API ===');
      const builderApi = await page.evaluate(() => {
        // Look for builder-specific globals
        const interesting = {};
        ['Builder', 'builder', 'PageBuilder', 'pageBuilder', 'builderApp', 'Vue', 'React',
         'sections', 'pageData', 'builderData', 'contentManager'].forEach(k => {
          if (window[k]) interesting[k] = typeof window[k];
        });
        // Also check for event buses
        const allKeys = Object.getOwnPropertyNames(window).filter(k => {
          const v = window[k];
          if (typeof v === 'object' && v !== null) {
            const sub = Object.getOwnPropertyNames(v);
            return sub.some(s => s.includes('update') || s.includes('edit') || s.includes('save'));
          }
          return false;
        }).slice(0, 10);
        return { interesting, allKeys };
      });
      log('Builder API: ' + JSON.stringify(builderApi));

      // Try triggering inline edit by clicking on the heading in preview using evaluate
      const clickResult = await preview.evaluate(() => {
        const h1 = document.querySelector('h1.heading-text, h1.js-builder-heading-text, [class*="builder-heading"]');
        if (!h1) return { found: false };
        // Simulate a complete click event sequence
        ['mousedown', 'mouseup', 'click'].forEach(evt => {
          h1.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
        });
        return { found: true, text: h1.textContent.trim(), class: h1.className };
      });
      log('Preview JS click: ' + JSON.stringify(clickResult));
      await sleep(2000);

      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'frame-after-jsevent.png') });
      const editable3 = await dumpPreviewEditables(preview, 'js-event');

      if (editable3.length > 0) {
        await preview.keyboard.down('Control');
        await preview.keyboard.press('a');
        await preview.keyboard.up('Control');
        await preview.keyboard.type(HERO_TITLE);
        results.heroTitle = '✓ typed after JS event';
      }
    }

    // ── Approach 3: Interact via the builder sidebar left panel ─────────────
    if (!results.heroTitle) {
      log('\n=== Approach 3: Look for section panel on left sidebar ===');
      const leftSidebar = await page.evaluate(() => {
        // Look for left sidebar elements - sections list
        return Array.from(document.querySelectorAll('[class*="section"], [class*="sidebar"], [class*="panel"]'))
          .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.x < 400;
          })
          .map(el => ({
            tag: el.tagName,
            class: (el.className || '').toString().slice(0, 60),
            text: el.textContent.trim().slice(0, 80),
            rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width) }
          }))
          .slice(0, 20);
      });
      log('Left sidebar elements: ' + JSON.stringify(leftSidebar, null, 2));

      // Dump ALL visible text in main page to understand builder UI
      const mainPageText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      log('Main page text: ' + mainPageText);
    }

    // ── Try clicking with proper focus on iframe first ───────────────────────
    if (!results.heroTitle) {
      log('\n=== Approach 4: Focus iframe then click ===');
      // First click on the iframe element itself to give it focus
      const iframeEl = await page.$('iframe.preview-iframe, iframe.js-preview-iframe');
      if (iframeEl) {
        await iframeEl.click();
        await sleep(500);
        log('Clicked iframe element to focus it');
      }

      // Now use frame.click
      try {
        await preview.click('h1.heading-text', { timeout: 3000 });
        await sleep(2000);
        const editable4 = await dumpPreviewEditables(preview, 'after-focus');
        log('Editables after focus+click: ' + JSON.stringify(editable4));

        if (editable4.length > 0) {
          await preview.keyboard.down('Control');
          await preview.keyboard.press('a');
          await preview.keyboard.up('Control');
          await preview.keyboard.type(HERO_TITLE);
          results.heroTitle = '✓ typed after iframe focus';
        }
      } catch(e) {
        log('Focus approach error: ' + e.message);
      }
    }

    // ── Approach 5: Use the builder's published API endpoint directly ────────
    // Look for the API token/endpoint to directly update section content
    log('\n=== Approach 5: Capture builder save API ===');
    const builderToken = await page.evaluate(() => {
      // Check for CSRF token, API keys, user tokens
      const meta = document.querySelector('meta[name="csrf-token"]');
      const csrfToken = meta ? meta.content : null;
      // Check cookies
      const cookies = document.cookie;
      // Check for auth tokens in window
      const token = window._token || window.csrfToken || window.authToken;
      return { csrfToken, cookieLength: cookies.length, token };
    });
    log('Builder tokens: ' + JSON.stringify(builderToken));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'frame-final.png') });

    // Report results
    log('\n=============================');
    log('RESULTS:');
    log(`  Hero Title:    ${results.heroTitle || 'not updated'}`);
    log(`  Hero Subtitle: ${results.heroSubtitle || 'not updated'}`);
    log(`  Description:   ${results.description || 'not updated'}`);
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'frame-fatal.png') });
  } finally {
    await browser.close();
  }
})();
