#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix broken FAQ sections in contractfixpro HTML files.
Raw text after </h2> needs to be wrapped in proper faq-q/faq-a divs."""

import os, re

SITE_DIR = r"C:\Users\Administrator\contractfixpro"
MARKER = "<!-- cf-seo-expanded -->"
SKIP = {"404.html", "about.html", "privacy.html", "index.html"}

def get_cat(slug):
    if re.search(r'freelance|independent.contractor|consultant', slug):
        return 'freelance'
    if re.search(r'nda|non.disclosure|confidential', slug):
        return 'nda'
    if re.search(r'design|graphic|logo|brand|web.design', slug):
        return 'design'
    if re.search(r'influencer|brand.ambassador|social.media|content.creator|ugc', slug):
        return 'creative'
    if re.search(r'service|maintenance|cleaning|lawn|landscaping|photography|videograph', slug):
        return 'service'
    if re.search(r'writing|copywriting|ghostwrit|editor', slug):
        return 'writing'
    return 'general'

def get_tool_name(content, slug):
    m = re.search(r'<h1[^>]*>([^<]+)</h1>', content)
    if m:
        return m.group(1).strip()
    m = re.search(r'<title>([^<|]+)', content)
    if m:
        t = m.group(1).strip()
        for sep in [' - ', ' | ']:
            if sep in t:
                return t.split(sep)[0].strip()
        return t
    return slug.replace('-', ' ').title()

def build_faq(name, cat):
    templates = {
        'freelance': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account, no subscription, and no payment. Download and use it for any freelance project.".format(name)),
            ("Can I customise the {} for my specific project?".format(name),
             "Yes. The {} is a template designed to be edited. Update the payment terms, project scope, deadlines, and any other clauses to match your specific engagement.".format(name)),
            ("Is the {} legally binding?".format(name),
             "A properly completed and signed {} creates a legally enforceable agreement. For high-value contracts or complex legal situations, have an attorney review the final document.".format(name)),
            ("What payment terms should I include in the {}?".format(name),
             "Include your rate (hourly or fixed), payment schedule (deposit, milestones, or on completion), accepted payment methods, and late payment penalties. Clear payment terms reduce disputes significantly.".format(name)),
            ("What happens if my client wants changes after signing?".format(name),
             "Use a change order process. The {} includes provisions for scope changes, but any modifications to the original agreement should be documented in writing and signed by both parties.".format(name)),
        ],
        'nda': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account and no payment. Download and adapt it for your confidentiality needs.".format(name)),
            ("What information does the {} protect?".format(name),
             "The {} protects confidential business information including trade secrets, financial data, client lists, proprietary processes, and any other information you designate as confidential in the agreement.".format(name)),
            ("Is a {} enforceable in court?".format(name),
             "A properly drafted and signed {} is legally enforceable in most jurisdictions. For sensitive or high-value information, have a lawyer review the agreement before signing.".format(name)),
            ("How long should an {} remain in effect?".format(name),
             "Most NDAs run for 1 to 5 years. The appropriate term depends on how long the information remains sensitive. Some trade secrets justify indefinite protection and perpetual clauses are legally valid in many jurisdictions.".format(name)),
            ("Can I use the {} for both employees and contractors?".format(name),
             "Yes. The {} template can be adapted for employees, contractors, partners, or any party who will have access to confidential information. Adjust the recitals and definitions to reflect the relationship.".format(name)),
        ],
        'design': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account and no payment. Use it for any design project.".format(name)),
            ("What should I include in the project scope section of the {}?".format(name),
             "Be specific: list every deliverable (logo files, brand guide, web pages, etc.), the number of included revision rounds, file formats on delivery, and what is explicitly excluded from the project scope.".format(name)),
            ("Who owns the design work after the project?".format(name),
             "The {} specifies that full ownership of final deliverables transfers to the client upon receipt of final payment. Specify clearly whether you retain rights to show the work in your portfolio.".format(name)),
            ("How many revisions should I include in the {}?".format(name),
             "Typically 2 to 3 rounds of revisions per deliverable is standard. Define revision rounds clearly in the {} to avoid scope creep and unlimited unpaid revision requests.".format(name)),
            ("What if the client needs the project urgently?".format(name),
             "Include a rush fee clause in your {}. Specify the premium you charge for accelerated turnaround and the minimum lead time you require for standard and rush projects.".format(name)),
        ],
        'creative': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account and no payment. Download and customise it for your creative work.".format(name)),
            ("What usage rights should I specify in the {}?".format(name),
             "Define exactly where and how the client may use your content: which platforms, geographic territories, duration of use, exclusivity, and whether the license is limited or perpetual.".format(name)),
            ("Who owns the content I create under the {}?".format(name),
             "The {} grants the client a defined license to use the content while you retain the copyright to your original work unless a full buyout is agreed and specified in the contract.".format(name)),
            ("How should I handle late or missed payments in the {}?".format(name),
             "The {} includes payment terms with late fees. Specify your payment schedule, grace period, late fee rate, and your right to pause or terminate work if payment is not received on time.".format(name)),
            ("Can I display work created under this {} in my portfolio?".format(name),
             "Include a portfolio rights clause in your {}. Most clients accept portfolio usage; some brands require a confidentiality period before public display. Negotiate this before signing.".format(name)),
        ],
        'service': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account and no payment. Use it for any service business.".format(name)),
            ("What services should I list in the {}?".format(name),
             "Be as specific as possible. List every service included, the frequency of delivery, the standard to which services will be performed, and what is explicitly excluded.".format(name)),
            ("Can I use the {} for recurring service agreements?".format(name),
             "Yes. The {} includes provisions for ongoing service relationships. Specify the service frequency, contract term, renewal conditions, and how either party can terminate the agreement.".format(name)),
            ("What liability limitations should I include in the {}?".format(name),
             "The {} includes a limitation of liability clause capping your exposure to the value of services rendered. Review this clause carefully and consider professional liability insurance for your service category.".format(name)),
            ("How should I handle cancellations in the {}?".format(name),
             "Include clear cancellation terms in your {}: advance notice required, cancellation fees, refund policy for prepaid services, and how last-minute cancellations are handled.".format(name)),
        ],
        'writing': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account and no payment. Download and use it for any writing project.".format(name)),
            ("Who owns the content written under the {}?".format(name),
             "The {} specifies that copyright in the written work transfers to the client upon receipt of full payment, unless a ghostwriting, licensing, or byline arrangement is specified in the agreement.".format(name)),
            ("How should I handle revisions in the {}?".format(name),
             "Specify the number of included revision rounds and what constitutes a revision versus a new project. The {} helps you define this clearly to prevent unlimited unpaid revision requests.".format(name)),
            ("Should I require a kill fee in the {}?".format(name),
             "Yes. A kill fee (typically 25–50% of the project total) protects you if the client cancels after work has begun. Include this in your {} to ensure you are compensated for time already invested.".format(name)),
            ("What information should I gather before completing the {}?".format(name),
             "Collect the full project brief, tone and style guidelines, target audience, deadline, word count, usage rights required, number of revision rounds, and payment terms before finalising your {}.".format(name)),
        ],
        'general': [
            ("Is this {} free to use?".format(name),
             "Yes, completely free. ContractFixPro's {} requires no account, no subscription, and no payment. Download and use it immediately.".format(name)),
            ("Can I customise the {} for my specific situation?".format(name),
             "Yes. The {} is a template designed to be edited. Update all fields including names, dates, payment terms, scope of work, and any other clauses to match your specific agreement.".format(name)),
            ("Is the {} legally binding?".format(name),
             "A properly completed and signed {} is a legally enforceable contract. For high-value or legally complex agreements, have an attorney review the final document before signing.".format(name)),
            ("Do both parties need to sign the {}?".format(name),
             "Yes. Both parties must sign the {} for it to be a valid, enforceable agreement. Include signature lines, printed names, dates, and company names or titles where applicable.".format(name)),
            ("What if I need to add custom clauses to the {}?".format(name),
             "You can add, remove, or modify any clause in the {}. If you add custom clauses addressing specific risks or requirements for your project, consider having a lawyer review the additions.".format(name)),
        ],
    }
    pairs = templates.get(cat, templates['general'])
    items = []
    for q, a in pairs:
        items.append(
            '    <div class="faq-item">\n'
            '      <div class="faq-q">{}</div>\n'
            '      <div class="faq-a">{}</div>\n'
            '    </div>'.format(q, a)
        )
    return '\n'.join(items)

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    if MARKER not in content:
        return False, "no_marker"

    faq_start = content.find('<div class="faq-section">')
    if faq_start == -1:
        return False, "no_faq_section"

    h2_end = content.find('</h2>', faq_start)
    if h2_end == -1:
        return False, "no_h2"
    h2_end += len('</h2>')

    # Find closing </div> of faq-section using depth tracking
    pos = faq_start + len('<div class="faq-section">')
    depth = 1
    faq_end = -1
    while pos < len(content) and depth > 0:
        open_div = content.find('<div', pos)
        close_div = content.find('</div>', pos)
        if close_div == -1:
            break
        if open_div != -1 and open_div < close_div:
            depth += 1
            pos = open_div + 1
        else:
            depth -= 1
            if depth == 0:
                faq_end = close_div + len('</div>')
            pos = close_div + 1

    if faq_end == -1:
        return False, "no_close"

    slug = os.path.basename(filepath).replace('.html', '')
    cat = get_cat(slug)
    name = get_tool_name(content, slug)
    new_items = build_faq(name, cat)

    # Keep the opening div and h2, replace everything after h2 up to closing </div>
    faq_close_tag = '</div>'
    new_faq = (content[faq_start:h2_end] +
               '\n' + new_items + '\n  ' +
               faq_close_tag)

    new_content = content[:faq_start] + new_faq + content[faq_end:]

    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(new_content)

    return True, cat

def main():
    files = sorted([f for f in os.listdir(SITE_DIR)
                    if f.endswith('.html') and f not in SKIP])
    fixed = skipped = errors = 0
    for fname in files:
        fpath = os.path.join(SITE_DIR, fname)
        ok, msg = fix_file(fpath)
        if ok:
            fixed += 1
            print("  OK  {} ({})".format(fname.replace('.html',''), msg))
        elif msg == "no_marker":
            skipped += 1
        else:
            errors += 1
            print("  !!  {} ({})".format(fname.replace('.html',''), msg))
    print("\nDone: fixed={}, skipped_no_marker={}, errors={}".format(fixed, skipped, errors))

if __name__ == '__main__':
    main()
