/**
 * payhip-delete-dupes2.js
 * Phase 2: 13 active duplicates still need deletion (keep-list restores already done).
 * 1. Archive the 13 active duplicates → moves them to archived
 * 2. Delete all 30 archived products using js-delete-digital-product-link
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const path = require('path');
const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

// Active duplicates to archive then delete (NOT in keep list, price=$7)
const TO_DELETE_ACTIVE = [
  'cahrF', 'd4pSr', '5JhHd', 'keHxu', '9ZqNG', 'FouB3',
  '0GSYH', 'C79N3', '32OWj', '7lYf2', '5latZ', 'B0Qcx', 'fJ6Ho',
];

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }

// ── Archive one active product (confirmed working approach) ───────────────────
async function archiveActive(page, id) {
  for (let offset = 0; offset <= 200; offset += 10) {
    const url = offset === 0
      ? 'https://payhip.com/products?listingStatus=active'
      : `https://payhip.com/products?listingStatus=active&page=${offset}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);

    const exists = await page.evaluate((pid) =>
      !!document.querySelector(`a[href*="/b/${pid}"]`), id);
    if (!exists) {
      const hasProducts = await page.evaluate(() => !!document.querySelector('a[href*="payhip.com/b/"]'));
      if (!hasProducts) { log(`    End of active list`); return false; }
      continue;
    }

    // Click js-archive-product-link in this product's row
    const result = await page.evaluate((pid) => {
      const allAnchors = Array.from(document.querySelectorAll('a'));
      const viewAnchor = allAnchors.find(a =>
        a.href.includes('/b/' + pid) && a.textContent.trim() === 'View'
      );
      if (!viewAnchor) return 'no-view';
      let row = viewAnchor.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!row) break;
        const link = row.querySelector('.js-archive-product-link');
        if (link) { link.click(); return 'clicked'; }
        row = row.parentElement;
      }
      return 'no-archive-link';
    }, id);

    if (result !== 'clicked') { log(`    ✗ archive-click failed: ${result}`); return false; }

    await page.waitForTimeout(700);
    // Click "Archive Product" in modal
    const confirmBtn = page.locator('button').filter({ hasText: 'Archive Product' }).first();
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      return true;
    } catch(e) {
      log(`    ✗ archive modal failed: ${e.message.slice(0,60)}`);
      return false;
    }
  }
  return false;
}

// ── Delete one archived product ───────────────────────────────────────────────
async function deleteArchived(page, id) {
  for (let offset = 0; offset <= 300; offset += 10) {
    const url = offset === 0
      ? 'https://payhip.com/products?listingStatus=archived'
      : `https://payhip.com/products?listingStatus=archived&page=${offset}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);

    const exists = await page.evaluate((pid) =>
      !!document.querySelector(`a[href*="/b/${pid}"]`), id);
    if (!exists) {
      const hasProducts = await page.evaluate(() => !!document.querySelector('a[href*="payhip.com/b/"]'));
      if (!hasProducts) { log(`    End of archived list`); return false; }
      continue;
    }

    // Click js-delete-digital-product-link in this product's row
    // (class on archived page is "action-delete js-delete-digital-product-link")
    const result = await page.evaluate((pid) => {
      const allAnchors = Array.from(document.querySelectorAll('a'));
      const anyAnchor = allAnchors.find(a => a.href.includes('/b/' + pid));
      if (!anyAnchor) return 'no-anchor';
      let row = anyAnchor.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!row) break;
        const link = row.querySelector('.js-delete-digital-product-link');
        if (link) { link.click(); return 'clicked'; }
        row = row.parentElement;
      }
      // Fallback: open "..." and click delete
      let row2 = anyAnchor.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!row2) break;
        const btns = Array.from(row2.querySelectorAll('button'));
        const moreBtn = btns.find(b => b.textContent.trim() === '...' || b.textContent.trim() === '•••');
        if (moreBtn) { moreBtn.click(); return 'dropdown'; }
        row2 = row2.parentElement;
      }
      return 'no-delete-link';
    }, id);

    if (result === 'dropdown') {
      await page.waitForTimeout(600);
      const delOpt = page.locator('a, button').filter({ hasText: /delete/i }).last();
      if (await delOpt.count() > 0) { await delOpt.click(); await page.waitForTimeout(500); }
    }

    if (result === 'no-delete-link' || result === 'no-anchor') {
      log(`    ✗ delete-click failed: ${result}`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `del-fail2-${id}.png`) });
      return false;
    }

    // Confirm the Delete modal
    await page.waitForTimeout(800);
    const confirmBtn = page.locator('button').filter({ hasText: 'Delete Product' }).first();
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      return true;
    } catch(e) {
      // Fallback
      const fallback = page.locator('button').filter({ hasText: 'Delete' }).last();
      if (await fallback.count() > 0 && await fallback.isVisible()) {
        await fallback.click();
        await page.waitForTimeout(2000);
        return true;
      }
      log(`    ✗ delete modal failed: ${e.message.slice(0,60)}`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `del-modal2-${id}.png`) });
      return false;
    }
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1280, height: 800 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    // Verify login
    await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    log('Starting. URL: ' + page.url());

    // ── Phase 1: Archive the 13 active duplicates ───────────────────────────
    log(`\n=== Phase 1: Archive ${TO_DELETE_ACTIVE.length} active duplicates ===`);
    let archived = 0, archiveFailed = 0;
    for (const id of TO_DELETE_ACTIVE) {
      log(`  Archiving ${id}...`);
      const ok = await archiveActive(page, id);
      if (ok) { log(`    ✓ Archived`); archived++; }
      else { archiveFailed++; }
    }
    log(`Archived: ${archived}, Failed: ${archiveFailed}`);

    // ── Phase 2: Get all archived products ──────────────────────────────────
    log('\n=== Phase 2: Scraping all archived products ===');
    const allArchived = [];
    for (let offset = 0; offset <= 300; offset += 10) {
      const url = offset === 0
        ? 'https://payhip.com/products?listingStatus=archived'
        : `https://payhip.com/products?listingStatus=archived&page=${offset}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);

      const products = await page.evaluate(() => {
        const seen = new Set();
        const result = [];
        document.querySelectorAll('a[href*="payhip.com/b/"]').forEach(a => {
          const url = a.href.split('?')[0];
          if (seen.has(url)) return;
          seen.add(url);
          result.push({ viewUrl: url });
        });
        return result;
      });

      if (products.length === 0) { log(`  Offset ${offset}: empty`); break; }
      log(`  Offset ${offset}: ${products.length} products`);
      allArchived.push(...products);
    }

    const seenUrls = new Set();
    const uniqueArchived = allArchived.filter(p => {
      if (seenUrls.has(p.viewUrl)) return false;
      seenUrls.add(p.viewUrl);
      return true;
    });
    log(`Total archived: ${uniqueArchived.length}`);

    // ── Phase 3: Delete all archived products ───────────────────────────────
    log(`\n=== Phase 3: Deleting ${uniqueArchived.length} archived products ===`);
    let deleted = 0, deleteFailed = 0;
    for (const p of uniqueArchived) {
      const m = p.viewUrl.match(/\/b\/([a-zA-Z0-9]+)/);
      const id = m ? m[1] : null;
      if (!id) continue;
      log(`  Deleting ${id}...`);
      const ok = await deleteArchived(page, id);
      if (ok) { log(`    ✓ Deleted`); deleted++; }
      else { deleteFailed++; }
    }
    log(`Deleted: ${deleted}, Failed: ${deleteFailed}`);

    // ── Final verification ──────────────────────────────────────────────────
    log('\n=== Final verification ===');
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const counts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, span'))
        .map(el => el.textContent.trim())
        .filter(t => /\(\d+\)/.test(t))
        .slice(0, 5)
    );
    log('Counts: ' + counts.join(' | '));
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-state2.png') });

    log('\n=== SUMMARY ===');
    log(`Archived (from active): ${archived}`);
    log(`Deleted (from archive): ${deleted}`);
    log(`Delete failed:          ${deleteFailed}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    try { await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fatal2.png') }); } catch(_) {}
  } finally {
    await browser.close();
  }
})();
