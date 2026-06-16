import glob, re

f = 'C:/Users/Administrator/contractfixpro/index.html'
txt = open(f, encoding='utf-8').read()
txt = txt.replace(
    '<div class="footer-logo"><img src="/logo.svg" alt="ContractFixPro" height="28" style="filter:brightness(0) invert(1)"></div>',
    '<div class="footer-logo">Contract<span>FixPro</span></div>')
open(f, 'w', encoding='utf-8').write(txt)

count = 0
for fp in glob.glob('C:/Users/Administrator/contractfixpro/*.html'):
    if fp.replace('\\', '/').endswith('index.html'):
        continue
    t = open(fp, encoding='utf-8').read()
    new = t.replace(
        '<div class="footer-logo"><img src="/logo.svg" alt="ContractFixPro" height="24" style="filter:brightness(0) invert(1)"></div>',
        '<div class="footer-logo">Contract<span>FixPro</span></div>')
    if new != t:
        open(fp, 'w', encoding='utf-8').write(new)
        count += 1

print(f'reverted: index + {count} tool pages')
print('done')
