/**
 * update-links.js
 * Reads links.txt and product-list.json, then updates each tool HTML file
 * so the download buttons redirect to PayHip instead of showing alerts.
 */
const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const LINKS_FILE   = path.join(__dirname, 'links.txt');
const PRODUCTS_FILE = path.join(__dirname, 'product-list.json');

// ── Build name → URL map from links.txt ──────────────────────────────────────
const linkLines = fs.readFileSync(LINKS_FILE, 'utf8').trim().split('\n').filter(Boolean);
const nameToUrl = {};
for (const line of linkLines) {
  const sep = line.indexOf(' | ');
  if (sep === -1) continue;
  const name = line.slice(0, sep).trim();
  const url  = line.slice(sep + 3).trim();
  nameToUrl[name] = url;
}
console.log(`Loaded ${Object.keys(nameToUrl).length} product URLs from links.txt`);

// ── Load product list (file → name mapping) ───────────────────────────────────
const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

// ── Process each tool HTML file ───────────────────────────────────────────────
let updatedCount = 0;
const notUpdated = [];

for (const product of products) {
  if (product.file === 'bundle') continue; // handle separately below

  const htmlPath = path.join(ROOT, product.file);
  if (!fs.existsSync(htmlPath)) {
    console.log(`  SKIP (not found): ${product.file}`);
    notUpdated.push(product.file);
    continue;
  }

  const payhipUrl = nameToUrl[product.name];
  if (!payhipUrl || payhipUrl.startsWith('ERROR')) {
    console.log(`  SKIP (no URL): ${product.name}`);
    notUpdated.push(product.file);
    continue;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  let changed = false;

  // ── Replace btnPdf alert with PayHip redirect ─────────────────────────────
  // Use [\s\S]*? to match alert text including nested parens like (.docx)
  const pdfAlertPattern = /document\.getElementById\("btnPdf"\)\.addEventListener\("click",function\(\)\{[\s\S]*?\}\);/;
  const docAlertPattern = /document\.getElementById\("btnDoc"\)\.addEventListener\("click",function\(\)\{[\s\S]*?\}\);/;

  if (pdfAlertPattern.test(html)) {
    html = html.replace(pdfAlertPattern,
      `document.getElementById("btnPdf").addEventListener("click",function(){\n  window.open("${payhipUrl}","_blank");\n});`
    );
    changed = true;
  }
  if (docAlertPattern.test(html)) {
    html = html.replace(docAlertPattern,
      `document.getElementById("btnDoc").addEventListener("click",function(){\n  window.open("${payhipUrl}","_blank");\n});`
    );
    changed = true;
  }

  // ── Also replace any generic href="#" on download/buy/cta links ──────────
  const ctaPattern = /(<a\s[^>]*class="[^"]*(?:download|buy|cta|btn-dl)[^"]*"[^>]*)href="#"([^>]*>)/gi;
  if (ctaPattern.test(html)) {
    html = html.replace(ctaPattern, `$1href="${payhipUrl}"$2`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(htmlPath, html, 'utf8');
    updatedCount++;
    console.log(`  Updated: ${product.file} -> ${payhipUrl}`);
  } else {
    console.log(`  No match: ${product.file}`);
    notUpdated.push(product.file);
  }
}

// ── Update bundle CTA on index.html ──────────────────────────────────────────
const bundleProduct = products.find(p => p.file === 'bundle');
if (bundleProduct) {
  const bundleUrl = nameToUrl[bundleProduct.name];
  if (bundleUrl && !bundleUrl.startsWith('ERROR')) {
    const indexPath = path.join(ROOT, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    // Replace any href="#" on bundle CTA links
    const bundleBtnPattern = /(<a\s[^>]*(?:bundle|btn-outline|btn-white|cta)[^>]*href=")[^"]*(")/gi;
    let replaced = html.replace(bundleBtnPattern, `$1${bundleUrl}$2`);
    if (replaced !== html) {
      fs.writeFileSync(indexPath, replaced, 'utf8');
      console.log(`  Updated index.html bundle CTA -> ${bundleUrl}`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\n=== Summary ===`);
console.log(`Updated: ${updatedCount} files`);
console.log(`Not updated: ${notUpdated.length} files`);
if (notUpdated.length > 0) console.log('  ' + notUpdated.join('\n  '));
