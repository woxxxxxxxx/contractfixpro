"""
ContractFixPro 修复脚本
1. 修复 nda-generator.html 的合同正文内容（当前是freelance模板正文）
2. 修复 invoice-template.html 的SEO描述文案
"""
import os, re
os.chdir(r"C:\Users\Administrator\contractfixpro")

# ─── 1. 修复 NDA 生成器 ────────────────────────────────────────────────────────
# 替换错误的 generateContract() 函数体

NDA_OLD_CONTRACT_BODY = """  var contract = `NON-DISCLOSURE AGREEMENT (NDA)

This Agreement is entered into as of ${today}, by and between:

CLIENT: ${clientName}
CONTRACTOR: ${contractorName}

----------------------------------------------------------

1. AGREEMENT

This NON-DISCLOSURE AGREEMENT (NDA) ("Agreement") is a legally binding contract between the Client and the Contractor, establishing the terms and conditions under which the Contractor will provide services to the Client.

----------------------------------------------------------

2. PARTIES

CLIENT:
Name: ${clientName}
(hereinafter referred to as "Client")

CONTRACTOR / SERVICE PROVIDER:
Name: ${contractorName}
(hereinafter referred to as "Contractor")

----------------------------------------------------------

3. CONFIDENTIAL INFORMATION & DISCLOSURE SCOPE

The Contractor agrees to provide the following services to the Client:

${projectDesc}

The Contractor shall perform the services in a professional and workmanlike manner, consistent with industry standards. Any changes to the scope of work must be agreed upon in writing by both parties prior to commencement of additional work.

----------------------------------------------------------

4. PAYMENT TERMS

Total Project Fee: $${paymentAmount}
Payment Schedule: ${paymentTerms}

Payment is due according to the schedule above. Late payments will incur a late fee of 1.5% per month on the outstanding balance. The Contractor reserves the right to suspend services for payments overdue by more than 14 days. The Client shall reimburse all reasonable expenses incurred by the Contractor in the performance of services, provided such expenses are pre-approved in writing.

----------------------------------------------------------

5. TIMELINE

Project Start Date: ${startDate}
Project End Date / Deadline: ${endDate}

The Contractor shall make reasonable efforts to complete the services by the agreed deadline. Delays caused by the Client's failure to provide necessary materials, feedback, or approvals shall not be attributed to the Contractor. The Contractor shall notify the Client promptly of any anticipated delays.

----------------------------------------------------------

6. INTELLECTUAL PROPERTY

Upon receipt of full payment from the Client, the Contractor assigns to the Client all rights, title, and interest in and to the deliverables created specifically for this project. The Contractor retains the right to: (a) use pre-existing materials, tools, and methodologies; (b) display the work in the Contractor's portfolio unless otherwise agreed in writing.

----------------------------------------------------------

7. CONFIDENTIALITY

Both parties agree to keep confidential all proprietary or sensitive information disclosed during this engagement. The receiving party shall not disclose such information to third parties without prior written consent. This confidentiality obligation survives the termination of this Agreement for a period of three (3) years.

----------------------------------------------------------

8. INDEPENDENT CONTRACTOR

The Contractor is an independent contractor and not an employee of the Client. The Contractor is responsible for all taxes arising from compensation received under this Agreement. Nothing in this Agreement shall be construed as creating an employer-employee, partnership, or joint venture relationship.

----------------------------------------------------------

9. TERMINATION

Either party may terminate this Agreement with fourteen (14) days written notice. In the event of termination by the Client, the Client agrees to pay for all work completed through the date of termination. The Contractor may terminate immediately if the Client fails to make payment as required. Upon termination, each party shall return or destroy the other party's confidential materials.

----------------------------------------------------------

10. LIMITATION OF LIABILITY

The Contractor's total liability under this Agreement shall not exceed the total fees paid by the Client in the three (3) months preceding the claim. Neither party shall be liable for indirect, incidental, or consequential damages.

----------------------------------------------------------

11. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of ${governingLaw}. Any disputes shall be resolved through binding arbitration in ${governingLaw} before resort to litigation.

----------------------------------------------------------

12. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements. This Agreement may only be modified in writing signed by both parties.

----------------------------------------------------------

SIGNATURES

CLIENT: ___________________________    Date: ____________
Name: ${clientName}"""

NDA_NEW_CONTRACT_BODY = """  var contract = `NON-DISCLOSURE AGREEMENT (NDA)

This Non-Disclosure Agreement ("Agreement") is entered into as of ${today}, by and between:

DISCLOSING PARTY: ${clientName}
  (hereinafter referred to as "Disclosing Party")

RECEIVING PARTY: ${contractorName}
  (hereinafter referred to as "Receiving Party")

NDA Type: ${nda_type}

----------------------------------------------------------

RECITALS

The parties wish to explore a potential business relationship or collaboration. In connection with this relationship, the Disclosing Party may disclose to the Receiving Party certain confidential and proprietary information. The parties wish to protect such information from unauthorised use or disclosure.

----------------------------------------------------------

1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any and all non-public information disclosed by the Disclosing Party to the Receiving Party, whether in oral, written, electronic, or other form, including but not limited to:

${confidential_info}

Additional categories: trade secrets, business plans, financial data, client and customer lists, pricing strategies, technical specifications, software code, proprietary processes, marketing strategies, and any other information designated as confidential or that would reasonably be considered confidential by its nature.

----------------------------------------------------------

2. PURPOSE OF DISCLOSURE

The Confidential Information is disclosed solely for the following purpose:

${projectDesc}

("Permitted Purpose")

The Receiving Party shall not use the Confidential Information for any purpose other than the Permitted Purpose without the prior written consent of the Disclosing Party.

----------------------------------------------------------

3. OBLIGATIONS OF THE RECEIVING PARTY

The Receiving Party agrees to:

(a) Hold all Confidential Information in strict confidence using no less than the same degree of care it uses to protect its own confidential information, and in any event no less than reasonable care;

(b) Not disclose any Confidential Information to any third party without the prior written consent of the Disclosing Party, except to the Receiving Party's employees, agents, or advisors who have a need to know for the Permitted Purpose and are bound by confidentiality obligations at least as protective as this Agreement;

(c) Not use the Confidential Information for any purpose other than the Permitted Purpose;

(d) Promptly notify the Disclosing Party upon becoming aware of any actual or suspected breach of this Agreement.

----------------------------------------------------------

4. EXCLUSIONS FROM CONFIDENTIALITY

This Agreement does not apply to information that:

(a) Is or becomes publicly available through no fault of the Receiving Party;
(b) Was rightfully known to the Receiving Party before disclosure by the Disclosing Party;
(c) Is independently developed by the Receiving Party without use of or reference to the Confidential Information;
(d) Is required to be disclosed by law, court order, or regulatory authority, provided the Receiving Party gives the Disclosing Party prompt prior written notice to allow it to seek a protective order.

----------------------------------------------------------

5. TERM AND DURATION

This Agreement shall commence on ${startDate} and shall remain in effect until ${endDate}, unless earlier terminated by either party upon thirty (30) days written notice. Notwithstanding any termination, the obligations of confidentiality shall survive for a period of three (3) years after the termination of this Agreement.

----------------------------------------------------------

6. RETURN OR DESTRUCTION OF INFORMATION

Upon request by the Disclosing Party or upon termination of this Agreement, the Receiving Party shall promptly return or, at the Disclosing Party's election, certifiably destroy all Confidential Information and all copies, extracts, or other reproductions thereof.

----------------------------------------------------------

7. NO LICENCE OR OWNERSHIP TRANSFER

Nothing in this Agreement grants the Receiving Party any right, title, or licence in or to the Confidential Information. All Confidential Information remains the exclusive property of the Disclosing Party.

----------------------------------------------------------

8. REMEDIES

The Receiving Party acknowledges that any breach of this Agreement may cause irreparable harm to the Disclosing Party for which monetary damages may be inadequate. Accordingly, the Disclosing Party shall be entitled to seek equitable relief, including injunction and specific performance, in addition to all other remedies available at law or in equity.

----------------------------------------------------------

9. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of ${governingLaw}. Any disputes arising under this Agreement that cannot be resolved through good-faith negotiation shall be submitted to binding arbitration in ${governingLaw}.

----------------------------------------------------------

10. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions, representations, and understandings. This Agreement may only be amended by a written instrument signed by both parties.

----------------------------------------------------------

SIGNATURES

IN WITNESS WHEREOF, the parties have executed this Non-Disclosure Agreement as of the date first written above.

DISCLOSING PARTY: ___________________________    Date: ____________
Name: ${clientName}"""

with open("nda-generator.html", "r", encoding="utf-8") as f:
    nda = f.read()

orig = nda
nda = nda.replace(NDA_OLD_CONTRACT_BODY, NDA_NEW_CONTRACT_BODY)
if nda != orig:
    with open("nda-generator.html", "w", encoding="utf-8") as f:
        f.write(nda)
    print("nda-generator.html: FIXED")
else:
    print("nda-generator.html: NO MATCH - check string")

# ─── 2. 修复 invoice-template.html SEO 文案 ───────────────────────────────────
SEO_OLD = """<h2>About Invoice Template Generator</h2>
  <p>ContractFixPro's Invoice Template Generator provides a clear, professionally structured agreement template to formalise any business relationship or project engagement. Whether you are establishing terms with a new client, entering a service arrangement, or documenting the scope of a creative or professional project, having a written agreement in place protects both parties and establishes expectations clearly before work begins.</p><br>
  <p>Our Invoice Template Generator covers all the essential elements of a professional business agreement: identification of all parties, scope of work or services, compensation and payment terms, timeline and delivery expectations, intellectual property provisions, confidentiality requirements, termination conditions, and dispute resolution procedures. Each section is written in clear, practical language designed for everyday business use.</p><br>
  <p>A formal written contract is one of the most important tools for maintaining professional business relationships. It documents the mutual understanding reached during negotiations, provides a reference point if questions arise during the project, and gives both parties legal recourse if the other fails to fulfill their obligations. Businesses that use formal contracts consistently experience fewer disputes and more professional client relationships.</p><br>
  <p>ContractFixPro provides this Invoice Template Generator and a comprehensive library of templates covering every major type of business agreement. All templates are available to download and customise for your specific engagement. Start every business relationship with the professional foundation it deserves.</p>"""

SEO_NEW = """<h2>About Invoice Template Generator</h2>
  <p>ContractFixPro's Invoice Template Generator is a free online tool that lets you create a professional invoice document in seconds — no account required, no software to install. Whether you are a freelancer, consultant, or small business owner, having a clean, structured invoice template helps you get paid faster and present a professional image to clients.</p><br>
  <p>Our Invoice Template Generator produces a customisable invoice covering all the key fields: your business name and contact details, client information, invoice number and date, itemised line items with quantities and rates, subtotal, applicable taxes, and the final amount due. You can also add payment terms, notes, and due date reminders.</p><br>
  <p>Unlike a service agreement or contract, an invoice is a billing document issued after services are rendered or goods delivered. It serves as a formal request for payment and as a record for your accounts. ContractFixPro's Invoice Template Generator is specifically designed for invoicing — not to be confused with a general service agreement template.</p><br>
  <p>Need a contract as well as an invoice? ContractFixPro offers a full library of professional contract templates alongside this Invoice Template Generator. Browse our collection to find freelance contracts, NDAs, consulting agreements, and more — all free to generate and download.</p>"""

with open("invoice-template.html", "r", encoding="utf-8") as f:
    inv = f.read()
orig = inv
inv = inv.replace(SEO_OLD, SEO_NEW)
if inv != orig:
    with open("invoice-template.html", "w", encoding="utf-8") as f:
        f.write(inv)
    print("invoice-template.html: SEO FIXED")
else:
    print("invoice-template.html: SEO NO MATCH - trying partial fix")
    # Try fixing just the misleading paragraph
    inv = inv.replace(
        "provides a clear, professionally structured agreement template to formalise any business relationship or project engagement.",
        "provides a professional invoice document you can customise and download in seconds — no signup required."
    )
    inv = inv.replace(
        "Our Invoice Template Generator covers all the essential elements of a professional business agreement: identification of all parties, scope of work or services, compensation and payment terms, timeline and delivery expectations, intellectual property provisions, confidentiality requirements, termination conditions, and dispute resolution procedures.",
        "Our Invoice Template Generator covers all key invoicing fields: business and client details, invoice number, date, line items with quantities and rates, tax, discount, and the total amount due with payment terms."
    )
    with open("invoice-template.html", "w", encoding="utf-8") as f:
        f.write(inv)
    print("invoice-template.html: partial SEO fix applied")

print("ContractFixPro fixes complete.")
