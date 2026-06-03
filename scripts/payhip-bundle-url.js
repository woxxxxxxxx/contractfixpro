const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const path = require('path');
const SESSION_DIR = path.join(__dirname, 'browser-session');

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, slowMo: 60, viewport: { width: 1280, height: 900 }
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    log('Products page: ' + page.url());

    // Dump all View links and bundle-related links on the page
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim().slice(0, 60),
        href: a.href,
        visible: a.offsetParent !== null
      })).filter(a => a.href && a.href.includes('payhip.com') && a.visible);
    });
    log('All visible links: ' + JSON.stringify(links, null, 2));

    // Find the bundle row
    const bundleInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, .product-row, [class*="product"]'));
      for (const row of rows) {
        if (row.textContent.includes('ContractFixPro Bundle') || row.textContent.includes('All 20 Contracts')) {
          const viewLink = row.querySelector('a[href*="/b/"], a[href*="/bundle"]');
          if (viewLink) return { href: viewLink.href, text: viewLink.textContent.trim(), rowText: row.textContent.trim().slice(0, 200) };
        }
      }
      return null;
    });
    log('Bundle info: ' + JSON.stringify(bundleInfo));

    // Also look for any link containing the bundle ID
    const bundleLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a =>
        a.href.includes('rj4IU') || (a.textContent.includes('ContractFixPro') && a.href)
      ).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 80) }));
    });
    log('Bundle-related links: ' + JSON.stringify(bundleLinks));

    // Try clicking the View button for the bundle
    const viewBtn = page.locator('a, button').filter({ hasText: 'View' }).first();
    // Actually let's find the specific one near "ContractFixPro Bundle"
    const bundleViewHref = await page.evaluate(() => {
      // Find all elements containing "ContractFixPro Bundle"
      const allEls = Array.from(document.querySelectorAll('*'));
      for (const el of allEls) {
        if (el.children.length === 0 && el.textContent.includes('ContractFixPro Bundle')) {
          // Walk up to find the row
          let parent = el.parentElement;
          for (let i = 0; i < 8; i++) {
            if (!parent) break;
            // Find a "View" link in this container
            const viewA = Array.from(parent.querySelectorAll('a')).find(a =>
              a.textContent.trim() === 'View' || a.href.includes('payhip.com/b/')
            );
            if (viewA) return { href: viewA.href, text: viewA.textContent.trim() };
            parent = parent.parentElement;
          }
        }
      }
      return null;
    });
    log('Bundle view href: ' + JSON.stringify(bundleViewHref));

    await page.screenshot({ path: path.join(__dirname, 'bundle-url-products.png') });

    // Navigate to the bundle manage page to find the public URL
    await page.goto('https://payhip.com/b/rj4IU/manage', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(2000);

    // Look for "View" or public URL on the manage page
    const manageLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a =>
        a.href && !a.href.includes('/bundle/') && a.href.includes('payhip.com')
      ).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 60) }));
    });
    log('Manage page external links: ' + JSON.stringify(manageLinks));

    // Also try the bundle public URL patterns
    // PayHip bundles usually have a public URL like payhip.com/b/ID or payhip.com/bundle/ID
    const publicUrlCandidates = [
      `https://payhip.com/b/rj4IU`,
      `https://payhip.com/bundle/rj4IU`,
    ];

    for (const url of publicUrlCandidates) {
      log('Testing public URL: ' + url);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(1500);
        const finalUrl = page.url();
        const title = await page.title();
        log(`  -> Final URL: ${finalUrl}, Title: ${title}`);
        if (!finalUrl.includes('login') && !finalUrl.includes('404') && !finalUrl.includes('error')) {
          log('  -> VALID public URL: ' + finalUrl);
        }
      } catch(e) {
        log('  -> Error: ' + e.message.slice(0, 80));
      }
    }

    await page.screenshot({ path: path.join(__dirname, 'bundle-url-public.png') });

    log('\n=== FINAL URL CHECK ===');
    log('Current URL: ' + page.url());
    log('Page title: ' + await page.title());

  } catch(err) {
    log('Fatal: ' + err.message);
    await page.screenshot({ path: path.join(__dirname, 'bundle-url-fatal.png') }).catch(()=>{});
  } finally {
    await browser.close();
  }
})();
