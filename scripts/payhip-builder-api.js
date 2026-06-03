/**
 * payhip-builder-api.js
 * 1. Explore window.payhipBuilder API
 * 2. Use it to update section content directly
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
    log('Builder loaded');

    // ── Step 1: Deep inspect payhipBuilder API ────────────────────────────────
    log('\n=== Inspect payhipBuilder API ===');
    const apiInfo = await page.evaluate(() => {
      const pb = window.payhipBuilder;
      if (!pb) return { found: false };

      const info = { found: true, type: typeof pb };

      // Get all properties
      const ownProps = Object.getOwnPropertyNames(pb);
      const protoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(pb) || {});
      info.ownProps = ownProps.slice(0, 50);
      info.protoProps = protoProps.slice(0, 30);

      // If it's an object, get its keys and types
      const keyInfo = {};
      [...ownProps, ...protoProps].slice(0, 40).forEach(k => {
        try {
          keyInfo[k] = typeof pb[k];
        } catch(e) {}
      });
      info.keyTypes = keyInfo;

      // Check if it looks like a Vue instance or similar
      if (pb.$data) {
        info.vueData = JSON.stringify(pb.$data).slice(0, 500);
      }
      if (pb.state) {
        info.state = JSON.stringify(pb.state).slice(0, 500);
      }
      if (pb.store) {
        info.store = { type: typeof pb.store };
      }

      return info;
    });
    log('payhipBuilder API: ' + JSON.stringify(apiInfo, null, 2));

    // ── Step 2: Explore deeper ────────────────────────────────────────────────
    const apiDeep = await page.evaluate(() => {
      const pb = window.payhipBuilder;
      if (!pb) return null;

      // Try to get section/content data
      const sections = pb.sections || pb.getSections?.() || pb.pageData?.sections;
      const content = pb.content || pb.getContent?.() || pb.pageContent;
      const methods = Object.getOwnPropertyNames(pb).filter(k => typeof pb[k] === 'function');

      // Check all window keys for anything builder-related
      const builderKeys = Object.getOwnPropertyNames(window).filter(k => {
        if (k === 'payhipBuilder') return true;
        try {
          const v = window[k];
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            const str = JSON.stringify(v).toLowerCase();
            return str.includes('builder') || str.includes('section') || str.includes('bundle title');
          }
        } catch(e) {}
        return false;
      });

      return {
        methods,
        hasSections: !!sections,
        hasContent: !!content,
        sectionsSnippet: sections ? JSON.stringify(sections).slice(0, 500) : null,
        contentSnippet: content ? JSON.stringify(content).slice(0, 500) : null,
        builderKeys
      };
    });
    log('API deep: ' + JSON.stringify(apiDeep, null, 2));

    // ── Step 3: Find preview frame and explore its window ────────────────────
    log('\n=== Explore preview frame window ===');
    const preview = page.frames().find(f => f.url().includes('builder_mode=1'));
    if (preview) {
      const frameApi = await preview.evaluate(() => {
        const interesting = {};
        ['payhipBuilder', 'builder', 'pageBuilder', 'Vue', 'React', 'editMode'].forEach(k => {
          if (window[k]) {
            interesting[k] = typeof window[k];
          }
        });
        // Also check postMessage handlers
        const allKeys = Object.getOwnPropertyNames(window).filter(k => {
          try {
            const v = window[k];
            return typeof v === 'function' && k.toLowerCase().includes('message');
          } catch(e) { return false; }
        });
        return { interesting, messageHandlers: allKeys };
      });
      log('Preview frame API: ' + JSON.stringify(frameApi));

      // Try clicking H1 and immediately check what changes in main page
      log('\n=== Click H1 and monitor changes ===');
      await preview.click('h1.heading-text', { timeout: 5000 });
      await sleep(3000);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'api-after-click.png') });

      // Dump EVERYTHING in main page DOM that appeared after click
      const mainDomAfterClick = await page.evaluate(() => {
        // Get all elements with non-zero size
        const all = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20 && rect.height > 10) {
            all.push({
              tag: el.tagName,
              id: el.id || '',
              class: (el.className || '').toString().slice(0, 60),
              text: (el.textContent || '').trim().slice(0, 60),
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
            });
          }
        });
        return all.slice(0, 80);
      });
      log('Main DOM after H1 click: ' + JSON.stringify(mainDomAfterClick, null, 2));

      // Also check the payhipBuilder state after click
      const builderStateAfterClick = await page.evaluate(() => {
        const pb = window.payhipBuilder;
        if (!pb) return null;
        const selected = pb.selectedSection || pb.activeSection || pb.currentSection ||
                        pb.editingElement || pb.selectedElement;
        const panelOpen = pb.isPanelOpen || pb.sidebarOpen || pb.editPanelVisible;
        return {
          selected: selected ? JSON.stringify(selected).slice(0, 200) : null,
          panelOpen,
          allProps: Object.getOwnPropertyNames(pb).filter(k => typeof pb[k] !== 'function').map(k => {
            try { return `${k}: ${JSON.stringify(pb[k]).slice(0, 50)}`; } catch(e) { return `${k}: [error]`; }
          }).slice(0, 30)
        };
      });
      log('Builder state after click: ' + JSON.stringify(builderStateAfterClick, null, 2));
    }

    // ── Step 4: Try postMessage to preview frame ─────────────────────────────
    log('\n=== Try postMessage to preview frame ===');
    if (preview) {
      // Try sending edit commands via postMessage to the preview
      const msgResult = await page.evaluate((frameUrl) => {
        const iframe = document.querySelector('iframe.preview-iframe, iframe.js-preview-iframe');
        if (!iframe) return { found: false };

        // Try various message formats that a builder might use
        const messages = [
          { type: 'enterEditMode', selector: 'h1.heading-text' },
          { action: 'edit', element: 'heading', index: 0 },
          { event: 'click', target: 'bundle-title' }
        ];

        messages.forEach(msg => {
          iframe.contentWindow?.postMessage(msg, '*');
        });

        return { found: true, frameOrigin: new URL(frameUrl).origin };
      }, preview.url());
      log('postMessage result: ' + JSON.stringify(msgResult));
      await sleep(2000);
    }

    // ── Step 5: Dump builder HTML structure ──────────────────────────────────
    log('\n=== Builder HTML structure ===');
    const builderHtml = await page.evaluate(() => {
      // Find the builder's main container
      const container = document.querySelector('[id*="builder"], [class*="builder-container"], [class*="page-builder"]') ||
                       document.body;
      return container.innerHTML.slice(0, 3000);
    });
    log('Builder HTML (3000 chars): ' + builderHtml);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'api-final.png') });

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'api-fatal.png') });
  } finally {
    await browser.close();
  }
})();
