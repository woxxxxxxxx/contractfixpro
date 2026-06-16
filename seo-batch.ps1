# ContractFixPro SEO Processor - single batch (20 files)
# Adds seo-section, expands FAQ to 5 Q&As, adds 3 related cards

$siteDir  = "C:\Users\Administrator\contractfixpro"
$skipFiles = @('404.html','about.html','index.html','privacy.html')
$allFiles  = @(Get-ChildItem -Path $siteDir -Filter "*.html" |
    Where-Object { $skipFiles -notcontains $_.Name } |
    Sort-Object Name)

Write-Host "ContractFixPro tool files: $($allFiles.Count)"

# ── SEO CSS ───────────────────────────────────────────────────────────────────
$SeoCss = '.seo-section{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:32px;box-shadow:var(--shadow);margin-bottom:24px}.seo-section h2{font-size:1rem;font-weight:700;margin-bottom:12px}.seo-section p{font-size:14px;color:var(--text2);line-height:1.8;margin-bottom:10px}.seo-section p:last-child{margin-bottom:0}'

# ── Categorise contract type ──────────────────────────────────────────────────
function Get-Cat([string]$slug) {
    if ($slug -match 'freelance|independent|self.employ|sole')       { return 'freelance' }
    if ($slug -match 'nda|confidential|non.disclos')                  { return 'nda' }
    if ($slug -match 'design|graphic|logo|web.design|ui|ux')         { return 'design' }
    if ($slug -match 'photo|video|film|music|media|influenc|social|brand') { return 'creative' }
    if ($slug -match 'service|consult|agreement|maintenance|virtual|onboard') { return 'service' }
    if ($slug -match 'copy|writing|content')                          { return 'writing' }
    return 'general'
}

function Get-Seo([string]$name, [string]$slug) {
    $cat = Get-Cat $slug
    switch ($cat) {
        'freelance' { return @"
<p>ContractFixPro's $name helps freelancers and their clients establish a clear, professional working relationship from day one. A solid freelance contract protects both parties by documenting the agreed scope of work, payment terms, deadlines, intellectual property rights, and the process for handling revisions, disputes, or early termination. Without a proper contract, even the most collaborative projects can end in misunderstandings or unpaid invoices.</p>
<p>Our $name provides a comprehensive template covering all the essential clauses that professional freelancers and their legal counsel recommend. The document addresses project scope definition, milestone-based or completion-based payment structures, late payment provisions, ownership of deliverables upon full payment, confidentiality obligations, and limitation of liability — giving both you and your client the certainty needed to work together confidently.</p>
<p>Whether you are a web developer, graphic designer, writer, consultant, photographer, or any other type of independent professional, this $name is adaptable to your specific services and client relationship. Simply fill in the details, customise the terms to fit your project, and download a professional contract document ready for review and signature.</p>
<p>Using a formal contract for every freelance engagement — no matter how small or how well you know the client — is the single most effective way to protect your business. ContractFixPro makes this professional practice easy, accessible, and free to start.</p>
"@ }
        'nda' { return @"
<p>ContractFixPro's $name makes it simple to create a legally structured non-disclosure agreement for any situation where confidential information needs to be shared between parties. Whether you are entering a new business partnership, sharing proprietary processes with a contractor, hiring someone who will have access to sensitive client data, or negotiating a potential acquisition, an NDA ensures that confidential information shared in the course of those discussions remains protected.</p>
<p>Our $name covers the essential elements of a robust confidentiality agreement: a clear definition of what constitutes confidential information, the obligations of the receiving party, permitted disclosures (such as to attorneys or required by law), the duration of confidentiality obligations, and the remedies available in case of breach. The template is written in plain language while incorporating the key legal elements that make NDAs enforceable.</p>
<p>Non-disclosure agreements are used across virtually every industry — by tech startups protecting source code and business plans, by businesses sharing financial data with potential investors, by employers protecting trade secrets from employees, and by creative professionals sharing unpublished work with clients. Our $name is flexible enough to serve unilateral (one-way) or mutual (both-way) disclosure scenarios.</p>
<p>ContractFixPro provides this $name and a full library of professional contract templates to help businesses and independent professionals protect their work and interests. All templates are designed for practical use and are available to download and customise for your specific situation.</p>
"@ }
        'design' { return @"
<p>ContractFixPro's $name provides a professional foundation for design engagements, protecting both designers and clients throughout the creative process. Design projects involve significant creative investment, iterative feedback cycles, and important questions about intellectual property ownership — all of which must be clearly addressed in a contract before work begins to avoid costly disputes later.</p>
<p>Our $name covers the specific needs of design engagements: detailed scope of work and deliverables specification, the number of included revision rounds, client feedback timelines, payment milestones tied to project phases, intellectual property transfer upon full payment, kill fees for project cancellations, and what happens if the client fails to provide required assets or approvals on schedule.</p>
<p>Having a clear contract in place also streamlines the design process itself. When clients understand upfront how many revisions are included, what constitutes a revision versus a new request, and how additional work outside the original scope will be priced, projects run more smoothly and relationships remain productive throughout the engagement.</p>
<p>ContractFixPro makes it easy to create professional design contracts tailored to your specific service offering. Whether you work on logos, websites, brand identities, marketing materials, or UI/UX projects, this $name provides the contractual framework your business needs to operate professionally and confidently.</p>
"@ }
        'creative' { return @"
<p>ContractFixPro's $name is designed for creative professionals who need formal, written agreements to govern their client engagements. Creative projects — whether photography, videography, music production, social media management, brand ambassador work, or influencer marketing — involve unique considerations around usage rights, content delivery, approval processes, and compensation that must be clearly documented before a project begins.</p>
<p>Our $name covers the specific requirements of creative engagements: detailed description of deliverables (number of images, videos, posts, or other content), licensing terms for how and where the content may be used, exclusivity periods if applicable, approval and revision processes, payment schedule tied to delivery milestones, and provisions for additional usage or extended licensing beyond the original agreement.</p>
<p>Intellectual property is particularly important in creative work. Who owns the raw files? Can the client modify the work? Are there usage restrictions by geography or time period? Can you use the work in your portfolio? Our $name addresses these questions explicitly, preventing misunderstandings that commonly arise between creative professionals and their clients.</p>
<p>ContractFixPro provides this $name to help creative professionals establish the professional, business-focused relationships their talent deserves. A solid contract protects your creative work, ensures you get paid appropriately, and sets clear expectations that lead to better client relationships.</p>
"@ }
        'service' { return @"
<p>ContractFixPro's $name provides a clear, professional framework for service-based business relationships. Whether you are a consultant, virtual assistant, agency, or service provider of any kind, a well-written service agreement is essential to defining exactly what you will deliver, when you will deliver it, and what you will be paid — protecting you and your client from costly misunderstandings.</p>
<p>Our $name covers all the critical elements of a professional service agreement: detailed scope of services, service standards and performance expectations, compensation and payment schedule, term and renewal provisions, termination conditions and notice requirements, intellectual property ownership, confidentiality obligations, and limitation of liability. Each section is designed to be practical and clear rather than overly legalistic.</p>
<p>A clear service agreement also helps you manage client expectations proactively. When clients know exactly what is included in your service, how changes to scope will be handled, and what the process is for addressing concerns, your service relationships run more smoothly. Our $name gives you the structure to set these boundaries professionally from the first engagement.</p>
<p>ContractFixPro offers this $name alongside a comprehensive library of professional contract templates for every type of business relationship. All templates are designed for practical use and can be downloaded and customised for your specific service business.</p>
"@ }
        'writing' { return @"
<p>ContractFixPro's $name provides the professional contractual framework that writers, copywriters, and content creators need to protect their work and get paid fairly for their creative contributions. Writing and content creation engagements involve specific considerations — including revision limits, source attribution, content ownership, kill fees, and publication rights — that general service contracts often fail to address adequately.</p>
<p>Our $name covers the unique requirements of writing engagements: scope of work (word count, format, number of pieces), delivery timelines, the revision process and number of included rounds, payment structure (flat fee, per-word rate, or milestone-based), what happens if the client cancels a project before completion, intellectual property assignment upon payment, and the writer's right to use the work in a portfolio.</p>
<p>Having a clear contract for every writing project — even for clients you have worked with before — prevents the most common problems writers face: scope creep, delayed payments, unlimited revision requests, and disputes over content ownership. Our $name makes establishing these professional boundaries easy and standard practice for your business.</p>
<p>ContractFixPro supports writers and content creators with this $name and a full library of professional contract templates. Protect your creative work, ensure timely payment, and build client relationships on a foundation of professional clarity.</p>
"@ }
        default { return @"
<p>ContractFixPro's $name provides a clear, professionally structured agreement template to formalise any business relationship or project engagement. Whether you are establishing terms with a new client, entering a service arrangement, or documenting the scope of a creative or professional project, having a written agreement in place protects both parties and establishes expectations clearly before work begins.</p>
<p>Our $name covers all the essential elements of a professional business agreement: identification of all parties, scope of work or services, compensation and payment terms, timeline and delivery expectations, intellectual property provisions, confidentiality requirements, termination conditions, and dispute resolution procedures. Each section is written in clear, practical language designed for everyday business use.</p>
<p>A formal written contract is one of the most important tools for maintaining professional business relationships. It documents the mutual understanding reached during negotiations, provides a reference point if questions arise during the project, and gives both parties legal recourse if the other fails to fulfill their obligations. Businesses that use formal contracts consistently experience fewer disputes and more professional client relationships.</p>
<p>ContractFixPro provides this $name and a comprehensive library of templates covering every major type of business agreement. All templates are available to download and customise for your specific engagement. Start every business relationship with the professional foundation it deserves.</p>
"@ }
    }
}

# ── 5 FAQs per category ───────────────────────────────────────────────────────
function Get-FaqItems([string]$name, [string]$slug) {
    $cat = Get-Cat $slug
    $qa = switch ($cat) {
        'freelance' { @(
            @("Is a freelance contract legally binding?","Yes, a signed freelance contract is a legally binding agreement. Both parties are obligated to fulfill the terms outlined, including payment obligations for the client and delivery obligations for the freelancer. Contracts are enforceable in civil court.")
            @("What should every freelance contract include?","At minimum: identification of both parties, a detailed scope of work, payment amount and schedule, project timeline, revision policy, intellectual property ownership upon payment, and termination conditions. Our $name template covers all of these.")
            @("Can I use this contract template for any type of freelance work?","Yes. The $name is designed to be adaptable across all types of freelance services including design, development, writing, consulting, photography, and more. Customise the scope and deliverables sections to match your specific service.")
            @("What happens if a client doesn't pay after I deliver the work?","Your signed contract is evidence of the agreed payment obligation. Options include sending a formal demand letter, filing a small claims court case (for smaller amounts), or engaging a collections agency. A strong contract with clear payment terms makes enforcement significantly easier.")
            @("Should I use a contract even for small or one-time projects?","Yes. Even small projects benefit from a written agreement. A contract for a $200 project takes minutes to create and can prevent disputes that would cost far more in time and stress to resolve without documentation.")
        )}
        'nda' { return @(
            @("Is an NDA enforceable?","Yes, properly drafted NDAs are legally enforceable. The agreement must clearly define what information is confidential, the obligations of the receiving party, and the duration of those obligations. Courts regularly uphold well-written NDA agreements.")
            @("What is the difference between a unilateral and mutual NDA?","A unilateral (one-way) NDA protects confidential information flowing in one direction only — typically from a disclosing party to a receiving party. A mutual NDA protects confidential information flowing both ways, appropriate when both parties are sharing sensitive information.")
            @("How long should an NDA last?","NDA duration depends on the nature of the information. Trade secrets may require indefinite protection. For business discussions or project details, 2-5 years is common. The $name template includes a customisable duration field.")
            @("What information can be excluded from an NDA?","Standard NDA exclusions include information that is already publicly available, information the receiving party independently developed, information received from a third party without restriction, and information required to be disclosed by law or court order.")
            @("Is this NDA template free to use?","Yes. ContractFixPro provides this $name template at no cost as a starting point for your confidentiality agreement. For complex arrangements involving significant value, consider having a qualified attorney review the final agreement.")
        )}
        'design' { return @(
            @("Who owns the design work — me or the client?","Typically, the designer retains copyright until the client pays in full, at which point ownership transfers as specified in the contract. Our $name template includes an intellectual property clause you can customise to specify when and how ownership transfers.")
            @("What should I do if a client requests changes beyond the agreed scope?","Your contract should specify how out-of-scope requests are handled — typically through a change order that documents additional work and associated costs. The $name template includes provisions for managing scope changes professionally.")
            @("How many revisions should I include in my contract?","This varies by project type and your working style. Common approaches include 2-3 rounds of revisions, or a defined number of individual revision requests. The $name template lets you specify exactly how revisions are defined and counted.")
            @("Should I charge a kill fee if a client cancels?","Yes. A kill fee (typically 25-50% of the total project fee) compensates you for work completed and opportunity cost when a client cancels a project. The $name template includes a customisable kill fee provision.")
            @("Can I show completed design work in my portfolio?","This depends on the terms agreed in your contract. The $name template includes a portfolio use clause that you can customise to permit or restrict portfolio display, with or without client attribution.")
        )}
        'creative' { return @(
            @("What usage rights should I include in a creative contract?","Specify exactly where and how the client may use your work — including geographic scope, media channels, exclusivity, time period, and whether the license is limited or perpetual. Our $name template includes a detailed rights and licensing section.")
            @("Who owns the raw files (photos, footage, audio) after delivery?","Raw and source files are not typically included unless explicitly agreed. The $name template addresses file delivery scope — clarifying whether raw files, edited files, or both are included and in what format.")
            @("Can a client edit or modify my creative work after delivery?","This should be specified in your contract. Some creators permit modifications; others restrict them to protect their artistic integrity. The $name template includes a modification rights clause you can customise.")
            @("What if the client wants to use my work in additional contexts after the project?","Additional usage beyond the original license typically requires a new agreement and additional compensation. Your contract should address this by specifying the scope of the original license and how expanded usage will be handled.")
            @("Is this creative contract template free?","Yes. ContractFixPro provides this $name template at no cost. Download, customise the details for your specific project, and use it as the foundation for your client agreement.")
        )}
        'service' { return @(
            @("What is a service agreement?","A service agreement is a contract between a service provider and a client that defines the scope of services, compensation, timeline, and other terms governing the business relationship. It protects both parties by documenting their mutual obligations.")
            @("How is a service agreement different from a freelance contract?","Service agreements are broader and often used for ongoing or retainer-based relationships, while freelance contracts typically cover project-specific work. Our $name template is appropriate for both ongoing and project-based service arrangements.")
            @("What happens if I need to change the scope of services?","Your contract should include a change order provision specifying how scope changes are documented, approved, and priced. The $name template includes this provision, allowing you to professionally manage scope changes without disrupting the client relationship.")
            @("Should a service agreement have a fixed end date?","This depends on the nature of your service. Project-based services have a natural end date. Ongoing services (like retainers or maintenance contracts) often use auto-renewing terms with a specified notice period for termination. The $name template accommodates both structures.")
            @("Is this service agreement template free to use?","Yes. ContractFixPro provides this $name template at no cost. Customise it for your specific service offering and use it as the foundation for your client agreements.")
        )}
        'writing' { return @(
            @("Does a writing contract need to specify word count?","Yes, for projects where length is relevant (blog posts, articles, copywriting), specifying word count or page count prevents disputes about whether the agreed scope was met. The $name template includes a deliverables section for specifying content scope precisely.")
            @("How should revisions be handled in a writing contract?","Specify the number of revision rounds included in your fee, how quickly the client must provide feedback, and how additional revisions beyond the included rounds will be billed. The $name template includes a detailed revision policy section.")
            @("Who owns the content after delivery and payment?","Your contract should specify intellectual property transfer terms. Typically, ownership transfers to the client upon full payment, while the writer retains the right to include the work in a portfolio unless restricted by a confidentiality clause.")
            @("What is a kill fee for writing projects?","A kill fee compensates a writer when a client cancels a project after work has begun. Typically 25-50% of the total project fee, the kill fee is triggered when a client cancels after an agreed milestone or after a specified amount of work has been completed.")
            @("Can I use client work as writing samples?","This depends on your contract terms. Many writers include a portfolio rights clause allowing them to display completed work. Some clients require confidentiality. The $name template lets you specify portfolio rights clearly in your agreement.")
        )}
        default { return @(
            @("Is a signed business contract legally binding?","Yes. A signed contract between parties with legal capacity, covering an exchange of value, and meeting basic formation requirements is legally binding and enforceable in civil court.")
            @("Do I need a lawyer to create a business contract?","For straightforward business relationships, a well-drafted template like our $name provides a solid foundation. For high-value, complex, or unusual arrangements, having a qualified attorney review your contract is recommended.")
            @("What should every business contract include?","Every business contract should identify all parties, describe the exchange (services, payment, deliverables), specify timelines, address intellectual property if relevant, include termination conditions, and specify how disputes will be resolved.")
            @("How do I make a contract official?","A contract is official when all parties have signed it. Digital signatures are legally valid in most jurisdictions under laws such as the US ESIGN Act and EU eIDAS regulation. Keep a copy of the signed agreement for your records.")
            @("Is this contract template free?","Yes. ContractFixPro provides this $name template at no cost. Download and customise it for your specific business relationship and use it as the foundation for your formal agreement.")
        )}
    }
    $items = ''
    foreach ($pair in $qa) {
        $items += "`n  <div class=`"faq-item`">`n    <div class=`"faq-q`">$($pair[0])</div>`n    <div class=`"faq-a`">$($pair[1])</div>`n  </div>"
    }
    return $items
}

# ── Extra related cards ───────────────────────────────────────────────────────
$AllLinks = @(
    @('/freelance-contract.html','Freelance Contract'),
    @('/consulting-agreement.html','Consulting Agreement'),
    @('/nda-generator.html','NDA Generator'),
    @('/service-agreement.html','Service Agreement'),
    @('/independent-contractor.html','Independent Contractor'),
    @('/web-design-contract.html','Web Design Contract'),
    @('/graphic-design-contract.html','Graphic Design Contract'),
    @('/photography-contract.html','Photography Contract'),
    @('/copywriting-contract.html','Copywriting Contract'),
    @('/social-media-contract.html','Social Media Contract')
)

function Get-ExtraCards([string]$slug) {
    $cards = @()
    foreach ($link in $AllLinks) {
        $linkSlug = [System.IO.Path]::GetFileNameWithoutExtension($link[0]) + '.html'
        if ($linkSlug -ne ($slug + '.html') -and $cards.Count -lt 3) {
            $cards += "<a href=`"$($link[0])`" class=`"related-card`"><div class=`"related-card-name`">$($link[1])</div><div class=`"related-card-desc`">Free template</div></a>"
        }
    }
    return $cards -join "`n"
}

# ── Process one file ──────────────────────────────────────────────────────────
function Process-File([System.IO.FileInfo]$file) {
    $slug    = $file.BaseName
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)

    if ($content.Contains('<!-- cf-seo-expanded -->')) {
        Write-Host "  SKIP $slug"
        return
    }

    $m = [regex]::Match($content, '<h1[^>]*>([^<]+)</h1>')
    $toolName = if ($m.Success) { $m.Groups[1].Value.Trim() } else { ($slug -replace '-',' ') }

    # 1. Inject SEO CSS if not present
    if (-not $content.Contains('seo-section{')) {
        $content = $content.Replace('@media print{', "$SeoCss`n@media print{")
        if (-not $content.Contains('seo-section{')) {
            $content = $content.Replace('</style>', "$SeoCss`n</style>")
        }
    }

    # 2. Build SEO block
    $seoHtml = "<!-- cf-seo-expanded -->`n<div class=`"seo-section`">`n  <h2>About $toolName</h2>`n  " + (Get-Seo $toolName $slug).Trim().Replace("`n","<br>`n  ").Replace("  <br>","") + "`n</div>`n"

    # 3. Insert SEO before faq-section
    $faqMarker = '<div class="faq-section">'
    $fi = $content.IndexOf($faqMarker)
    if ($fi -ge 0) {
        $content = $content.Substring(0, $fi) + $seoHtml + $content.Substring($fi)
    }

    # 4. Replace FAQ content with 5 targeted Q&As
    $fi2 = $content.IndexOf($faqMarker)
    if ($fi2 -ge 0) {
        $faqH2End = $content.IndexOf('</h2>', $fi2) + 5
        $faqClose = $content.IndexOf('</div>', $fi2)
        # Find true close of faq-section by tracking depth
        $depth = 1
        $pos = $fi2 + $faqMarker.Length
        while ($pos -lt $content.Length -and $depth -gt 0) {
            $nOpen  = $content.IndexOf('<div', $pos)
            $nClose = $content.IndexOf('</div>', $pos)
            if ($nClose -lt 0) { break }
            if ($nOpen -ge 0 -and $nOpen -lt $nClose) { $depth++; $pos = $nOpen + 4 }
            else { $depth--; if ($depth -eq 0) { $faqClose = $nClose } else { $pos = $nClose + 6 } }
        }
        $newFaqItems = Get-FaqItems $toolName $slug
        $before = $content.Substring(0, $faqH2End)
        $after  = $content.Substring($faqClose)
        $content = $before + $newFaqItems + "`n" + $after
    }

    # 5. Add 3 extra related cards to related-grid
    $relGridMarker = '<div class="related-grid">'
    $gi = $content.IndexOf($relGridMarker)
    if ($gi -ge 0) {
        $depth = 1; $pos = $gi + $relGridMarker.Length; $gClose = -1
        while ($pos -lt $content.Length -and $depth -gt 0) {
            $nOpen  = $content.IndexOf('<div', $pos)
            $nClose = $content.IndexOf('</div>', $pos)
            if ($nClose -lt 0) { break }
            if ($nOpen -ge 0 -and $nOpen -lt $nClose) { $depth++; $pos = $nOpen + 4 }
            else { $depth--; if ($depth -eq 0) { $gClose = $nClose } else { $pos = $nClose + 6 } }
        }
        if ($gClose -ge 0) {
            $extra = Get-ExtraCards $slug
            $content = $content.Substring(0, $gClose) + "`n" + $extra + "`n" + $content.Substring($gClose)
        }
    }

    [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  OK  $slug"
}

# ── Run all files (single batch) ──────────────────────────────────────────────
Write-Host "`n=== Processing all $($allFiles.Count) ContractFixPro tool files ==="
foreach ($file in $allFiles) { Process-File $file }

Write-Host "`nAll done — committing..."
Set-Location $siteDir
git add *.html
git commit -m "SEO: add seo-section + refresh FAQ 5qa + extra links for all 20 contract templates"
git -c http.proxy=http://127.0.0.1:7897 -c http.sslVerify=false push origin master
Write-Host "ContractFixPro pushed."
