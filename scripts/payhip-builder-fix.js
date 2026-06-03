/**
 * payhip-builder-fix.js
 * Fix: subtitle was overwritten with description text.
 * Steps:
 * 1. Open builder → click "Bundle Title" → fix subtitle
 * 2. Navigate to builder again → click "Example Text" → fill description
 * 3. Publish
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
const BUILDER_URL   = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';

async function loadBuilder(page) {
  await page.goto(BUILDER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(8000);
  log('Builder loaded. URL: ' + page.url());
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
    // Fallback: click by section text in ALL elements
    const all = Array.from(document.querySelectorAll('.sections .section'));
    for (const sec of all) {
      if (sec.textContent.includes(text)) {
        sec.click();
        const rect = sec.getBoundingClientRect();
        return { found: true, fallback: true, y: Math.round(rect.y) };
      }
    }
    return { found: false };
  }, sectionText);
  log(`Click section "${sectionText}": ${JSON.stringify(result)}`);
  await sleep(2000);
  return result;
}

async function fillQlEditor(page, newText) {
  // Fill the visible ql-editor (Quill rich text editor)
  const result = await page.evaluate((text) => {
    const editors = Array.from(document.querySelectorAll('.ql-editor'));
    for (const ed of editors) {
      const rect = ed.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Click to focus
        ed.focus();
        ed.click();
        // Select all and replace
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
        // Also try setting textContent and dispatching events
        if (ed.textContent.trim() !== text) {
          // Try via Quill API
          const quill = ed.__quill || ed.parentElement?.__quill;
          if (quill) {
            quill.setText(text);
            return { method: 'quill-api', text: quill.getText() };
          }
        }
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        ed.dispatchEvent(new Event('change', { bubbles: true }));
        return { method: 'execCommand', text: ed.textContent.trim().slice(0, 60) };
      }
    }
    return { found: false };
  }, newText);
  return result;
}

async function fillTitleInput(page, newTitle) {
  // Find the INPUT with placeholder "Type your heading..."
  const el = await page.$('input.js-input-text[placeholder="Type your heading..."]');
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await sleep(100);
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await sleep(50);
  await el.fill(newTitle);
  await sleep(200);
  log(`Title input filled: "${newTitle}"`);
  return true;
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

    // ── PASS 1: Fix Bundle Title section (title + subtitle) ──────────────────
    log('\n=== Pass 1: Fix Bundle Title section ===');
    await loadBuilder(page);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pass1-start.png') });

    await clickSection(page, 'Bundle Title');

    // Check state
    const state1 = await page.evaluate(() => {
      const titleInput = document.querySelector('input.js-input-text[placeholder="Type your heading..."]');
      const qlEditor = document.querySelector('.ql-editor');
      return {
        titleValue: titleInput ? titleInput.value : null,
        subtitleValue: qlEditor ? qlEditor.textContent.trim().slice(0, 100) : null,
        titleRect: titleInput ? { y: Math.round(titleInput.getBoundingClientRect().y) } : null,
        qlRect: qlEditor ? { y: Math.round(qlEditor.getBoundingClientRect().y) } : null
      };
    });
    log('Current state: ' + JSON.stringify(state1));

    // Fix title if needed
    if (state1.titleValue !== HERO_TITLE) {
      await fillTitleInput(page, HERO_TITLE);
      results.heroTitle = '✓ fixed';
    } else {
      results.heroTitle = '✓ already correct';
      log('Title already correct');
    }

    // Fix subtitle - clear ql-editor and type correct subtitle
    log('Fixing subtitle...');
    const qlEditor = await page.$('.ql-editor');
    if (qlEditor) {
      await qlEditor.click();
      await sleep(200);
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await sleep(100);
      await page.keyboard.type(HERO_SUBTITLE);
      await sleep(500);
      results.heroSubtitle = '✓ fixed';
      log('Subtitle set: ' + HERO_SUBTITLE);
    }

    // Wait for autosave
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pass1-done.png') });

    // Verify the ql-editor content
    const verify1 = await page.evaluate(() => {
      const ed = document.querySelector('.ql-editor');
      return ed ? ed.textContent.trim().slice(0, 100) : null;
    });
    log('ql-editor after fix: ' + verify1);

    // ── PASS 2: Navigate back and edit Example Text section ──────────────────
    log('\n=== Pass 2: Edit Example Text section ===');

    // Try to go back to sections list using a back button or re-navigate
    // First try: look for a back/navigate-back button
    const backBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, [class*="back"], [class*="navigate-back"]'));
      for (const btn of btns) {
        const rect = btn.getBoundingClientRect();
        const text = (btn.textContent || btn.className || '').toLowerCase();
        if (rect.width > 0 && rect.height > 0 && (
          text.includes('back') || text.includes('←') || text.includes('sections') ||
          btn.className.includes('back') || btn.className.includes('navigate-back')
        )) {
          return { found: true, text: btn.textContent.trim().slice(0, 30), class: btn.className.slice(0, 40) };
        }
      }
      return { found: false };
    });
    log('Back button: ' + JSON.stringify(backBtn));

    // Re-load builder to reset to sections list view
    log('Re-loading builder to get fresh sections list...');
    await loadBuilder(page);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pass2-start.png') });

    // Now click Example Text section
    const exTextClicked = await clickSection(page, 'Example Text');
    log('Example Text section clicked: ' + JSON.stringify(exTextClicked));

    if (!exTextClicked.found) {
      // Try clicking by coordinate (from earlier analysis: Example Text was at y~307 in sidebar)
      log('Trying coordinate click for Example Text at (150, 307)');
      await page.mouse.click(150, 307);
      await sleep(2000);
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pass2-example-text.png') });

    const state2 = await page.evaluate(() => {
      const qlEditors = Array.from(document.querySelectorAll('.ql-editor'))
        .filter(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      return qlEditors.map(e => ({
        text: e.textContent.trim().slice(0, 80),
        rect: { y: Math.round(e.getBoundingClientRect().y), h: Math.round(e.getBoundingClientRect().height) }
      }));
    });
    log('ql-editors visible after Example Text click: ' + JSON.stringify(state2));

    // Fill description in the ql-editor
    const qlEditors = await page.$$('.ql-editor');
    let descFilled = false;
    for (const ed of qlEditors) {
      const rect = await ed.boundingBox();
      if (rect && rect.width > 0 && rect.height > 0) {
        // Check it's not the subtitle editor (which we already filled)
        const currentText = await ed.evaluate(el => el.textContent.trim());
        log(`Found ql-editor with text: "${currentText.slice(0, 60)}"`);
        if (!currentText.includes('One purchase') && currentText.length > 0) {
          // This is Example Text's body editor
          await ed.click();
          await sleep(200);
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await sleep(100);
          await page.keyboard.type(DESC_TEXT);
          await sleep(500);
          results.description = '✓ filled';
          descFilled = true;
          log('Description filled');
          break;
        } else if (currentText.length === 0 || currentText.includes('Use this text')) {
          // Empty or placeholder text - this is the description editor
          await ed.click();
          await sleep(200);
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await sleep(100);
          await page.keyboard.type(DESC_TEXT);
          await sleep(500);
          results.description = '✓ filled';
          descFilled = true;
          log('Description filled (was empty/placeholder)');
          break;
        }
      }
    }

    if (!descFilled) {
      log('Description field not found - trying first visible ql-editor');
      const firstEd = await page.$('.ql-editor');
      if (firstEd) {
        await firstEd.click();
        await sleep(200);
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await sleep(100);
        await page.keyboard.type(DESC_TEXT);
        await sleep(500);
        results.description = '✓ filled (fallback)';
      }
    }

    // Wait for autosave
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-pass2-done.png') });

    // ── PUBLISH ──────────────────────────────────────────────────────────────
    log('\n=== Publishing ===');
    const publishBtn = await page.$('button.publish-button, button.js-publish-button');
    if (publishBtn) {
      await publishBtn.click();
      await sleep(3000);
      log('Clicked Publish');

      // Handle confirmation
      const confirmed = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const b of btns) {
          const rect = b.getBoundingClientRect();
          const txt = b.textContent.trim().toLowerCase();
          if (rect.width > 0 && (txt.includes('save changes') || txt.includes('confirm') || txt === 'publish')) {
            if (!b.classList.contains('js-publish-button')) {
              b.click();
              return b.textContent.trim();
            }
          }
        }
        return null;
      });
      if (confirmed) {
        log('Confirmed: ' + confirmed);
        await sleep(3000);
      }
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-published.png') });

    // ── VERIFY ───────────────────────────────────────────────────────────────
    log('\n=== Verify public page ===');
    await page.goto('https://payhip.com/b/rj4IU', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 800));
    log('Public page: ' + publicText);

    results.titleOnPage    = publicText.includes(HERO_TITLE) ? '✓' : '✗';
    results.subtitleOnPage = publicText.includes('One purchase') ? '✓' : '✗';
    results.descOnPage     = publicText.includes('Get all 20 professional') ? '✓' : '✗';

    log('\n=============================');
    log('FINAL RESULTS:');
    log(`  Hero Title (${results.titleOnPage}):    "${HERO_TITLE}"`);
    log(`  Hero Subtitle (${results.subtitleOnPage}): "${HERO_SUBTITLE}"`);
    log(`  Description (${results.descOnPage}):   ${results.description || 'not updated'}`);
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fix-fatal.png') });
  } finally {
    await browser.close();
  }
})();
