import re

f = 'C:/Users/Administrator/contractfixpro/index.html'
txt = open(f, encoding='utf-8').read()

# 1. 删掉多插入的 filter-bar
txt = re.sub(r'<div class="filter-bar">.*?</div>\s*\n', '', txt, flags=re.DOTALL)

# 2. 删掉多余的 filterTools JS
txt = re.sub(r'<script>\s*function filterTools.*?</script>\s*', '', txt, flags=re.DOTALL)

# 3. 删掉 filter-bar / filter-btn CSS
txt = re.sub(r'\.filter-bar\{[^}]+\}\s*', '', txt)
txt = re.sub(r'\.filter-btn\{[^}]+\}\s*', '', txt)
txt = re.sub(r'\.filter-btn:hover,\.filter-btn\.active\{[^}]+\}\s*', '', txt)

# 4. 删掉 nav 里的 3 个快捷链接，只保留 CTA
txt = re.sub(r'<a href="/#tools">Tools</a>\s*', '', txt)
txt = re.sub(r'<a href="/service-agreement\.html">Service Agreement</a>\s*', '', txt)
txt = re.sub(r'<a href="/nda-generator\.html">NDA</a>\s*', '', txt)

# 5. 升级 cat-tab 样式
old_cattab_css = re.search(r'\.cat-tab\{[^}]+\}', txt)
if old_cattab_css:
    txt = txt.replace(old_cattab_css.group(0),
        '.cat-tab{padding:7px 16px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-block}')
    print('cat-tab CSS updated')
else:
    print('cat-tab CSS not found')

txt = re.sub(r'\.cat-tab\.active\{[^}]+\}',
    '.cat-tab.active,.cat-tab:hover{background:#2563eb;border-color:#2563eb;color:#fff}', txt)

open(f, 'w', encoding='utf-8').write(txt)
print('done')
