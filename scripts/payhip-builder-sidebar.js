/**
 * payhip-builder-sidebar.js
 * Click sections in the LEFT SIDEBAR to open section editor,
 * then fill in title/subtitle/description text fields.
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

async function clickSectionInSidebar(page, sectionText) {
  // Click the section's inner-wrapper div that matches the text
  const clicked = await page.evaluate((text) => {
    const sections = Array.from(document.querySelectorAll('div.section.js-section.js-main-navigate-button'));
    for (const sec of sections) {
      const textDiv = sec.querySelector('div.text');
      if (textDiv && textDiv.textContent.trim() === text) {
        const rect = sec.getBoundingClientRect();
        // Click in the middle of the section
        sec.click();
        return { found: true, rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } };
      }
    }
    return { found: false };
  }, sectionText);
  log(`Clicked sidebar section "${sectionText}": ${JSON.stringify(clicked)}`);
  return clicked;
}

async function dumpEditorPanel(page, label) {
  await sleep(2000);
  await page.screenshot({ path: path.join(SCRIPTS_DIR, `sidebar-${label}.png`) });

  // Dump all inputs in the editor panel (right side or replaced left panel)
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]'))
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          type: el.type || '',
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          value: (el.value || el.textContent || '').slice(0, 120),
          class: (el.className || '').toString().slice(0, 80),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          visible: rect.width > 0 && rect.height > 0
        };
      });
  });
  log(`[${label}] Editor inputs: ${JSON.stringify(inputs, null, 2)}`);
  return inputs;
}

async function fillFieldByValue(page, currentValue, newValue) {
  // Find the input that currently contains the currentValue and fill it
  const result = await page.evaluate(({ current, newVal }) => {
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]'));
    for (const inp of inputs) {
      const val = (inp.value || inp.textContent || '').trim();
      const rect = inp.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && val.includes(current.slice(0, 20))) {
        // Use native input setter for React/Vue controlled inputs
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (inp.tagName === 'INPUT' && nativeInputValueSetter) {
          nativeInputValueSetter.set.call(inp, newVal);
        } else if (inp.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.set.call(inp, newVal);
        } else if (inp.contentEditable === 'true') {
          inp.textContent = newVal;
        } else {
          inp.value = newVal;
        }
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, tag: inp.tagName, rect: { x: Math.round(rect.x), y: Math.round(rect.y) } };
      }
    }
    return { found: false };
  }, { current: currentValue, newVal: newValue });
  return result;
}

async function clearAndType(page, selector, newValue) {
  const el = await page.$(selector);
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await sleep(100);
  await page.keyboard.press('Control+a');
  await sleep(50);
  await page.keyboard.type(newValue);
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

    const builderUrl = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';
    await page.goto(builderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(8000);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sidebar-initial.png') });
    log('Builder loaded');

    // ── STEP 1: Click "Bundle Title" section in the sidebar ──────────────────
    log('\n=== Step 1: Edit "Bundle Title" section ===');
    await clickSectionInSidebar(page, 'Bundle Title');
    const inputs1 = await dumpEditorPanel(page, 'bundle-title-section');

    // Check what opened - look for text fields
    const visibleInputs1 = inputs1.filter(i => i.visible);
    log(`Visible inputs after clicking Bundle Title: ${visibleInputs1.length}`);

    if (visibleInputs1.length > 0) {
      // Try to identify title and subtitle fields
      for (const inp of visibleInputs1) {
        log(`  Input: ${inp.tag} placeholder="${inp.placeholder}" value="${inp.value.slice(0, 50)}" pos=(${inp.rect.x},${inp.rect.y})`);
      }

      // Fill title field - look for field with "Bundle Title" as value or "title" in placeholder
      for (const inp of visibleInputs1) {
        if (inp.value.includes('Bundle Title') || inp.placeholder.toLowerCase().includes('title')) {
          log(`Filling title field at (${inp.rect.x}, ${inp.rect.y})`);
          await page.mouse.click(inp.rect.x + 10, inp.rect.y + inp.rect.h / 2 || inp.rect.y + 15);
          await sleep(200);
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await sleep(100);
          await page.keyboard.type(HERO_TITLE);
          await sleep(300);
          results.heroTitle = `✓ typed: ${HERO_TITLE}`;
          log(`Filled title: ${HERO_TITLE}`);
          break;
        }
      }

      // Fill subtitle field
      for (const inp of visibleInputs1) {
        if (inp.value.includes('descriptive sentence') || inp.placeholder.toLowerCase().includes('subtitle')) {
          log(`Filling subtitle field at (${inp.rect.x}, ${inp.rect.y})`);
          await page.mouse.click(inp.rect.x + 10, inp.rect.y + inp.rect.h / 2 || inp.rect.y + 15);
          await sleep(200);
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await sleep(100);
          await page.keyboard.type(HERO_SUBTITLE);
          await sleep(300);
          results.heroSubtitle = `✓ typed: ${HERO_SUBTITLE}`;
          log(`Filled subtitle: ${HERO_SUBTITLE}`);
          break;
        }
      }
    }

    // ── STEP 2: Try filling via native value setter ──────────────────────────
    if (!results.heroTitle) {
      log('\n=== Step 2: Fill via native value setter ===');
      const r1 = await fillFieldByValue(page, 'Bundle Title', HERO_TITLE);
      log('Fill title result: ' + JSON.stringify(r1));
      if (r1.found) results.heroTitle = '✓ set via native setter';

      const r2 = await fillFieldByValue(page, 'short, descriptive', HERO_SUBTITLE);
      log('Fill subtitle result: ' + JSON.stringify(r2));
      if (r2.found) results.heroSubtitle = '✓ set via native setter';

      await sleep(1000);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sidebar-after-fill.png') });
    }

    // ── STEP 3: Try clicking "Example Text" section for description ──────────
    log('\n=== Step 3: Edit "Example Text" section ===');
    await clickSectionInSidebar(page, 'Example Text');
    const inputs3 = await dumpEditorPanel(page, 'example-text-section');

    const visibleInputs3 = inputs3.filter(i => i.visible);
    log(`Visible inputs after clicking Example Text: ${visibleInputs3.length}`);

    for (const inp of visibleInputs3) {
      log(`  Input: ${inp.tag} placeholder="${inp.placeholder}" value="${inp.value.slice(0, 60)}" pos=(${inp.rect.x},${inp.rect.y})`);
    }

    // Look for description/body text field
    for (const inp of visibleInputs3) {
      if (inp.tag === 'TEXTAREA' || (inp.value && inp.value.length > 30) ||
          inp.placeholder.toLowerCase().includes('text') || inp.placeholder.toLowerCase().includes('body')) {
        log(`Filling description field at (${inp.rect.x}, ${inp.rect.y})`);
        await page.mouse.click(inp.rect.x + 10, inp.rect.y + 15);
        await sleep(200);
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await sleep(100);
        await page.keyboard.type(DESC_TEXT);
        await sleep(300);
        results.description = `✓ typed`;
        log('Filled description');
        break;
      }
    }

    // ── STEP 4: Go back to Bundle Title section if not filled yet ────────────
    if (!results.heroTitle) {
      log('\n=== Step 4: Retry Bundle Title via left sidebar click ===');

      // Navigate back - click something to reset to sections list
      await page.click('.js-sidebar-menu .section', { timeout: 3000 }).catch(() => {});
      await sleep(500);

      // Click the "Bundle Title" section
      await page.mouse.click(150, 260);
      await sleep(2000);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sidebar-retry-title.png') });

      const inputsRetry = await dumpEditorPanel(page, 'retry-title');
      log('Retry inputs: ' + JSON.stringify(inputsRetry.filter(i => i.visible)));
    }

    // ── STEP 5: Publish ──────────────────────────────────────────────────────
    log('\n=== Step 5: Publish ===');
    const publishBtn = await page.$('button.publish-button, button.js-publish-button');
    if (publishBtn) {
      await publishBtn.click();
      await sleep(3000);
      log('Clicked Publish');

      // Confirm if modal appears
      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sidebar-publish.png') });

      const confirmBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const b of btns) {
          const rect = b.getBoundingClientRect();
          const txt = b.textContent.trim().toLowerCase();
          if (rect.width > 0 && (txt.includes('publish') || txt.includes('confirm') || txt.includes('save'))) {
            if (!b.classList.contains('js-publish-button')) {
              b.click();
              return b.textContent.trim();
            }
          }
        }
        return null;
      });
      if (confirmBtn) {
        log('Confirmed: ' + confirmBtn);
        await sleep(2000);
      }
    }

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sidebar-final.png') });

    // ── STEP 6: Verify ───────────────────────────────────────────────────────
    log('\n=== Step 6: Verify public page ===');
    await page.goto('https://payhip.com/b/rj4IU', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 600));
    log('Public page text: ' + publicText);
    results.heroTitleOnPage = publicText.includes('Get All 20') ? '✓ visible' : 'not found';

    log('\n=============================');
    log('RESULTS:');
    log(`  Hero Title:    ${results.heroTitle || 'not updated'}`);
    log(`  Hero Subtitle: ${results.heroSubtitle || 'not updated'}`);
    log(`  Description:   ${results.description || 'not updated'}`);
    log(`  On Public Page: ${results.heroTitleOnPage || 'unknown'}`);
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'sidebar-fatal.png') });
  } finally {
    await browser.close();
  }
})();
