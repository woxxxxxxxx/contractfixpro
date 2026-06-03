/**
 * payhip-fix-subtitle2.js
 * The Bundle Title section now shows "Get All 20 Contract Templates" in sidebar.
 * Click it, then fix the ql-editor subtitle to the short text.
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
const BUILDER_URL   = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';

async function waitForSections(page, minCount = 3, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const count = await page.evaluate(() =>
      document.querySelectorAll('div.section.js-section.js-main-navigate-button').length
    );
    if (count >= minCount) return true;
    await sleep(500);
  }
  return false;
}

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1400, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);
    log('Session OK');

    await page.goto(BUILDER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);
    await waitForSections(page);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sub2-start.png') });

    // List all sidebar sections
    const sections = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div.section.js-section.js-main-navigate-button'))
        .map(s => ({
          text: s.querySelector('div.text')?.textContent.trim() || '',
          y: Math.round(s.getBoundingClientRect().y)
        }))
    );
    log('Sidebar sections: ' + JSON.stringify(sections));

    // Click the first "content" section (at y~232, after Header which is at y~161)
    // The Bundle Title section is the first draggable section (has show-drag class)
    const bundleTitleClicked = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('div.section.js-section.js-main-navigate-button'));
      for (const sec of sections) {
        const textDiv = sec.querySelector('div.text');
        const text = textDiv?.textContent.trim() || '';
        // The Bundle Title section has an image-preview (thumbnail), Header doesn't
        const hasThumb = sec.querySelector('.image-preview-wrapper');
        const rect = sec.getBoundingClientRect();
        // It's the first section with a thumbnail
        if (hasThumb && rect.width > 0) {
          sec.click();
          return { found: true, text, y: Math.round(rect.y) };
        }
      }
      // Fallback: click section at y~232 by coordinate
      const target = sections.find(s => {
        const r = s.getBoundingClientRect();
        return r.y > 200 && r.y < 280;
      });
      if (target) {
        target.click();
        return { found: true, text: target.querySelector('div.text')?.textContent.trim(), y: Math.round(target.getBoundingClientRect().y), fallback: true };
      }
      return { found: false };
    });
    log('Bundle Title section click: ' + JSON.stringify(bundleTitleClicked));
    await sleep(2000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sub2-after-click.png') });

    const editorState = await page.evaluate(() => {
      const titleInput = document.querySelector('input.js-input-text[placeholder="Type your heading..."]');
      const qlEditors = Array.from(document.querySelectorAll('.ql-editor'))
        .filter(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map(e => ({
          text: e.textContent.trim().slice(0, 80),
          rect: { y: Math.round(e.getBoundingClientRect().y), h: Math.round(e.getBoundingClientRect().height) }
        }));
      return {
        titleValue: titleInput ? titleInput.value : null,
        qlEditors
      };
    });
    log('Editor state: ' + JSON.stringify(editorState, null, 2));

    if (editorState.qlEditors.length > 0) {
      const ed = editorState.qlEditors[0];
      log(`ql-editor current text: "${ed.text}"`);

      // Click into ql-editor and replace content
      const qlEl = await page.$('.ql-editor');
      await qlEl.click();
      await sleep(300);

      // Select all text in the editor
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(150);

      // Delete and type new subtitle
      await page.keyboard.press('Backspace');
      await sleep(100);
      await page.keyboard.type(HERO_SUBTITLE);
      await sleep(500);

      // Verify
      const afterType = await page.evaluate(() => {
        const ed = document.querySelector('.ql-editor');
        return ed ? ed.textContent.trim() : null;
      });
      log('After typing subtitle: "' + afterType + '"');

      if (afterType && afterType.includes('One purchase')) {
        log('✓ Subtitle fixed!');
      } else {
        log('WARNING: subtitle text: ' + afterType);
      }
    } else {
      log('ERROR: No ql-editor visible');
    }

    // Verify title is correct too
    const titleCheck = await page.evaluate(() => {
      const inp = document.querySelector('input.js-input-text[placeholder="Type your heading..."]');
      return inp ? inp.value : null;
    });
    log('Title check: "' + titleCheck + '"');

    if (titleCheck && titleCheck !== HERO_TITLE) {
      log('Fixing title too...');
      const inp = await page.$('input.js-input-text[placeholder="Type your heading..."]');
      await inp.click({ clickCount: 3 });
      await inp.fill(HERO_TITLE);
    }

    // Wait for autosave
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sub2-autosaved.png') });

    // Publish
    log('\n=== Publish ===');
    await page.click('button.publish-button, button.js-publish-button');
    await sleep(3000);

    // Confirm if needed
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        const txt = b.textContent.trim().toLowerCase();
        if (rect.width > 0 && txt.includes('save changes') && !b.classList.contains('js-publish-button')) {
          b.click();
          return;
        }
      }
    });
    await sleep(3000);

    // Verify
    await page.goto('https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    log('Public page:\n' + publicText);

    const hasTitle    = publicText.includes(HERO_TITLE);
    const hasSubtitle = publicText.includes('One purchase');
    const hasDesc     = publicText.includes('Get all 20 professional');

    log('\n=============================');
    log(`Hero Title    (${hasTitle ? '✓' : '✗'}): "${HERO_TITLE}"`);
    log(`Hero Subtitle (${hasSubtitle ? '✓' : '✗'}): "${HERO_SUBTITLE}"`);
    log(`Description   (${hasDesc ? '✓' : '✗'}): present`);
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sub2-fatal.png') });
  } finally {
    await browser.close();
  }
})();
