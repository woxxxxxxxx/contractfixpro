'use strict';
/**
 * One-off injector: adds LawDepot Featured Partner CTA after the Bundle Banner
 * in each contract generator page. Idempotent — skips files already containing
 * the CTA marker.
 */
const fs = require('fs');
const path = require('path');

const PAGES = [
  {
    file: 'freelance-contract.html',
    href: 'https://www.anrdoezrs.net/click-101808177-16995973?sid=contractfix-lawdepot-freelance',
    headline: 'Need a More Advanced Freelance Contract?',
    desc: 'Our free generator covers the essentials. For complex projects, IP transfer clauses, multi-state work, or international clients, <strong>LawDepot</strong> offers attorney-drafted freelance contracts you can fully customize.',
  },
  {
    file: 'service-agreement.html',
    href: 'https://www.tkqlhce.com/click-101808177-16995869?sid=contractfix-lawdepot-service',
    headline: 'Need a State-Specific Service Agreement?',
    desc: 'Our free service agreement is great for standard deals. For state-specific compliance, recurring services, or higher-value engagements, <strong>LawDepot</strong> provides attorney-drafted service agreements tailored to all 50 US states.',
  },
  {
    file: 'consulting-agreement.html',
    href: 'https://www.dpbolvw.net/click-101808177-16995868?sid=contractfix-lawdepot-consulting',
    headline: 'Need a Professional Consulting Contract?',
    desc: 'Our free template covers most engagements. For retainer-based work, indemnification clauses, or enterprise client requirements, <strong>LawDepot</strong> offers attorney-drafted consulting agreements built for serious consulting practices.',
  },
  {
    file: 'independent-contractor.html',
    href: 'https://www.anrdoezrs.net/click-101808177-16995973?sid=contractfix-lawdepot-freelance',
    headline: 'Need a Lawyer-Reviewed Contractor Agreement?',
    desc: 'Our free template handles standard arrangements. For 1099 compliance, exclusivity terms, or non-compete clauses, <strong>LawDepot</strong> provides attorney-drafted independent contractor agreements built for U.S. employment law.',
  },
];

const MARKER = '<!-- ═══ LawDepot Featured Partner ═══ -->';

const buildCta = ({ href, headline, desc }) => `
${MARKER}
<link rel="stylesheet" href="/assets/css/partner-cta.css">
<div class="partner-cta">
  <div class="partner-cta-brand">
    <div class="partner-cta-logo letter">L</div>
    <div class="partner-cta-brandname">LawDepot</div>
    <div class="partner-cta-category">Legal Documents</div>
    <div class="partner-cta-stars">★★★★★</div>
  </div>
  <div class="partner-cta-content">
    <span class="partner-cta-tag">⭐ Featured Partner</span>
    <h4 class="partner-cta-headline">${headline}</h4>
    <p class="partner-cta-desc">${desc}</p>
    <div class="partner-cta-badges">
      <span class="partner-cta-badge"><span class="ic">✓</span> Free 7-Day Trial</span>
      <span class="partner-cta-badge"><span class="ic">✓</span> Attorney-Drafted</span>
      <span class="partner-cta-badge"><span class="ic">✓</span> 1,000+ Templates</span>
    </div>
    <a href="${href}" class="partner-cta-btn" target="_blank" rel="sponsored noopener nofollow">Browse LawDepot</a>
    <p class="partner-cta-sublabel">Affiliate link — we may earn a commission at no extra cost to you</p>
  </div>
</div>
`;

const BANNER_END_REGEX = /(<!-- Bundle Banner -->[\s\S]*?<\/div>\s*<\/div>)/;

let updated = 0, skipped = 0;
for (const p of PAGES) {
  const fp = path.join(__dirname, p.file);
  if (!fs.existsSync(fp)) { console.log(`SKIP (missing): ${p.file}`); continue; }
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes(MARKER)) { console.log(`SKIP (already injected): ${p.file}`); skipped++; continue; }
  if (!BANNER_END_REGEX.test(html)) { console.log(`SKIP (no bundle banner found): ${p.file}`); continue; }
  html = html.replace(BANNER_END_REGEX, `$1\n${buildCta(p)}`);
  fs.writeFileSync(fp, html, 'utf8');
  console.log(`✅ Injected: ${p.file}`);
  updated++;
}
console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
