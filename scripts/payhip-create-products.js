/**
 * PayHip Product Creator for ContractFixPro
 * Creates 20 digital products + 1 bundle on PayHip.
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, 'product-list.json');
const LINKS_FILE    = path.join(__dirname, 'links.txt');
const PLACEHOLDER   = path.join(__dirname, 'placeholder.txt');

const EMAIL    = 'xiaohuixie3@gmail.com';
const PASSWORD = 'xxh113324';

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
fs.writeFileSync(LINKS_FILE, '', 'utf8');

function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function appendLink(name, url) { fs.appendFileSync(LINKS_FILE, `${name} | ${url}\n`); }

async function login(page) {
  // Check if already logged in via persistent session
  await page.goto('https://payhip.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  if (!page.url().includes('login') && !page.url().includes('auth')) {
    log('Already logged in via saved session: ' + page.url());
    return true;
  }

  log('Logging in...');
  await page.goto('https://payhip.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="login"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  if (page.url().includes('login')) {
    log('>>> reCAPTCHA — solve in browser window (no timeout, waiting until done)...');
    while (page.url().includes('login')) {
      await page.waitForTimeout(2000);
    }
  }

  const ok = !page.url().includes('login');
  log(ok ? 'Logged in: ' + page.url() : 'Login FAILED');
  return ok;
}

async function getPublicUrl(page) {
  // On the success page "/product/addit", the public URL is shown in a text input
  // containing "https://payhip.com/b/XXXXX"
  try {
    // Look for the product link in input field or link on success page
    const urlInput = await page.$('input[value*="payhip.com/b/"], input[value*="payhip.com/B/"]');
    if (urlInput) {
      const val = await urlInput.getAttribute('value');
      if (val && val.includes('payhip.com/b/')) return val.trim();
    }

    // Try text content containing the URL
    const linkText = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const el of inputs) {
        if (el.value && el.value.includes('payhip.com/b/')) return el.value;
      }
      // Check for text nodes containing the URL
      const body = document.body.innerText;
      const m = body.match(/https:\/\/payhip\.com\/b\/[a-zA-Z0-9]+/);
      return m ? m[0] : null;
    });
    if (linkText) return linkText.trim();

    // Look for anchor links
    const anchor = page.locator('a[href*="payhip.com/b/"]').first();
    if (await anchor.count() > 0) {
      return await anchor.getAttribute('href');
    }
  } catch(_) {}

  return page.url();
}

async function createDigitalProduct(page, product) {
  log(`Creating digital: "${product.name}" @ $${product.price}`);
  try {
    // Navigate to products page and click Add new product
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.locator('text=Add new product').click();
    await page.waitForTimeout(2000);

    // Click "DIGITAL PRODUCT"
    await page.locator('text=DIGITAL PRODUCT').click();
    await page.waitForURL('**/product/add/digital', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // ── Upload placeholder product file ──────────────────────────────────
    log('  Uploading file...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(PLACEHOLDER);
    await page.waitForTimeout(3000); // wait for upload

    // ── Product name ─────────────────────────────────────────────────────
    await page.fill('input[name="p_name"]', product.name);

    // ── Price ─────────────────────────────────────────────────────────────
    await page.click('input[name="p_price"]', { clickCount: 3 });
    await page.keyboard.type(String(product.price));

    // ── Description (Quill editor) ────────────────────────────────────────
    const desc = `Professional ${product.name} — ready to use, fully editable. Generate your contract instantly at contractfixpro.com — no account required, no fees, no watermarks.`;
    const editor = page.locator('.ql-editor').first();
    await editor.click();
    await editor.fill(desc);
    await page.waitForTimeout(500);

    // ── Status: Visible ───────────────────────────────────────────────────
    const visibleRadio = page.locator('input[name="product_status"]').first();
    await visibleRadio.click();
    await page.waitForTimeout(300);

    // ── Submit ─────────────────────────────────────────────────────────────
    log('  Submitting...');
    const beforeUrl = page.url();
    await page.locator('#addsubmit').click();

    // Wait for URL change (product created → redirects to edit page)
    let elapsed = 0;
    while (page.url() === beforeUrl && elapsed < 25000) {
      await page.waitForTimeout(500);
      elapsed += 500;
    }
    await page.waitForTimeout(1500);
    log('  Post-submit URL: ' + page.url());
    await page.screenshot({ path: path.join(__dirname, 'post-submit.png') });

    const publicUrl = await getPublicUrl(page);
    log(`  -> ${publicUrl}`);
    appendLink(product.name, publicUrl);
    return publicUrl;

  } catch (err) {
    log(`  ERROR: ${err.message.slice(0, 150)}`);
    appendLink(product.name, 'ERROR: ' + err.message.slice(0, 100));
    return null;
  }
}

async function createBundleProduct(page, product) {
  log(`Creating bundle: "${product.name}" @ $${product.price}`);
  try {
    await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.locator('text=Add new product').click();
    await page.waitForTimeout(2000);

    // Click "BUNDLE" - use precise selector to avoid nav ambiguity
    await page.locator('h3:has-text("BUNDLE"), h4:has-text("BUNDLE"), h5:has-text("Bundle"), .product-type:has-text("BUNDLE"), a:has-text("BUNDLE")').last().click();
    await page.waitForTimeout(3000);
    log('  Bundle URL: ' + page.url());

    // Fill name
    const nameField = page.locator('input[name="p_name"], input[placeholder*="title" i], input[placeholder*="name" i]').first();
    if (await nameField.count() > 0) await nameField.fill(product.name);

    // Fill price
    const priceField = page.locator('input[name="p_price"]').first();
    if (await priceField.count() > 0) {
      await priceField.click({ clickCount: 3 });
      await page.keyboard.type(String(product.price));
    }

    // Description
    const desc = `ContractFixPro Bundle — All 20 professional contract templates in one package. Includes: Freelance, Photography, Web Design, NDA, Independent Contractor, Service Agreement, Consulting, Social Media, Graphic Design, Copywriting, Virtual Assistant, Logo Design, Brand Ambassador, Videography, Influencer, Music Producer, Video Editing, Client Onboarding, Website Maintenance, and Invoice Template. Generate any contract at contractfixpro.com.`;
    const editor = page.locator('.ql-editor').first();
    if (await editor.count() > 0) { await editor.click(); await editor.fill(desc); }

    // Submit
    const submitBtn = page.locator('#addsubmit, input[type="submit"], button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(5000);

    const publicUrl = await getPublicUrl(page);
    log(`  -> ${publicUrl}`);
    appendLink(product.name, publicUrl);
    return publicUrl;

  } catch (err) {
    log(`  BUNDLE ERROR: ${err.message.slice(0, 150)}`);
    appendLink(product.name, 'ERROR: ' + err.message.slice(0, 100));
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const userDataDir = path.join(__dirname, 'browser-session');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: 50,
    viewport: { width: 1280, height: 800 },
  });
  const page = browser.pages()[0] || await browser.newPage();

  try {
    const ok = await login(page);
    if (!ok) { log('Cannot proceed without login.'); process.exit(1); }

    for (const product of products) {
      if (product.file === 'bundle') {
        await createBundleProduct(page, product);
      } else {
        await createDigitalProduct(page, product);
      }
      await page.waitForTimeout(800);
    }

    const lines = fs.readFileSync(LINKS_FILE, 'utf8').trim().split('\n').filter(Boolean);
    log(`\n=== Done! ${lines.length}/${products.length} products processed ===`);
    log(`Links saved to: ${LINKS_FILE}`);
    lines.forEach(l => log('  ' + l));

  } catch (err) {
    log('Fatal: ' + err.message);
  } finally {
    await browser.close();
  }
})();

