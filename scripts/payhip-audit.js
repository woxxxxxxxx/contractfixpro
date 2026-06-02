/**
 * payhip-audit.js
 * 1. Scrape all products using pagination
 * 2. Identify duplicates (keep oldest by product ID)
 * 3. Archive duplicates via "..." dropdown
 * 4. Verify final count
 * 5. Create 2 collections: Contract Templates & Notion Templates
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

const SCRIPTS_DIR   = __dirname;
const ALL_PRODUCTS  = path.join(SCRIPTS_DIR, 'all-products.json');
const DUPES_FILE    = path.join(SCRIPTS_DIR, 'duplicates.json');
const SESSION_DIR   = path.join(SCRIPTS_DIR, 'browser-session');

const EMAIL    = 'xiaohuixie3@gmail.com';
const PASSWORD = 'xxh113824';

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }

async function ensureLoggedIn(page) {
  await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  if (!page.url().includes('login') && !page.url().includes('auth')) {
    log('Already logged in: ' + page.url()); return;
  }
  log('Logging in...');
  await page.goto('https://payhip.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="login"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  if (page.url().includes('login')) {
    log('>>> reCAPTCHA — solve in browser...');
    while (page.url().includes('login')) await page.waitForTimeout(2000);
  }
  log('Logged in: ' + page.url());
}

// Extract products from the current products page DOM
async function extractProductsFromPage(page) {
  return page.evaluate(() => {
    const result = [];
    // Find all product rows — they contain both a title link and "View"/"Edit" buttons
    // Each row is a direct child of the product list container
    const rows = Array.from(document.querySelectorAll('li, tr, [class*="product-list"] > *, [class*="ebook-list"] > *'));

    // Filter to rows that contain a /b/ link
    const productRows = rows.filter(row => row.querySelector('a[href*="payhip.com/b/"]'));

    for (const row of productRows) {
      const allAnchors = Array.from(row.querySelectorAll('a'));

      // Title anchor: a /b/ link whose text is NOT "View", "Edit", "Share / Embed", "Manage"
      const buttonTexts = new Set(['View', 'Edit', 'Share / Embed', 'Share/Embed', 'Manage', '']);
      const titleAnchor = allAnchors.find(a =>
        a.href.includes('payhip.com/b/') && !buttonTexts.has(a.textContent.trim())
      );

      // View button: the anchor with text "View" that links to /b/
      const viewAnchor = allAnchors.find(a =>
        a.href.includes('payhip.com/b/') && a.textContent.trim() === 'View'
      );

      if (!titleAnchor && !viewAnchor) continue;

      const rawUrl = (viewAnchor || titleAnchor).href;
      const viewUrl = rawUrl.split('?')[0].split('#')[0];

      result.push({
        name: titleAnchor ? titleAnchor.textContent.trim() : '',
        viewUrl,
      });
    }
    return result;
  });
}

// ── STEP 1: Scrape all products (paginated) ───────────────────────────────────
async function scrapeAllProducts(page) {
  log('=== STEP 1: Scraping all products ===');
  const allProducts = [];

  // Start at /products and click "All" tab
  await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click "All (" tab to show all (not just active)
  // The tab text looks like "All (67)"
  const allTabText = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button'));
    const allTab = links.find(el => /^All\s*\(/.test(el.textContent.trim()));
    if (allTab) { allTab.click(); return allTab.textContent.trim(); }
    return null;
  });
  if (allTabText) { log(`  Clicked tab: ${allTabText}`); await page.waitForTimeout(1500); }

  let pageNum = 1;
  while (true) {
    log(`  Scraping page ${pageNum}...`);
    await page.waitForTimeout(1000);

    const rows = await extractProductsFromPage(page);
    log(`  Found ${rows.length} products`);
    allProducts.push(...rows);

    await page.screenshot({ path: path.join(SCRIPTS_DIR, `page-${pageNum}.png`) });

    // Check for "next page" button — pagination shows: 1 2 3 > Last
    // The ">" or "›" or "Next" button goes to next page
    const nextHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.pagination a, [aria-label] a, nav a'));
      // Find the next-page link
      const next = links.find(a => {
        const t = a.textContent.trim();
        return t === '>' || t === '›' || t === 'Next' || t === '»' ||
               a.getAttribute('rel') === 'next' || a.getAttribute('aria-label') === 'Next';
      });
      return next ? next.href : null;
    });

    if (!nextHref) {
      // Also try clicking the ">" button directly
      const nextBtn = page.locator('.pagination a').filter({ hasText: '>' }).first();
      const nextBtnAlt = page.locator('a[aria-label="Next page"], a[aria-label="Next"]').first();

      if (await nextBtn.count() > 0) {
        const cls = await nextBtn.getAttribute('class') || '';
        if (cls.includes('disabled')) break;
        await nextBtn.click();
        await page.waitForTimeout(1500);
        pageNum++;
      } else if (await nextBtnAlt.count() > 0) {
        await nextBtnAlt.click();
        await page.waitForTimeout(1500);
        pageNum++;
      } else {
        log('  No next page button, done');
        break;
      }
    } else {
      await page.goto(nextHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      pageNum++;
    }
  }

  // Remove duplicates by viewUrl
  const seen = new Set();
  const unique = allProducts.filter(p => {
    if (!p.viewUrl || seen.has(p.viewUrl)) return false;
    seen.add(p.viewUrl);
    return true;
  });

  log(`Total unique products: ${unique.length}`);
  fs.writeFileSync(ALL_PRODUCTS, JSON.stringify(unique, null, 2));
  return unique;
}

// ── STEP 2: Identify duplicates ───────────────────────────────────────────────
function identifyDuplicates(products) {
  log('=== STEP 2: Identifying duplicates ===');

  function getId(p) {
    const m = (p.viewUrl || '').match(/\/b\/([a-zA-Z0-9]+)/);
    return m ? m[1] : '';
  }

  const groups = {};
  for (const p of products) {
    const key = (p.name || '').toLowerCase().trim();
    if (!key) continue;
    groups[key] = groups[key] || [];
    groups[key].push(p);
  }

  const toDelete = [], toKeep = [];
  for (const [name, group] of Object.entries(groups)) {
    if (group.length === 1) { toKeep.push(group[0]); continue; }
    group.sort((a, b) => getId(a).localeCompare(getId(b)));
    const [keep, ...dupes] = group;
    toKeep.push(keep);
    toDelete.push(...dupes.map(d => ({ ...d, keepUrl: keep.viewUrl })));
    log(`  Dup: "${name}" keep=${getId(keep)} delete=[${dupes.map(getId).join(',')}]`);
  }

  log(`To delete: ${toDelete.length}, To keep: ${toKeep.length}`);
  fs.writeFileSync(DUPES_FILE, JSON.stringify({ toDelete, toKeep }, null, 2));
  return { toDelete, toKeep };
}

// ── STEP 3: Archive duplicates ────────────────────────────────────────────────
async function deleteDuplicates(page, toDelete) {
  log(`=== STEP 3: Archiving ${toDelete.length} duplicates ===`);
  let deleted = 0, failed = 0;

  for (const product of toDelete) {
    const m = (product.viewUrl || '').match(/\/b\/([a-zA-Z0-9]+)/);
    if (!m) { log(`  SKIP (no ID): ${product.name}`); failed++; continue; }
    const id = m[1];
    log(`  Archiving: "${product.name}" (${id})`);

    try {
      // PayHip products page uses offset-based pagination: ?listingStatus=all&page=OFFSET
      // 10 items per page: offset 0, 10, 20, 30 ...
      let productFound = false;

      for (let offset = 0; offset <= 100; offset += 10) {
        const url = offset === 0
          ? 'https://payhip.com/products?listingStatus=all'
          : `https://payhip.com/products?listingStatus=all&page=${offset}`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);

        const exists = await page.evaluate((pid) =>
          !!document.querySelector(`a[href*="/b/${pid}"]`), id);

        if (!exists) {
          // Check if we've gone past the last page (no products listed)
          const hasProducts = await page.evaluate(() =>
            !!document.querySelector('a[href*="payhip.com/b/"]'));
          if (!hasProducts) { log(`    End of products list at offset ${offset}`); break; }
          continue;
        }

        // Found the product on this page — click js-archive-product-link in its row
        const result = await page.evaluate((pid) => {
          const allAnchors = Array.from(document.querySelectorAll('a'));
          const viewAnchor = allAnchors.find(a =>
            a.href.includes('/b/' + pid) && a.textContent.trim() === 'View'
          );
          if (!viewAnchor) return 'no-view-anchor';

          // Walk up to find the row containing the js-archive-product-link
          let row = viewAnchor.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!row) break;
            const archiveLink = row.querySelector('.js-archive-product-link');
            if (archiveLink) {
              archiveLink.click();
              return 'clicked';
            }
            row = row.parentElement;
          }
          return 'no-archive-link';
        }, id);

        if (result !== 'clicked') {
          log(`    ✗ Could not click archive link: ${result}`);
          failed++;
          break;
        }

        // Wait for the "Archive Product" confirmation modal
        await page.waitForTimeout(800);

        // Click "Archive Product" button in the modal
        // Button text is "✓ Archive Product" so use string contains (not regex with ^)
        const confirmBtn = page.locator('button').filter({ hasText: 'Archive Product' }).first();
        try {
          await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
          await confirmBtn.click();
          await page.waitForTimeout(2000);
          log(`    ✓ Archived`);
          deleted++;
          productFound = true;
        } catch(e) {
          log(`    ✗ "Archive Product" modal button not found: ${e.message.slice(0,60)}`);
          await page.screenshot({ path: path.join(SCRIPTS_DIR, `fail-modal-${id}.png`) });
          failed++;
          productFound = true; // mark as found to stop searching
        }
        break;
      }

      if (!productFound) {
        log(`    ✗ Product ${id} not found across all pages`);
        failed++;
      }

    } catch (err) {
      log(`    ERROR: ${err.message.slice(0, 100)}`);
      failed++;
    }
  }

  log(`Archived: ${deleted}, Failed: ${failed}`);
  return deleted;
}

// ── STEP 4: Verify ────────────────────────────────────────────────────────────
async function verifyCount(page) {
  log('=== STEP 4: Verifying final count ===');
  await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const counts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a, button, span'))
      .map(el => el.textContent.trim())
      .filter(t => /\(\d+\)/.test(t))
      .slice(0, 5)
  );
  log('Counts: ' + counts.join(' | '));
  await page.screenshot({ path: path.join(SCRIPTS_DIR, 'after-cleanup.png') });
}

// ── STEP 5: Create Collections ────────────────────────────────────────────────
async function createCollections(page, products) {
  log('=== STEP 5: Creating Collections ===');

  const contractKeywords = /contract|nda|agreement|invoice|consulting/i;
  const contractProducts = products.filter(p => contractKeywords.test(p.name));
  const notionProducts   = products.filter(p => !contractKeywords.test(p.name));

  log(`Contract products: ${contractProducts.length}`);
  log(`Notion products:   ${notionProducts.length}`);

  // Go directly to /collections page
  await page.goto('https://payhip.com/collections', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  log('  Collections URL: ' + page.url());
  await page.screenshot({ path: path.join(SCRIPTS_DIR, 'collections-before.png') });

  async function createCollection(name) {
    log(`  Creating collection: "${name}"`);
    try {
      // Go to collections list page
      await page.goto('https://payhip.com/collections', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Click "+ Add new collection" — navigates to a new page (not a modal)
      const addBtn = page.locator('a:has-text("Add new collection"), button:has-text("Add new collection")').first();
      if (await addBtn.count() === 0) {
        log(`    "+ Add new collection" button not found`);
        await page.screenshot({ path: path.join(SCRIPTS_DIR, `no-add-btn.png`) });
        return;
      }
      await addBtn.click();
      await page.waitForTimeout(2000);
      log(`    Form URL: ${page.url()}`);

      // Fill the name input — placeholder is "Your collection name"
      const nameInput = page.locator('input[placeholder*="collection name" i], input[placeholder*="Your collection" i]').first();
      if (await nameInput.count() === 0) {
        log(`    Name input not found, trying any text input...`);
        const anyInput = page.locator('input[type="text"]').first();
        if (await anyInput.count() > 0) await anyInput.fill(name);
        else { log(`    No input found`); return; }
      } else {
        await nameInput.fill(name);
      }
      await page.waitForTimeout(300);

      // Scroll to bottom to find Save button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `form-${name.replace(/\s+/g,'-')}.png`) });

      // Click Save/Create button
      const saveBtn = page.locator(
        'button[type="submit"], input[type="submit"], ' +
        'button:has-text("Save"), button:has-text("Create collection"), button:has-text("Add collection")'
      ).first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(2500);
        log(`    ✓ Collection "${name}" created — URL: ${page.url()}`);
      } else {
        log(`    Save button not found`);
        await page.screenshot({ path: path.join(SCRIPTS_DIR, `no-save-${name.replace(/\s+/g,'-')}.png`) });
      }

    } catch (err) {
      log(`    ERROR: ${err.message.slice(0,100)}`);
      await page.screenshot({ path: path.join(SCRIPTS_DIR, `coll-error-${Date.now()}.png`) });
    }
  }

  await createCollection('Contract Templates');
  await page.waitForTimeout(500);
  await createCollection('Notion Templates');
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 50, viewport: { width: 1280, height: 800 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await ensureLoggedIn(page);

    const allProducts = await scrapeAllProducts(page);
    log(`Scraped ${allProducts.length} total products`);

    if (allProducts.length === 0) {
      log('No products found — check page-1.png');
      return;
    }

    const { toDelete, toKeep } = identifyDuplicates(allProducts);

    if (toDelete.length > 0) {
      await deleteDuplicates(page, toDelete);
    } else {
      log('No duplicates found');
    }

    await verifyCount(page);
    await createCollections(page, toKeep);

    log('\n=== FINAL SUMMARY ===');
    log(`Products scraped: ${allProducts.length}`);
    log(`Duplicates found: ${toDelete.length}`);
    log(`Products kept:    ${toKeep.length}`);

  } catch (err) {
    log('Fatal: ' + err.message);
    console.error(err);
    try { await page.screenshot({ path: path.join(SCRIPTS_DIR, 'fatal-error.png') }); } catch(_) {}
  } finally {
    await browser.close();
  }
})();
