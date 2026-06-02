/**
 * payhip-delete-dupes.js
 * Keep only the 21 products in links.txt + all Notion templates ($9/$15/$19).
 * 1. Scrape all active products
 * 2. Mark for deletion: $7 products NOT in keep list
 * 3. Permanently delete marked products
 * 4. Restore archived keep-list products
 * 5. Report summary
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const SESSION_DIR = path.join(SCRIPTS_DIR, 'browser-session');

// Products to KEEP (short codes from links.txt)
// Note: task5.txt uses "o1MGY" and "XwrT1" — these are "olMGY" and "XwrTl" (lowercase L)
const KEEP_IDS = new Set([
  'IqKOU', 'OSrLd', 'ESFAf', '95Ldk', 'PXypJ', 'JnxV6', 'Fqx8U', 'nlbrg', 'olMGY',
  'Jnk5i', 'XwrTl', 'SMr4P', 'a4XrJ', 'BODnW', 'mfh9v', '4QlZi', 'fhjGb', 'UTxa8',
  'cYnSp', 'btWfS',
  'rj4IU', // bundle
]);

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }

function getProductId(url) {
  const m = (url || '').match(/\/b\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function ensureLoggedIn(page) {
  await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  if (!page.url().includes('login') && !page.url().includes('auth')) {
    log('Already logged in: ' + page.url()); return;
  }
  log('Logging in...');
  await page.goto('https://payhip.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="login"]', 'xiaohuixie3@gmail.com');
  await page.fill('input[name="password"]', 'xxh113824');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  if (page.url().includes('login')) {
    log('>>> reCAPTCHA — solve manually...');
    while (page.url().includes('login')) await page.waitForTimeout(2000);
  }
  log('Logged in: ' + page.url());
}

// ── Scrape products from one status (active or archived) ──────────────────────
async function scrapeProducts(page, status = 'active') {
  log(`  Scraping ${status} products...`);
  const all = [];

  for (let offset = 0; offset <= 200; offset += 10) {
    const url = offset === 0
      ? `https://payhip.com/products?listingStatus=${status}`
      : `https://payhip.com/products?listingStatus=${status}&page=${offset}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const products = await page.evaluate(() => {
      const result = [];
      const seen = new Set();
      document.querySelectorAll('a[href*="payhip.com/b/"]').forEach(a => {
        const url = a.href.split('?')[0];
        if (seen.has(url)) return;
        seen.add(url);
        const row = a.closest('li') || a.closest('tr') ||
                    a.closest('[class*="product"]') || a.parentElement?.parentElement;
        // Get price text from row
        const priceText = row?.textContent || '';
        const priceMatch = priceText.match(/\$(\d+(?:\.\d+)?)\s*price/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : null;
        // Get name: prefer title-style anchor (not "View"/"Edit")
        const buttonTexts = new Set(['View', 'Edit', 'Share / Embed', 'Manage']);
        const anchors = Array.from(row?.querySelectorAll('a[href*="payhip.com/b/"]') || []);
        const titleAnchor = anchors.find(a2 => !buttonTexts.has(a2.textContent.trim()));
        result.push({
          name: titleAnchor?.textContent?.trim() || '',
          viewUrl: url,
          price,
        });
      });
      return result;
    });

    if (products.length === 0) { log(`  Offset ${offset}: empty, stopping`); break; }
    log(`  Offset ${offset}: ${products.length} products`);
    all.push(...products);
  }

  // Dedupe by URL
  const seen = new Set();
  return all.filter(p => {
    if (seen.has(p.viewUrl)) return false;
    seen.add(p.viewUrl);
    return true;
  });
}

// ── Delete a product permanently ──────────────────────────────────────────────
async function deleteProduct(page, product) {
  const id = getProductId(product.viewUrl);
  log(`  Deleting: "${product.name}" (${id})`);

  // Navigate to page containing this product
  for (let offset = 0; offset <= 200; offset += 10) {
    const url = offset === 0
      ? 'https://payhip.com/products?listingStatus=active'
      : `https://payhip.com/products?listingStatus=active&page=${offset}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const exists = await page.evaluate((pid) =>
      !!document.querySelector(`a[href*="/b/${pid}"]`), id);

    if (!exists) {
      const hasProducts = await page.evaluate(() => !!document.querySelector('a[href*="payhip.com/b/"]'));
      if (!hasProducts) { log(`    End of list`); return false; }
      continue;
    }

    // Click js-delete-product-link in this product's row
    const result = await page.evaluate((pid) => {
      const allAnchors = Array.from(document.querySelectorAll('a'));
      const viewAnchor = allAnchors.find(a =>
        a.href.includes('/b/' + pid) && a.textContent.trim() === 'View'
      );
      if (!viewAnchor) return 'no-view-anchor';
      let row = viewAnchor.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!row) break;
        const deleteLink = row.querySelector('.js-delete-product-link');
        if (deleteLink) { deleteLink.click(); return 'clicked'; }
        row = row.parentElement;
      }
      return 'no-delete-link';
    }, id);

    if (result !== 'clicked') {
      log(`    ✗ Could not click delete link: ${result}`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `del-fail-${id}.png`) });
      return false;
    }

    // Wait for and confirm the Delete modal
    await page.waitForTimeout(800);
    const confirmBtn = page.locator('button').filter({ hasText: 'Delete Product' }).first();
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      log(`    ✓ Deleted`);
      return true;
    } catch(e) {
      // Fallback: try "Delete" or "Confirm"
      const fallbacks = [
        page.locator('button').filter({ hasText: 'Delete' }).last(),
        page.locator('button').filter({ hasText: 'Confirm' }).first(),
        page.locator('.modal button[type="submit"]').first(),
      ];
      for (const btn of fallbacks) {
        try {
          if (await btn.count() > 0 && await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(2000);
            log(`    ✓ Deleted (fallback confirm)`);
            return true;
          }
        } catch(_) {}
      }
      log(`    ✗ Delete confirm button not found: ${e.message.slice(0,60)}`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `del-modal-fail-${id}.png`) });
      return false;
    }
  }
  log(`    ✗ Product ${id} not found`);
  return false;
}

// ── Restore (unarchive) a product ─────────────────────────────────────────────
async function restoreProduct(page, product) {
  const id = getProductId(product.viewUrl);
  log(`  Restoring: "${product.name}" (${id})`);

  for (let offset = 0; offset <= 200; offset += 10) {
    const url = offset === 0
      ? 'https://payhip.com/products?listingStatus=archived'
      : `https://payhip.com/products?listingStatus=archived&page=${offset}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const exists = await page.evaluate((pid) =>
      !!document.querySelector(`a[href*="/b/${pid}"]`), id);

    if (!exists) {
      const hasProducts = await page.evaluate(() => !!document.querySelector('a[href*="payhip.com/b/"]'));
      if (!hasProducts) { log(`    End of archived list`); return false; }
      continue;
    }

    // Try js-unarchive-product-link or js-restore-product-link
    const result = await page.evaluate((pid) => {
      const allAnchors = Array.from(document.querySelectorAll('a'));
      // For archived products, the button might be "Restore" instead of "Edit"
      const viewAnchor = allAnchors.find(a =>
        a.href.includes('/b/' + pid) && (a.textContent.trim() === 'View' || a.textContent.trim() === 'Restore')
      );
      if (!viewAnchor) {
        // Try any anchor with this product's URL
        const anyAnchor = allAnchors.find(a => a.href.includes('/b/' + pid));
        if (!anyAnchor) return 'no-anchor';
        let row2 = anyAnchor.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!row2) break;
          const unarchiveLink = row2.querySelector('.js-unarchive-product-link, .js-restore-product-link, [class*="unarchive"], [class*="restore"]');
          if (unarchiveLink) { unarchiveLink.click(); return 'clicked-from-any'; }
          // Try button with "Restore" or "Unarchive" text
          const btns = Array.from(row2.querySelectorAll('button, a'));
          const restoreBtn = btns.find(b => /restore|unarchive/i.test(b.textContent));
          if (restoreBtn) { restoreBtn.click(); return 'clicked-restore-btn'; }
          row2 = row2.parentElement;
        }
        return 'no-restore-link';
      }
      let row = viewAnchor.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!row) break;
        const unarchiveLink = row.querySelector('.js-unarchive-product-link, .js-restore-product-link');
        if (unarchiveLink) { unarchiveLink.click(); return 'clicked'; }
        // Look for any "Restore" or "Unarchive" button
        const btns = Array.from(row.querySelectorAll('button, a'));
        const restoreBtn = btns.find(b => /restore|unarchive/i.test(b.textContent));
        if (restoreBtn) { restoreBtn.click(); return 'clicked-restore'; }
        row = row.parentElement;
      }
      return 'no-unarchive-link';
    }, id);

    if (!result.startsWith('clicked') && result !== 'no-anchor') {
      // Try clicking the "..." button to open the dropdown and find restore
      log(`    JS link not found (${result}), trying ... dropdown`);
      const dropResult = await page.evaluate((pid) => {
        const allAnchors = Array.from(document.querySelectorAll('a'));
        const anyAnchor = allAnchors.find(a => a.href.includes('/b/' + pid));
        if (!anyAnchor) return 'no-anchor';
        let row = anyAnchor.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!row) break;
          const btns = Array.from(row.querySelectorAll('button'));
          const moreBtn = btns.find(b => b.textContent.trim() === '...' || b.textContent.trim() === '•••') || btns[btns.length - 1];
          if (moreBtn) { moreBtn.click(); return 'dropdown-opened'; }
          row = row.parentElement;
        }
        return 'no-more-btn';
      }, id);

      if (dropResult === 'dropdown-opened') {
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(SCRIPTS_DIR, `restore-dropdown-${id}.png`) });
        // Try to find and click restore/unarchive in dropdown
        const restoreOption = page.locator('a, button, li').filter({ hasText: /restore|unarchive/i }).first();
        if (await restoreOption.count() > 0) {
          await restoreOption.click();
          await page.waitForTimeout(1500);
          log(`    ✓ Restored via dropdown`);
          return true;
        }
      }
      log(`    ✗ Could not restore: ${result} / ${dropResult}`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `restore-fail-${id}.png`) });
      return false;
    }

    // Handle any confirmation modal
    await page.waitForTimeout(800);
    const confirmBtn = page.locator('button').filter({ hasText: /restore|unarchive|confirm/i }).first();
    try {
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch(_) {}

    log(`    ✓ Restored (${result})`);
    return true;
  }
  log(`    ✗ Product ${id} not found in archived`);
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1280, height: 800 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await ensureLoggedIn(page);

    // ── STEP 1 & 2: Scrape active products and identify what to delete ──────
    log('=== STEP 1: Scraping active products ===');
    const activeProducts = await scrapeProducts(page, 'active');
    log(`Total active: ${activeProducts.length}`);

    const toDelete = [];
    const toKeepActive = [];

    for (const p of activeProducts) {
      const id = getProductId(p.viewUrl);
      const price = p.price;
      const isInKeepList = id && KEEP_IDS.has(id);
      const isNotionTemplate = price && (price === 9 || price === 15 || price === 19);
      const isDuplicateContract = price === 7 && !isInKeepList;

      if (isInKeepList || isNotionTemplate) {
        toKeepActive.push(p);
      } else if (isDuplicateContract) {
        toDelete.push(p);
        log(`  Mark DELETE: "${p.name}" (${id}) $${price}`);
      } else {
        // Unknown price or not $7 — keep to be safe
        log(`  KEEP (unknown/safe): "${p.name}" (${id}) $${price}`);
        toKeepActive.push(p);
      }
    }

    log(`\nTo delete: ${toDelete.length}`);
    log(`To keep:   ${toKeepActive.length}`);

    // ── STEP 3: Scrape archived products, find keep-list ones to restore ────
    log('\n=== STEP 3: Scraping archived products ===');
    const archivedProducts = await scrapeProducts(page, 'archived');
    log(`Total archived: ${archivedProducts.length}`);

    const toRestore = [];
    const toDeleteArchived = [];

    for (const p of archivedProducts) {
      const id = getProductId(p.viewUrl);
      if (id && KEEP_IDS.has(id)) {
        toRestore.push(p);
        log(`  Restore: "${p.name}" (${id})`);
      } else {
        toDeleteArchived.push(p);
        log(`  Leave archived / delete: "${p.name}" (${id})`);
      }
    }

    // ── STEP 4: Delete active duplicates ────────────────────────────────────
    log(`\n=== STEP 4: Permanently deleting ${toDelete.length} active duplicates ===`);
    let deletedCount = 0, deleteFailCount = 0;
    for (const p of toDelete) {
      const ok = await deleteProduct(page, p);
      if (ok) deletedCount++; else deleteFailCount++;
    }
    log(`Deleted: ${deletedCount}, Failed: ${deleteFailCount}`);

    // Also permanently delete the archived non-keep products
    log(`\n=== STEP 4b: Permanently deleting ${toDeleteArchived.length} archived non-keep products ===`);
    let deletedArchivedCount = 0;
    for (const p of toDeleteArchived) {
      const id = getProductId(p.viewUrl);
      log(`  Deleting archived: "${p.name}" (${id})`);
      // Navigate to archived page and delete
      let deleted = false;
      for (let offset = 0; offset <= 200; offset += 10) {
        const url = offset === 0
          ? 'https://payhip.com/products?listingStatus=archived'
          : `https://payhip.com/products?listingStatus=archived&page=${offset}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        const exists = await page.evaluate((pid) => !!document.querySelector(`a[href*="/b/${pid}"]`), id);
        if (!exists) {
          const hasProducts = await page.evaluate(() => !!document.querySelector('a[href*="payhip.com/b/"]'));
          if (!hasProducts) break;
          continue;
        }
        const result = await page.evaluate((pid) => {
          const allAnchors = Array.from(document.querySelectorAll('a'));
          const anyAnchor = allAnchors.find(a => a.href.includes('/b/' + pid));
          if (!anyAnchor) return 'no-anchor';
          let row = anyAnchor.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!row) break;
            const deleteLink = row.querySelector('.js-delete-product-link');
            if (deleteLink) { deleteLink.click(); return 'clicked'; }
            row = row.parentElement;
          }
          // Fallback: open "..." dropdown
          let row2 = anyAnchor.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!row2) break;
            const btns = Array.from(row2.querySelectorAll('button'));
            const moreBtn = btns.find(b => b.textContent.trim() === '...' || b.textContent.trim() === '•••') || btns[btns.length - 1];
            if (moreBtn) { moreBtn.click(); return 'dropdown'; }
            row2 = row2.parentElement;
          }
          return 'no-delete-link';
        }, id);

        if (result === 'dropdown') {
          await page.waitForTimeout(600);
          const delOption = page.locator('a, button, li').filter({ hasText: /delete product/i }).first();
          if (await delOption.count() > 0) {
            await delOption.click();
            await page.waitForTimeout(600);
          }
        }

        if (result !== 'no-delete-link' && result !== 'no-anchor') {
          await page.waitForTimeout(800);
          const confirmBtn = page.locator('button').filter({ hasText: 'Delete Product' }).first();
          try {
            await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            log(`    ✓ Deleted archived`);
            deleted = true;
          } catch(_) {
            const fallback = page.locator('button').filter({ hasText: 'Delete' }).last();
            if (await fallback.count() > 0 && await fallback.isVisible()) {
              await fallback.click();
              await page.waitForTimeout(2000);
              log(`    ✓ Deleted archived (fallback)`);
              deleted = true;
            }
          }
        }
        break;
      }
      if (deleted) deletedArchivedCount++;
    }
    log(`Deleted from archive: ${deletedArchivedCount}`);

    // ── STEP 5: Restore archived keep-list products ─────────────────────────
    log(`\n=== STEP 5: Restoring ${toRestore.length} keep-list products from archive ===`);
    let restoredCount = 0, restoreFailCount = 0;
    for (const p of toRestore) {
      const ok = await restoreProduct(page, p);
      if (ok) restoredCount++; else restoreFailCount++;
    }
    log(`Restored: ${restoredCount}, Failed: ${restoreFailCount}`);

    // ── STEP 6: Verify final state ──────────────────────────────────────────
    log('\n=== STEP 6: Final verification ===');
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const counts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, span'))
        .map(el => el.textContent.trim())
        .filter(t => /\(\d+\)/.test(t))
        .slice(0, 5)
    );
    log('Final counts: ' + counts.join(' | '));
    await page.screenshot({ path: path.join(SCRIPTS_DIR, 'final-state.png') });

    // Check which keep-list IDs are now active
    const finalActive = await scrapeProducts(page, 'active');
    const finalIds = new Set(finalActive.map(p => getProductId(p.viewUrl)).filter(Boolean));
    log('\nKeep-list coverage:');
    for (const id of KEEP_IDS) {
      const found = finalIds.has(id);
      log(`  ${found ? '✓' : '✗'} ${id}`);
    }

    log('\n=== FINAL SUMMARY ===');
    log(`Deleted active duplicates:  ${deletedCount}`);
    log(`Deleted archived leftovers: ${deletedArchivedCount}`);
    log(`Restored from archive:      ${restoredCount}`);
    log(`Final active products:      ${finalActive.length}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    try { await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fatal-delete.png') }); } catch(_) {}
  } finally {
    await browser.close();
  }
})();
