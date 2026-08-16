# ContractFixPro

## 基础信息
- 域名：contractfixpro.com
- 主色：#2563eb（蓝）
- GA ID：G-ZPN71NWZGK
- 工具/内容数量：20 合同工具
- 部署方式：GitHub Pages（git push origin master）

## 当前进度
- AdSense 状态：正在准备
- 上次审计完成：待开始
- 下一步：内容深化 + AdSense 申请

## 专属配置
- PayHip 自动化脚本：contractfixpro/scripts/payhip-*.js（Playwright + browser-session 复用登录态）

## 关键修复历史
- [2026-06-24] LawDepot partner CTA 样式修复：6 个接入页统一使用横向 LawDepot 标识，放大 logo 容器；按钮文字强制白色，避免被文章链接样式覆盖；保留 `rel="sponsored noopener nofollow"`。
- [2026-06-24] LawDepot logo 二次替换：按用户提供截图抠出透明 PNG，6 个 CTA 页引用 `/assets/img/lawdepot-logo.png`。

## 待办
- [ ] 审计全站
- [ ] 内容深化
- [ ] 申请 AdSense

## 2026-08-15 SEO observation and copywriting page
- Added a reusable equal-window Search Console review for the earliest August 9 optimization batch. The video-editing contract produced the clearest early positive signal; the remaining pages stay locked until their 14-day checkpoint.
- Expanded `copywriting-contract.html` with an exact-intent answer, a worked SaaS launch-copy project record, revision-versus-scope-change tests, visible review metadata, and updated evidence review while preserving the browser generator.
- Desktop and 390px mobile checks passed without overflow or script errors. The AdSense release gate remains green at 35 indexable URLs and eight retained guides. Hold the page stable through 2026-08-29.

## 2026-08-16 music production project record
- Rebuilt `music-producer-contract.html` as an evidence-led music production planning tool. It now separates composition, sound recording/master, third-party assets, and file handoff instead of presenting them as one automatic ownership decision.
- Removed fixed legal outcomes from the generated output, including automatic assignment, late fees, confidentiality duration, worker classification, liability cap, termination period, and binding arbitration. The output now records facts, proposals, evidence, and terms for qualified review.
- Added a worked example, rights-record matrix, bounded FAQ/schema, current U.S. Copyright Office sources, clearer limitations, and a `2026-08-16` sitemap timestamp. Hold this page stable through 2026-08-30 unless a production defect appears.

## 2026-08-16 video production project record
- Rebuilt `videography-contract.html` around a production evidence workflow covering shoot plans, locations, releases, licensed assets, drone operations, delivery specifications, review rounds, source files, and usage proposals.
- Removed automatic legal conclusions from the generated output. The browser tool now produces a factual project record for review and leaves ownership, releases, worker classification, liability, termination, governing law, and dispute procedure unresolved unless the parties document them separately.
- Added a worked product-video example, production gates, deliverable records, bounded FAQ/schema, and current U.S. Copyright Office and FAA sources. Hold this page stable through 2026-08-30 unless a production defect appears.


## 2026-06-28 AdSense ????
- Blog ??/??? 16 ????????????? sitemap.xml?
- ??????????/?????????


## 2026-07-01 search-click acceleration
- Added 4 search-intent guide hub pages based on recent Search Console exposure.
- Updated title/meta descriptions for high-impression, low-CTR pages and added a homepage entry block for the new guides.
- Regenerated sitemap.xml with lastmod=2026-07-01. Goal: improve long-tail relevance, internal link strength, and search-result click clarity.

## 2026-07-11 AdSense low-value remediation
- AdSense rejected the site for low-value content. Audit found 16 batch articles around 200-230 words with near-identical structure, thin search guides, an affiliate-first homepage, and unsupported lawyer-reviewed/legally sound positioning.
- Eight core articles were rebuilt to 626-657 words with concrete scenarios, verification cards, decision records, disclaimers, and IRS/Copyright Office/FTC sources. Nine thin articles and four thin guides are noindex, removed from search inventory, and contain no AdSense loader.
- Homepage LawDepot feature block was removed from above the tools, commercial/legal claims were softened, editorial-policy.html was added, and the sitemap now contains 33 focused URLs.

## 2026-07-15 affiliate measurement
- Added `/affiliate-tracking.js` to all 49 HTML pages and deployed through GitHub Pages in commit `910b92b`.
- The tracker emits structured GA4 `affiliate_click` events for sponsored links; the shared daily report now reports them by site.
- Live tracker/homepage checks and the ContractFixPro post-deploy check passed.

## 2026-07-24 AdSense release hardening
- Fixed the shared preflight rule that incorrectly returned all child blog pages to noindex.
- Released eight reviewed contract guides with topic-specific scenarios, review steps, evidence records, worked examples, authorship, review dates, and primary sources.
- Kept unfinished blog drafts and thin guide pages noindex and ad-free.
- Rebuilt the sitemap from the actual indexable inventory. The release gate reports 35 indexable pages, eight editorial guides, no sitemap defects, and no semantic-duplication alerts.
- Desktop and mobile browser checks passed without overflow, broken images, duplicate H1 elements, or page script errors.
