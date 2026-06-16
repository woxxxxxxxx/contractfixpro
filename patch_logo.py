import glob, re

logo_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 52" width="300" height="52">
  <defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e40af"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs>
  <rect x="2" y="2" width="48" height="48" rx="10" fill="#eff6ff"/>
  <rect x="6" y="6" width="20" height="20" rx="2.5" fill="#bfdbfe"/>
  <line x1="9" y1="13" x2="23" y2="13" stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="9" y1="18" x2="23" y2="18" stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="30" y="6" width="20" height="20" rx="2.5" fill="#93c5fd"/>
  <line x1="33" y1="13" x2="47" y2="13" stroke="#1e40af" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="33" y1="18" x2="42" y2="18" stroke="#1e40af" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="6" y="30" width="20" height="20" rx="2.5" fill="#93c5fd"/>
  <line x1="9" y1="38" x2="23" y2="38" stroke="#1e40af" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="9" y1="43" x2="17" y2="43" stroke="#1e40af" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="30" y="30" width="20" height="20" rx="2.5" fill="url(#cg)"/>
  <polyline points="34,40 38,45 47,34" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="62" y="26" font-family="-apple-system,BlinkMacSystemFont,\'Inter\',\'Segoe UI\',sans-serif" font-size="19" font-weight="700" fill="#1e3a8a" letter-spacing="-0.4" dominant-baseline="central">Contract<tspan fill="#2563eb">Fix</tspan><tspan fill="#64748b" font-weight="500">Pro</tspan></text>
</svg>'''

favicon_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e40af"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs>
  <rect width="64" height="64" rx="12" fill="#eff6ff"/>
  <rect x="6" y="6" width="24" height="24" rx="3" fill="#bfdbfe"/>
  <line x1="11" y1="14" x2="25" y2="14" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
  <line x1="11" y1="19" x2="25" y2="19" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
  <line x1="11" y1="24" x2="20" y2="24" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
  <rect x="34" y="6" width="24" height="24" rx="3" fill="#93c5fd"/>
  <line x1="39" y1="14" x2="53" y2="14" stroke="#1e40af" stroke-width="2" stroke-linecap="round"/>
  <line x1="39" y1="19" x2="53" y2="19" stroke="#1e40af" stroke-width="2" stroke-linecap="round"/>
  <rect x="6" y="34" width="24" height="24" rx="3" fill="#93c5fd"/>
  <line x1="11" y1="42" x2="25" y2="42" stroke="#1e40af" stroke-width="2" stroke-linecap="round"/>
  <line x1="11" y1="47" x2="20" y2="47" stroke="#1e40af" stroke-width="2" stroke-linecap="round"/>
  <rect x="34" y="34" width="24" height="24" rx="3" fill="url(#cg)"/>
  <polyline points="40,47 45,52 56,38" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

open('C:/Users/Administrator/contractfixpro/logo.svg', 'w', encoding='utf-8').write(logo_svg)
open('C:/Users/Administrator/contractfixpro/favicon.svg', 'w', encoding='utf-8').write(favicon_svg)
print('SVG files written')

trust_bar = '''<div class="trust-bar">
  <div class="trust-inner">
    <span>✓ 100% Free</span>
    <span>✓ No Signup Required</span>
    <span>✓ Download Instantly</span>
    <span>✓ Lawyer-Reviewed Templates</span>
    <span>✓ 20+ Contract Types</span>
  </div>
</div>'''

trust_css = '''
.trust-bar{background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 20px}
.trust-inner{max-width:1100px;margin:0 auto;display:flex;gap:28px;justify-content:center;flex-wrap:wrap}
.trust-inner span{font-size:13px;font-weight:600;color:#1e40af;white-space:nowrap}
'''

filter_css = '''
.filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.filter-btn{padding:7px 16px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.filter-btn:hover,.filter-btn.active{background:#2563eb;border-color:#2563eb;color:#fff}
'''

filter_html = '''<div class="filter-bar">
  <button class="filter-btn active" onclick="filterTools(this,\'all\')">All</button>
  <button class="filter-btn" onclick="filterTools(this,\'freelance\')">Freelance</button>
  <button class="filter-btn" onclick="filterTools(this,\'creative\')">Creative</button>
  <button class="filter-btn" onclick="filterTools(this,\'legal\')">Legal</button>
  <button class="filter-btn" onclick="filterTools(this,\'business\')">Business</button>
</div>'''

filter_js = '''<script>
function filterTools(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tool-card').forEach(card => {
    card.style.display = (cat === 'all' || card.dataset.cat === cat) ? 'flex' : 'none';
  });
}
</script>'''

f = 'C:/Users/Administrator/contractfixpro/index.html'
txt = open(f, encoding='utf-8').read()

# 1. 文字 logo → img
txt = txt.replace(
    '<a href="/" class="logo">Contract<span>FixPro</span></a>',
    '<a href="/" class="logo"><img src="/logo.svg" alt="ContractFixPro" height="36"></a>')

# 2. Nav CTA
txt = txt.replace(
    '<a href="/about.html" class="nav-cta">About</a>',
    '<a href="/freelance-contract.html" class="nav-cta">Start Free</a>')

# 3. Hero title
txt = txt.replace(
    '<h1>Free Freelance Contract Generator</h1>',
    '<h1>Free Contract Templates for Freelancers &amp; Businesses</h1>')

# 4. favicon svg-only
txt = re.sub(r'<link rel="icon"[^>]*favicon\.ico[^>]*>', '', txt)
txt = re.sub(r'<link rel="icon"[^>]*favicon\.png[^>]*>', '', txt)
if 'favicon.svg' not in txt:
    txt = txt.replace('<link rel="canonical"',
                      '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n<link rel="canonical"', 1)

# 5. 信任栏 + 筛选器 CSS
txt = txt.replace('</style>', trust_css + filter_css + '</style>', 1)

# 6. 信任栏插入 hero 之后
txt = re.sub(r'(</div>\s*\n\s*)(<!-- tools|<section|<div class="container)',
             r'\1' + trust_bar + r'\n\2', txt, count=1)

# 7. 筛选器插入 tool-grid 之前
txt = re.sub(r'(<div class="tool-grid")', filter_html + r'\n\1', txt, count=1)

# 8. 筛选器 JS 插入 </body> 前
txt = txt.replace('</body>', filter_js + '\n</body>')

open(f, 'w', encoding='utf-8').write(txt)
print('index.html updated')

# 工具页 logo + favicon
count = 0
for fp in glob.glob('C:/Users/Administrator/contractfixpro/*.html'):
    if fp.replace('\\', '/').endswith('index.html'):
        continue
    t = open(fp, encoding='utf-8').read()
    orig = t
    t = t.replace('<a href="/" class="logo">Contract<span>FixPro</span></a>',
                  '<a href="/" class="logo"><img src="/logo.svg" alt="ContractFixPro" height="36"></a>')
    t = re.sub(r'<link rel="icon"[^>]*favicon\.ico[^>]*>', '', t)
    t = re.sub(r'<link rel="icon"[^>]*favicon\.png[^>]*>', '', t)
    if 'favicon.svg' not in t:
        t = t.replace('<link rel="canonical"',
                      '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n<link rel="canonical"', 1)
    if t != orig:
        open(fp, 'w', encoding='utf-8').write(t)
        count += 1

print(f'tool pages updated: {count}')
print('all done')
