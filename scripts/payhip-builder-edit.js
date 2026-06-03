/**
 * payhip-builder-edit.js
 * Update the bundle sales page via the visual page builder iframe
 * Target: hero title "Bundle Title" → new title, subtitle → new subtitle
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

const HERO_TITLE = 'Get All 20 Contract Templates';
const HERO_SUBTITLE = 'One purchase. Instant access. Professional contracts for every freelancer.';
const DESCRIPTION_TEXT = 'Get all 20 professional contract templates in one purchase. Includes Freelance, NDA, Service Agreement, Photography, Web Design, and 15 more. Editable Word & PDF format. Instant download.';

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 80, viewport: { width: 1400, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    // Navigate to the builder
    const builderUrl = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';
    await page.goto(builderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(6000);  // Wait fully for builder + preview iframe to load

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-loaded.png') });
    log('Builder loaded. URL: ' + page.url());

    // Find the preview iframe
    const frames = page.frames();
    log('Frames: ' + frames.map(f => f.url().slice(0, 80)).join('\n  '));

    const previewFrame = frames.find(f => f.url().includes('builder_mode=1'));
    if (!previewFrame) {
      log('Preview frame not found — waiting more');
      await sleep(5000);
      const frames2 = page.frames();
      log('Frames after wait: ' + frames2.map(f => f.url().slice(0, 80)).join('\n  '));
    }

    const preview = page.frames().find(f => f.url().includes('builder_mode=1'));
    if (!preview) {
      log('ERROR: Cannot find preview iframe');
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-no-frame.png') });
    } else {
      log('Preview frame found: ' + preview.url().slice(0, 100));

      // Dump all text content in the preview iframe
      const previewContent = await preview.evaluate(() => {
        const texts = [];
        document.querySelectorAll('h1, h2, h3, p, div[class*="title"], div[class*="hero"], span').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && el.children.length === 0) {
            const text = el.textContent.trim();
            if (text && text.length > 2 && text.length < 200) {
              texts.push({ tag: el.tagName, text, class: el.className.slice(0, 50), rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) } });
            }
          }
        });
        return texts;
      });
      log('Preview content: ' + JSON.stringify(previewContent, null, 2));

      await preview.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-preview.png') });

      // Try clicking on "Bundle Title" text in the preview iframe to open the edit panel
      const bundleTitleEl = await preview.evaluate(() => {
        const els = Array.from(document.querySelectorAll('*'));
        for (const el of els) {
          if (el.children.length === 0 && el.textContent.trim() === 'Bundle Title') {
            const rect = el.getBoundingClientRect();
            return { tag: el.tagName, text: el.textContent.trim(), rect, class: el.className };
          }
        }
        return null;
      });
      log('Bundle Title element: ' + JSON.stringify(bundleTitleEl));

      if (bundleTitleEl && bundleTitleEl.rect.width > 0) {
        // Get the iframe element's position in the main page to calculate absolute coordinates
        const iframeRect = await page.evaluate(() => {
          const iframe = document.querySelector('iframe.preview-iframe, iframe.js-preview-iframe');
          if (iframe) return iframe.getBoundingClientRect();
          return null;
        });
        log('Preview iframe rect in main page: ' + JSON.stringify(iframeRect));

        if (iframeRect) {
          // Click on the element within the iframe using absolute page coordinates
          const absX = iframeRect.x + bundleTitleEl.rect.x + bundleTitleEl.rect.width / 2;
          const absY = iframeRect.y + bundleTitleEl.rect.y + bundleTitleEl.rect.height / 2;
          log(`Clicking "Bundle Title" at abs (${Math.round(absX)}, ${Math.round(absY)})`);
          await page.mouse.click(Math.round(absX), Math.round(absY));
          await sleep(2000);

          await page.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-after-click.png') });
          log('After click URL: ' + page.url());

          // Check if an edit panel opened in the main page
          const editPanel = await page.evaluate(() => {
            const panels = Array.from(document.querySelectorAll('[class*="edit-panel"], [class*="editor"], [class*="sidebar"], [class*="properties"]'));
            return panels.filter(p => p.getBoundingClientRect().width > 0)
              .map(p => ({ class: p.className.slice(0, 50), text: p.textContent.trim().slice(0, 100) }));
          });
          log('Edit panels: ' + JSON.stringify(editPanel));

          // Check for new inputs that appeared
          const newInputs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
              .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              })
              .map(el => ({
                tag: el.tagName, name: el.name, id: el.id,
                placeholder: el.placeholder,
                value: (el.value || el.textContent || '').slice(0, 80),
                rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) }
              }))
          );
          log('New inputs after click: ' + JSON.stringify(newInputs, null, 2));
        }
      }

      // Try double-clicking on "Bundle Title" to enable inline edit
      if (bundleTitleEl && bundleTitleEl.rect.width > 0) {
        const iframeRect = await page.evaluate(() => {
          const iframe = document.querySelector('iframe.preview-iframe, iframe.js-preview-iframe');
          return iframe ? iframe.getBoundingClientRect() : null;
        });

        if (iframeRect) {
          const absX = iframeRect.x + bundleTitleEl.rect.x + bundleTitleEl.rect.width / 2;
          const absY = iframeRect.y + bundleTitleEl.rect.y + bundleTitleEl.rect.height / 2;
          log(`Double-clicking at (${Math.round(absX)}, ${Math.round(absY)})`);
          await page.mouse.dblclick(Math.round(absX), Math.round(absY));
          await sleep(2000);

          await page.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-after-dblclick.png') });

          // Check if inline edit became active in preview frame
          const editableInPreview = await preview.evaluate(() => {
            const editable = document.querySelector('[contenteditable="true"]');
            if (editable) return { found: true, text: editable.textContent, class: editable.className };
            return { found: false };
          });
          log('Editable in preview: ' + JSON.stringify(editableInPreview));

          if (editableInPreview.found) {
            // Select all and type new title
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await sleep(200);
            await page.keyboard.type(HERO_TITLE);
            await sleep(500);
            log('Typed hero title via keyboard');
          }
        }
      }
    }

    // ── Try the builder API approach ──────────────────────────────────────────
    log('\n=== Try builder API / direct page content update ===');

    // The page currently has these placeholder texts. Let me try to find
    // if there's a builder API endpoint we can call to update sections.
    // Check what requests the builder makes
    const builderApiInfo = await page.evaluate(async () => {
      // Look for any global builder state or API
      const keys = Object.keys(window).filter(k =>
        k.toLowerCase().includes('builder') || k.toLowerCase().includes('page') ||
        k.toLowerCase().includes('section') || k.toLowerCase().includes('content')
      ).slice(0, 20);
      return { windowKeys: keys };
    });
    log('Builder window keys: ' + JSON.stringify(builderApiInfo));

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-final.png') });
    log('Final URL: ' + page.url());

    // Summary
    log('\n=============================');
    log('BUILDER INVESTIGATION COMPLETE');
    log('The PayHip page builder is a visual WYSIWYG editor.');
    log('Preview iframe: https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL?builder_mode=1');
    log('Current hero text in preview: "Bundle Title"');
    log('Required: click element in iframe → opens edit sidebar');
    log('Need second script to interact with builder sidebar');
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'builder-fatal.png') });
  } finally {
    await browser.close();
  }
})();
