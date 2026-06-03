/**
 * payhip-fix-subtitle.js
 * Fix Bundle Title section subtitle to the correct short text.
 * Wait for sections list to be ready before clicking.
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

async function waitForSectionsReady(page, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const count = await page.evaluate(() =>
      document.querySelectorAll('div.section.js-section.js-main-navigate-button').length
    );
    if (count >= 3) {
      log(`Sections ready (${count} found)`);
      return true;
    }
    await sleep(500);
  }
  log('WARNING: sections did not become ready in time');
  return false;
}

async function clickSection(page, sectionText) {
  const result = await page.evaluate((text) => {
    const sections = Array.from(document.querySelectorAll('div.section.js-section.js-main-navigate-button'));
    for (const sec of sections) {
      const textDiv = sec.querySelector('div.text');
      if (textDiv && textDiv.textContent.trim() === text) {
        sec.click();
        const rect = sec.getBoundingClientRect();
        return { found: true, y: Math.round(rect.y) };
      }
    }
    return { found: false, total: sections.length };
  }, sectionText);
  log(`Click section "${sectionText}": ${JSON.stringify(result)}`);
  return result;
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

    // Wait for sections list to be ready
    await waitForSectionsReady(page);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'subtitle-fix-start.png') });

    // Click "Bundle Title" section
    const clicked = await clickSection(page, 'Bundle Title');
    if (!clicked.found) {
      log('Bundle Title section not found - dumping sidebar sections:');
      const sections = await page.evaluate(() =>
        Array.from(document.querySelectorAll('div.section.js-section.js-main-navigate-button'))
          .map(s => ({
            text: s.querySelector('div.text')?.textContent.trim() || '',
            rect: { y: Math.round(s.getBoundingClientRect().y) }
          }))
      );
      log('Sections: ' + JSON.stringify(sections));
    }

    await sleep(2000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'subtitle-fix-after-click.png') });

    // Check what editor opened
    const editorState = await page.evaluate(() => {
      const titleInput = document.querySelector('input.js-input-text[placeholder="Type your heading..."]');
      const qlEditor = document.querySelector('.ql-editor');
      return {
        titleValue: titleInput ? titleInput.value : null,
        subtitleText: qlEditor ? qlEditor.textContent.trim().slice(0, 100) : null,
        qlRect: qlEditor ? {
          x: Math.round(qlEditor.getBoundingClientRect().x),
          y: Math.round(qlEditor.getBoundingClientRect().y),
          w: Math.round(qlEditor.getBoundingClientRect().width),
          h: Math.round(qlEditor.getBoundingClientRect().height)
        } : null
      };
    });
    log('Editor state: ' + JSON.stringify(editorState));

    if (editorState.qlRect && editorState.qlRect.w > 0) {
      // Click into the ql-editor
      const qlEditor = await page.$('.ql-editor');
      await qlEditor.click();
      await sleep(200);

      // Select all and delete
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(100);
      await page.keyboard.press('Delete');
      await sleep(100);

      // Type the correct subtitle
      await page.keyboard.type(HERO_SUBTITLE);
      await sleep(500);

      // Verify
      const afterType = await page.evaluate(() => {
        const ed = document.querySelector('.ql-editor');
        return ed ? ed.textContent.trim() : null;
      });
      log('After typing subtitle: "' + afterType + '"');

      if (afterType && afterType.includes('One purchase')) {
        log('✓ Subtitle correct!');
      } else {
        log('WARNING: subtitle may not have been set correctly');
      }

      // Also verify title field
      const titleVal = await page.evaluate(() => {
        const inp = document.querySelector('input.js-input-text[placeholder="Type your heading..."]');
        return inp ? inp.value : null;
      });
      log('Title field value: "' + titleVal + '"');

      if (titleVal !== HERO_TITLE) {
        log('Fixing title too...');
        const titleInput = await page.$('input.js-input-text[placeholder="Type your heading..."]');
        await titleInput.click({ clickCount: 3 });
        await titleInput.fill(HERO_TITLE);
        await sleep(200);
        log('Title fixed');
      }
    } else {
      log('ERROR: ql-editor not visible - cannot fix subtitle');
    }

    // Wait for autosave
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'subtitle-fix-before-publish.png') });

    // Publish
    log('\n=== Publishing ===');
    const publishBtn = await page.$('button.publish-button, button.js-publish-button');
    if (publishBtn) {
      await publishBtn.click();
      await sleep(3000);

      const confirmed = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const b of btns) {
          const rect = b.getBoundingClientRect();
          const txt = b.textContent.trim().toLowerCase();
          if (rect.width > 0 && (txt.includes('save changes') || txt === 'publish') && !b.classList.contains('js-publish-button')) {
            b.click();
            return b.textContent.trim();
          }
        }
        return null;
      });
      if (confirmed) {
        log('Confirmed publish: ' + confirmed);
        await sleep(3000);
      }
    }

    // Verify
    log('\n=== Verifying public page ===');
    await page.goto('https://payhip.com/b/rj4IU', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 600));
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
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'subtitle-fix-fatal.png') });
  } finally {
    await browser.close();
  }
})();
