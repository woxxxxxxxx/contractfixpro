/**
 * payhip-bundle-update.js
 * 1. /bundle/settings/basic/rj4IU → update title
 * 2. Page builder → inspect what fields are available for description/hero
 * 3. Confirm price $29, confirm published
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

const NEW_TITLE = 'ContractFixPro Bundle - All 20 Contract Templates';
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
    log('Session OK');

    // ── 1. UPDATE TITLE ────────────────────────────────────────────────────────
    log('\n=== 1. Update Title ===');

    // Navigate via the manage page (which redirects properly)
    await page.goto(`https://payhip.com/bundle/products/${BUNDLE_ID}/manage`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(1500);

    // Click the Settings link
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(
        a => a.textContent.trim() === 'Settings' && a.href.includes('bundle')
      );
      if (link) link.click();
    });
    await sleep(3000);
    log('Settings URL: ' + page.url());
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'update-settings.png') });

    // Find the title input (input[name="name"] at position ~232, 35)
    const titleInput = page.locator('input[name="name"]').first();
    if (await titleInput.count() > 0) {
      const currentValue = await titleInput.inputValue();
      log('Current title: "' + currentValue + '"');

      // Clear and type new title
      await titleInput.click({ clickCount: 3 });
      await sleep(200);
      await titleInput.fill(NEW_TITLE);
      await sleep(300);
      log('Set title to: "' + NEW_TITLE + '"');

      // Save via the form submit button
      const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), input[type="submit"]').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await sleep(2500);
        log('Clicked save. URL: ' + page.url());
      } else {
        // Submit via JS
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        });
        await sleep(2500);
      }

      await page.screenshot({ path: path.join(SCRIPTS_DIR, 'update-settings-saved.png') });

      // Verify by re-reading the input value
      const newValue = await page.evaluate(() => {
        const inp = document.querySelector('input[name="name"]');
        return inp ? inp.value : null;
      });
      log('Title after save: "' + newValue + '"');
      results.title = newValue === NEW_TITLE ? `✓ Updated to "${NEW_TITLE}"` : `Value: "${newValue}"`;
    } else {
      log('Title input not found');
      results.title = 'input not found';
    }

    // ── 2. PAGE BUILDER – inspect for description/hero fields ─────────────────
    log('\n=== 2. Page Builder Inspection ===');
    const builderUrl = 'https://payhip.com/builder/public?builderStartUrl=https%3A%2F%2Fpayhip.com%2Fb%2Frj4IU&builderExitUrl=%2Fbundle%2Fpages%2Frj4IU';
    await page.goto(builderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);  // Wait for builder to load

    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'update-builder.png') });
    log('Builder URL: ' + page.url());

    const builderInfo = await page.evaluate(() => {
      const text = document.body.innerText.slice(0, 800);
      const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({
          tag: el.tagName, name: el.name || '', id: el.id || '',
          placeholder: el.placeholder || '',
          value: (el.value || el.textContent || '').slice(0, 80),
          class: el.className.slice(0, 50)
        }));
      const buttons = Array.from(document.querySelectorAll('button, a[class*="btn"]'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({ text: el.textContent.trim().slice(0, 40), class: el.className.slice(0, 40) }))
        .slice(0, 20);
      const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
        src: f.src, id: f.id, class: f.className
      }));
      return { text, inputs, buttons, iframes };
    });
    log('Builder text: ' + builderInfo.text);
    log('Builder inputs: ' + JSON.stringify(builderInfo.inputs, null, 2));
    log('Builder buttons: ' + JSON.stringify(builderInfo.buttons, null, 2));
    log('Builder iframes: ' + JSON.stringify(builderInfo.iframes, null, 2));

    // Check if the builder is loading inside an iframe
    const frames = page.frames();
    log('Total frames: ' + frames.length);
    for (const frame of frames) {
      log('  Frame: ' + frame.url());
      if (frame.url() !== page.url() && frame.url() !== 'about:blank') {
        const frameInputs = await frame.evaluate(() =>
          Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
            .filter(el => el.getBoundingClientRect().width > 0)
            .map(el => ({
              tag: el.tagName, name: el.name || '', id: el.id || '',
              placeholder: el.placeholder || '',
              value: (el.value || el.textContent || '').slice(0, 80)
            }))
        ).catch(() => []);
        if (frameInputs.length) log('  Frame inputs: ' + JSON.stringify(frameInputs));
      }
    }

    // ── Try navigating to the actual public page to find if there's an edit mode ─
    log('\n=== 3. Check public page for edit mode ===');
    await page.goto('https://payhip.com/order?link=rj4IU&pricing_plan=0XB0RQ73WL', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'update-public.png') });

    const publicText = await page.evaluate(() => document.body.innerText.slice(0, 600));
    log('Public page text: ' + publicText);

    // Check if we're in an edit mode (logged in as owner)
    const editControls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[class*="edit"], [class*="builder"], [data-edit], button'))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0;
        })
        .map(el => ({ tag: el.tagName, text: el.textContent.trim().slice(0, 40), class: el.className.slice(0, 50) }))
        .slice(0, 15);
    });
    log('Edit controls on public page: ' + JSON.stringify(editControls));

    // ── 4. CONFIRM PRICING ─────────────────────────────────────────────────────
    log('\n=== 4. Confirm Pricing ===');
    await page.goto(`https://payhip.com/bundle/pricing/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);
    const pricingText = await page.evaluate(() => document.body.innerText);
    const has29 = pricingText.includes('29.00');
    log('Pricing page: ' + pricingText.slice(200, 500));
    results.pricing = has29 ? '$29.00 ✓' : 'check needed';

    // ── 5. CONFIRM PUBLISHED ──────────────────────────────────────────────────
    log('\n=== 5. Confirm Published ===');
    await page.goto(`https://payhip.com/bundle/publish/${BUNDLE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(1500);
    const publishRadios = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="radio"]'))
        .map(r => ({ value: r.value, checked: r.checked }))
    );
    const isPublished = publishRadios.some(r => r.value === 'published' && r.checked);
    results.published = isPublished ? '✓ Published' : 'not published';
    log('Publish radios: ' + JSON.stringify(publishRadios));

    // ── REPORT ─────────────────────────────────────────────────────────────────
    log('\n=============================');
    log('FINAL RESULTS:');
    log(`  Title:     ${results.title}`);
    log(`  Price:     ${results.pricing}`);
    log(`  Published: ${results.published}`);
    log(`  Bundle URL: https://payhip.com/b/${BUNDLE_ID}`);
    log('\nNOTE: Description and Hero fields are managed via PayHip\'s visual');
    log('      page builder (builder/public) — requires separate handling.');
    log('=============================');

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'update-fatal.png') });
  } finally {
    await browser.close();
  }
})();
