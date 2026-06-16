import glob, re

trust_html = '''<div class="trust-bar">
  <div class="trust-inner">
    <span>✓ 100% Free</span>
    <span>✓ No Signup Required</span>
    <span>✓ Download Instantly</span>
    <span>✓ Lawyer-Reviewed Templates</span>
    <span>✓ 20+ Contract Types</span>
  </div>
</div>'''

f = 'C:/Users/Administrator/contractfixpro/index.html'
txt = open(f, encoding='utf-8').read()

# 1. 信任栏插入 hero 结束后
txt = re.sub(r'(</div>\s*\n)(.*?<div class="section-title")',
             r'\1' + trust_html + r'\n\2', txt, count=1, flags=re.DOTALL)

# 2. footer logo 改 SVG（index）
txt = txt.replace(
    '<div class="footer-logo">Contract<span>FixPro</span></div>',
    '<div class="footer-logo"><img src="/logo.svg" alt="ContractFixPro" height="28" style="filter:brightness(0) invert(1)"></div>')

open(f, 'w', encoding='utf-8').write(txt)
print('index.html done')

# 3. 所有工具页 footer logo 也改
count = 0
for fp in glob.glob('C:/Users/Administrator/contractfixpro/*.html'):
    if fp.replace('\\', '/').endswith('index.html'):
        continue
    t = open(fp, encoding='utf-8').read()
    if 'footer-logo' in t:
        new = re.sub(
            r'<div class="footer-logo">Contract<span[^>]*>FixPro</span></div>',
            '<div class="footer-logo"><img src="/logo.svg" alt="ContractFixPro" height="24" style="filter:brightness(0) invert(1)"></div>',
            t)
        if new != t:
            open(fp, 'w', encoding='utf-8').write(new)
            count += 1

print(f'tool pages footer updated: {count}')
print('all done')
