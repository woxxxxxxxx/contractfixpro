const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login
  await page.goto('https://payhip.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="login"]', 'xiaohuixie3@gmail.com');
  await page.fill('input[name="password"]', 'xxh113324');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  if (page.url().includes('login')) {
    console.log('Waiting for manual CAPTCHA solve...');
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && page.url().includes('login')) await page.waitForTimeout(1000);
  }
  console.log('Logged in:', page.url());

  // Products page
  await page.goto('https://payhip.com/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Add new product
  await page.locator('text=Add new product').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'scripts/step1-type-select.png' });

  // Click Digital Product
  await page.locator('text=DIGITAL PRODUCT').click();
  await page.waitForTimeout(3000);
  console.log('After type select URL:', page.url());
  await page.screenshot({ path: 'scripts/step2-digital-form.png' });

  // Dump form fields
  const fields = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input:not([type=hidden]), textarea, select')).map(el => ({
      tag: el.tagName, type: el.type, name: el.name, id: el.id,
      placeholder: el.placeholder, cls: el.className.substring(0, 60)
    }))
  );
  console.log('FORM FIELDS:', JSON.stringify(fields, null, 2));

  // Visible text on page
  const h1s = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1, h2, h3, label')).map(el => el.textContent.trim()).filter(t=>t)
  );
  console.log('Headings/Labels:', h1s.slice(0, 30));

  await browser.close();
})();
