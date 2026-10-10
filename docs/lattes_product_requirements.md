# Lattes CV Editor — Product Requirements & Research Summary

## What This Document Is

This is a summary of extensive UX research, competitive analysis, legal analysis, and technical schema analysis conducted across multiple research sessions about Brazil's Plataforma Lattes. The goal is to inform the development of a product (working name: "Model B") — a modern CV editor that exports valid Lattes XML, allowing researchers to manage their academic production outside of Lattes and import it via Lattes' built-in XML import feature.

Two files accompany this document and should be referenced throughout:

- `lattes_schema_analysis.xlsx` — Four-sheet workbook: Schema Comparison (DTD vs XSD vs XML), Full Element Inventory (324 elements), Full Attribute Inventory (1,927 attribute slots with types/enums/required flags), and Post-2022 Ghost Fields analysis
- `lattes_maximal_skeleton.xml` — A 4,495-line XML file containing every possible element and attribute from the Lattes schema, annotated with `[REQUIRED]` markers and enum values in comments. This is the UI specification — every element maps to a form section, every attribute to a form field, every enum to a dropdown.

---

## 1. Platform Background

### What Lattes Is

Plataforma Lattes is Brazil's national academic CV system, operated by CNPq (Conselho Nacional de Desenvolvimento Científico e Tecnológico). It was launched in 1999 and has over 6.5 million registered CVs. It is mandatory for virtually all academic activity in Brazil: grant applications, graduate program enrollment, faculty hiring, research group registration, and institutional evaluation all require a Lattes CV.

The platform has no real competitor in Brazil because it is government-mandated. Researchers cannot choose an alternative — they must use Lattes regardless of its quality.

### Why It Matters

Because Lattes is mandatory, its UX problems don't cause users to leave (they can't), but instead create massive frustration, wasted time, lost data, and administrative burden across the entire Brazilian research ecosystem. This is a captive audience of millions of highly educated users with no alternatives.

---

## 2. UX Problems — What We Found

### Academic Usability Study

A formal usability study (academic paper) tested Lattes with real users and found a **0% success rate** on the task of recording a published article. No participant was able to complete this core task without errors or getting stuck. Key issues identified:

- False completion signals — the system appears to save when it hasn't
- Confusing form hierarchy with deeply nested, non-obvious navigation
- No auto-save — data loss on timeout, accidental navigation, or session expiry
- No inline validation or progress indicators
- Ambiguous field labels and inconsistent terminology
- No undo/redo capability

### Reclame Aqui Complaint Analysis (551 complaints)

We analyzed 551 pages of complaints on Reclame Aqui (Brazil's main consumer complaint platform). The complaints break down into these categories:

| Category                                              | % of Complaints | Description                                                                                                                                     |
| ----------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration / RFB Validation                         | ~30%            | Users blocked after 3 failed CPF validation attempts with no self-service unblock. Must email CNPq and wait days/weeks.                         |
| Authentication                                        | ~25%            | Password recovery failures, email not recognized, locked accounts, broken CAPTCHA.                                                              |
| Publishing Delay                                      | ~15%            | After submitting CV changes, they take days to weeks to appear on the public profile. Users describe this as "aguardando publicação" purgatory. |
| Performance / Instability                             | ~12%            | Timeouts, blank screens, server errors. A 2+ week full outage occurred in 2021. SSL certificate errors.                                         |
| Data Loss                                             | ~8%             | Users report hours of work lost due to session timeouts, failed saves, or unexplained data disappearance.                                       |
| Other (UI confusion, missing features, accessibility) | ~10%            | Various UX issues, lack of mobile support, no accessibility compliance.                                                                         |

### Developer Ecosystem (Workaround Tools)

The frustration has spawned an ecosystem of 20+ third-party tools that researchers and institutions have built to work around Lattes' limitations. These include:

- **scriptLattes** — Python tool that scrapes Lattes HTML to generate research group reports, citation analysis, collaboration networks. Used by major Brazilian universities.
- **SLattes** — Converts Lattes XML exports to other formats (BibTeX, MODS) using XSLT. Maintains an updated version of the DTD that CNPq stopped updating.
- **Escavador.com** — Commercial platform that scrapes and indexes public Lattes profiles, providing a modern search interface over Lattes data.
- **getLattes** — R package for extracting and analyzing Lattes XML data.
- **Lattes Extractor** — Various tools for bulk data extraction.
- Multiple institutional tools built by individual universities for internal reporting.

The existence of this ecosystem confirms the market need — people are already building around Lattes' deficiencies.

---

## 3. Competitive Analysis

### Platforms Analyzed

We compared Lattes against four international academic profile platforms across 30+ dimensions. A detailed spreadsheet was produced in a prior session (`lattes_competitive_analysis.xlsx` — not attached here but findings are summarized).

**ORCID** — Open, nonprofit. Full REST API with 1,800+ member organizations. "Search & Link" publication import from Crossref, Scopus, Web of Science. Per-field privacy controls (Everyone / Trusted Organizations / Only Me). Trusted Organizations model for institutional data management. 2-minute signup with standard OAuth2.

**Ciência Vitae** — Portugal's national academic CV platform, the most directly relevant comparator. It replaced DeGóis, which was itself derived from Lattes. Their redesign was driven by a government mandate of "More Science, Less Bureaucracy." Key features: Import Wizard that pulls publications from 5+ external sources, customizable CV export templates, modern responsive UI. They prove a government-mandated platform CAN have good UX.

**Academia.edu** — Best-in-class visual design among academic platforms. Inline editing with instant auto-save. Profile analytics dashboard (views, downloads, geographic data). Native mobile apps. Freemium model.

**ResearchGate** — Co-author network visualization, metrics dashboard, DOI-based publication import pipeline, Q&A forum for researchers.

### Lattes Scorecard

Across 18 rated dimensions on a 1-5 scale:

- Lattes average: **1.1**
- Competitors cluster: **3.5–4.5**

Lattes scored 1 (lowest) on nearly every dimension except "data completeness" where its mandatory nature ensures comprehensive coverage.

### Key Lessons to Steal

- From ORCID: "Search & Link" import workflow, per-field privacy controls, Trusted Organizations model
- From Ciência Vitae: Import Wizard from multiple sources, customizable export templates, the political framing of "less bureaucracy"
- From Academia.edu: Inline editing with instant save, profile analytics, mobile-first design
- From ResearchGate: DOI-based import pipeline, co-author network visualization

---

## 4. Legal Analysis

### How Escavador.com Operates

Escavador is a commercial platform that displays Lattes data. Their legal strategy rests on three pillars:

1. **Public data doctrine** — They frame themselves as an indexer of publicly available data, citing Brazil's LGPD, Lei de Acesso à Informação, and Código de Processo Civil. Researchers voluntarily made their profiles public.
2. **Scrapes public HTML, not the official API** — CNPq has two data channels with different rules. The "Extrator Lattes" (official bulk API) requires institutional accreditation, a signed Termo de Responsabilidade, and explicitly forbids commercial use. Public HTML profiles, however, are accessible by design — Escavador crawls these like a search engine would.
3. **Read-only, no modification** — They position as a search/viewing tool, never modifying Lattes data.

CNPq's 2022 Terms of Use (Portaria 976) added an anti-scraping clause prohibiting "robôs, spiders, scrapers" without express written permission, but enforceability against a third-party indexer who never agreed to these ToS is legally dubious under Brazilian law when the data is genuinely public.

### Legal Constraints for Our Product (Model B)

Building a tool that directly interacts with Lattes on behalf of users faces significant legal barriers:

- **ToS prohibition on commercial use**: "vedada a utilização do serviço para finalidades comerciais"
- **No OAuth / credential delegation**: Lattes has no OAuth. Passwords are "pessoal e intransferível" — accepting user credentials to act on their behalf would violate ToS.
- **Anti-automation clause**: The 2022 Portaria gives CNPq legal grounds to block automated access.
- **Active enforcement**: CNPq has added CAPTCHAs and other measures to block automated access.

### Product Model Options

| Model       | Description                                                           | Legal Risk                  | Viability               |
| ----------- | --------------------------------------------------------------------- | --------------------------- | ----------------------- |
| Model A     | Escavador-style read-only viewer of public profiles                   | Low                         | Proven by Escavador     |
| **Model B** | **CV editor that exports valid Lattes XML for manual import by user** | **Medium-Low**              | **Our chosen approach** |
| Model C     | Browser extension that enhances the Lattes web UI                     | Gray area                   | Technically fragile     |
| Model D     | Official CNPq partnership                                             | Lowest risk, highest effort | Long-term goal          |

**Model B is our chosen approach.** It never touches Lattes directly — users export XML from Lattes, edit in our tool, and import XML back into Lattes via Lattes' own import dialog. No credential delegation, no scraping, no API abuse.

---

## 5. The XML Import/Export System — Our Technical Foundation

### How Import Works

Lattes has a built-in XML import feature accessible from within a user's CV editing interface. The workflow is:

**Step 1 (Passo 1)**: Upload an XML file. The dialog states the file must conform to the DTD.

**Step 2 (Passo 2)**: Select which modules to import via checkboxes:

- Artigos completos publicados
- Artigos aceitos para publicação
- Livros e capítulos
- Trabalhos publicados em anais de eventos
- Texto em jornal ou revista
- Apresentação de Trabalho
- Outras produções bibliográficas
- Softwares, Produtos, Processos
- Trabalhos técnicos
- Outras produções técnicas
- Produção artística/cultural
- Orientações e Supervisões
- Demais Trabalhos
- Eventos
- Bancas

There is also a year filter ("Produção C&T a partir de" defaulting to 2007) for incremental updates.

Then the system shows: "Aguarde, o XML está sendo transferido..."

### Critical Import Characteristics

- **Import is APPEND, not replace** — The checkbox language "Selecione os ítens que deseja importar" and the category-level selection confirm it adds items rather than overwriting the entire CV.
- **Only covers production/activity data** — No checkboxes exist for DADOS-GERAIS (personal info), FORMACAO-ACADEMICA (education), ATUACOES-PROFISSIONAIS (employment), AREAS-DE-ATUACAO, or IDIOMAS. Import is designed for production sections only.
- **Year filter enables incremental updates** — Users can import only production from a specific year onward.
- **Covers the most painful sections** — The importable sections (publications, orientations, bancas, events) are exactly where Lattes UX is worst and where the usability study found 0% success rate.

### How Export Works

Users can export their complete CV as XML. The exported file contains everything — personal data, education, professional history, languages, awards, and all production. It is a full snapshot of the profile, not limited to the import-eligible sections.

The exported XML uses an attribute-heavy style where data lives in XML attributes rather than element text content. For example:
`<GRADUACAO NOME-CURSO="Design Gráfico" ANO-DE-CONCLUSAO="2004" STATUS-DO-CURSO="CONCLUIDO"/>`

### Product Implications

Our product handles the most painful, most voluminous sections (publications, presentations, technical production, bancas, orientations) with a beautiful editing UI, DOI auto-population, and ORCID import. We export valid XML that users import directly into Lattes via the Step 2 checkbox selection.

For biographical sections (personal data, education, professional history) not covered by import: we can offer a nice viewing/editing experience with a "copy to Lattes manually" workflow, but the real value proposition is in the importable production sections.

---

## 6. Schema Analysis — Three Sources, One Truth

### The Three Schema Sources

We discovered that three different schema sources exist for Lattes XML, each from a different era:

| Source                         | Format       | Last Updated                   | Where Found                                           |
| ------------------------------ | ------------ | ------------------------------ | ----------------------------------------------------- |
| LMPLCurriculo.DTD              | DTD          | Version 4.0, February 21, 2014 | Link in the XML Import dialog                         |
| CurriculoLattes_12_09_2022.xsd | XSD          | September 12, 2022             | Link on the "Extração de Dados" page of Portal Lattes |
| Actual XML export              | XML instance | ~2025 (whenever you export)    | Export button in CV editor                            |

### Key Comparison Findings

**Element-level**: DTD defines 323 elements. XSD defines 324 (added 3: LICENCA, LICENCAS, HISTORICO-SITUACOES-PATENTE for patent licensing; 2 removed). Structurally nearly identical across 10+ years.

**Attribute-level**: This is where the XSD shines. The XSD defines 1,927 attribute slots across all elements vs the DTD's ~386. The XSD has 251 typed enumerations with 1,086 valid values (things like STATUS-DO-CURSO can only be EM_ANDAMENTO, CONCLUIDO, or INCOMPLETO). The DTD has inline pipe-separated value lists but far fewer constrained fields.

**Elements with most attributes** (complexity indicators for UI form design):

- DOUTORADO: 35 attributes
- MESTRADO: 29 attributes
- GRADUACAO: 28 attributes
- DADOS-GERAIS: 27 attributes
- MESTRADO-PROFISSIONALIZANTE: 23 attributes
- PROJETO-DE-PESQUISA: 20 attributes

**Coverage gap**: A real user's XML export typically uses about 60 of 324 elements (depending on their career). The other 263 elements represent sections of academic life they haven't used (e.g., patents, artistic production, doctoral supervision, professional boards).

### Ghost Fields — Post-2022 Additions

Four attributes appear in a 2025 XML export that exist in NEITHER the DTD (2014) NOR the XSD (2022):

| Attribute              | Element      | Interpretation                                                                   |
| ---------------------- | ------------ | -------------------------------------------------------------------------------- |
| PCD                    | DADOS-GERAIS | Pessoa com Deficiência (disability field) — likely LGPD/accessibility compliance |
| REDE-SOCIAL            | ENDERECO     | Social media links                                                               |
| ELETRONICO             | ENDERECO     | Electronic contact info                                                          |
| OUTRA-FORMA-DE-CONTATO | ENDERECO     | Other contact methods                                                            |

One attribute (ORCID-ID on DADOS-GERAIS) is in the XSD but not the DTD, placing its addition between 2014 and 2022.

This confirms: CNPq's internal data model keeps evolving, the export keeps up, but the published schemas lag behind. The import validator must use an internal, unpublished schema that is newer than any public document.

### Which Schema to Use for Development

**Use the XSD (2022) as the primary specification.** It is typed, richer, 8 years newer than the DTD, and defines proper enumerations. Patch in the 4 ghost fields from the XML export. The maximal skeleton XML file (attached) was generated from this combined source.

The DTD remains useful as a secondary reference — its version history comments document the evolution of the schema from 2003 to 2014, and it defines the format that the import dialog explicitly references.

### DTD Version History

The DTD contains an extensive changelog in its XML comments:

- v1.1 (Mar 2003) through v1.4.2 (Apr 2004): Initial versions, basic structure
- v1.4.3 (Apr 2006): All fields outside DADOS-GERAIS made optional
- v1.4.4 (Jul 2006): Added TEXTO-RESUMO-CV-RH
- v1.5–2.0 (undated): DOI support, doctoral cotutela/sandwich, CAPES course codes
- v2.1–2.4.1 (undated): English translations of fields, patent module expansion, co-author IDs
- v3.0 (Dec 2011): Web as publication medium, social media types, science dissemination flags, innovation flags
- v4.0 (Feb 2014): Race/color field, ORCID groundwork, olimpíada/exposição/feira events

The SLattes project (third-party tool) maintains a reverse-engineered version of the DTD that patches some gaps, but our XSD from CNPq's own website is more authoritative and more current.

---

## 7. Product Strategy

### Core Value Proposition

A modern, beautiful CV editor for Brazilian researchers that eliminates the pain of managing academic production in Lattes. Users edit in our tool with a modern UI (auto-save, DOI auto-population, ORCID import, inline validation, progress indicators), then import the resulting XML into Lattes with a few clicks.

### What We Build (MVP Scope)

The import-eligible sections should be the MVP focus. These are:

1. **Bibliographic Production** (PRODUCAO-BIBLIOGRAFICA)
   - Published journal articles (ARTIGOS-PUBLICADOS)
   - Accepted articles (ARTIGOS-ACEITOS-PARA-PUBLICACAO)
   - Books and chapters (LIVROS-E-CAPITULOS)
   - Conference papers (TRABALHOS-EM-EVENTOS)
   - Newspaper/magazine texts (TEXTOS-EM-JORNAIS-OU-REVISTAS)
   - Other bibliographic production (DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA)

2. **Technical Production** (PRODUCAO-TECNICA)
   - Software (SOFTWARE)
   - Patents and related IP (PATENTE, CULTIVAR, DESENHO-INDUSTRIAL, MARCA, TOPOGRAFIA)
   - Technological products (PRODUTO-TECNOLOGICO)
   - Processes/techniques (PROCESSOS-OU-TECNICAS)
   - Technical work (TRABALHO-TECNICO)
   - Other technical production

3. **Other Production** (OUTRA-PRODUCAO)
   - Artistic/cultural production (PRODUCAO-ARTISTICA-CULTURAL)
   - Completed orientations/supervisions (ORIENTACOES-CONCLUIDAS)
   - Other works (DEMAIS-TRABALHOS)

4. **Complementary Data** (DADOS-COMPLEMENTARES)
   - Participation in examination boards / bancas (PARTICIPACAO-EM-BANCA)
   - Event participation (PARTICIPACAO-EM-EVENTOS-CONGRESSOS)
   - Ongoing orientations (ORIENTACOES-EM-ANDAMENTO)

### What We Show But Don't Import

For sections not covered by import (personal data, education, professional history, languages, areas of expertise, awards), we can:

- Display them beautifully from an imported XML export
- Allow editing with a "copy these changes to Lattes manually" workflow
- Use them for generating formatted CVs in PDF/DOCX (a secondary feature)

### Key Features to Prioritize

Based on the competitive analysis and complaint data:

- **DOI-based import**: Enter a DOI, auto-populate all publication fields from Crossref/DataCite
- **ORCID import**: Pull publications from user's ORCID profile
- **Auto-save with draft state**: Never lose work. Save continuously.
- **Inline validation against schema**: Show errors before export, not after a failed Lattes import
- **Progress indicators**: Show completion percentage per section
- **Batch operations**: Add multiple publications at once (e.g., paste a list of DOIs)
- **Formatted CV export**: Generate PDF/DOCX from the same data in standard academic CV formats (ABNT, international)
- **Co-author management**: Maintain a list of frequent co-authors with their NRO-ID-CNPQ for reuse

### Workflow

1. User exports XML from Lattes (full CV export)
2. User uploads XML to our tool
3. Our tool parses and displays all CV data in a modern interface
4. User edits/adds production items using our UI
5. Our tool exports valid Lattes-compatible XML
6. User imports XML into Lattes via Import dialog, selecting relevant checkboxes
7. Lattes appends the new items to their CV

### Revenue Model Considerations

The tool cannot interact with Lattes programmatically (legal constraints), so the value proposition must be strong enough that researchers pay for the editing experience itself. Potential angles:

- Freemium: Free for viewing/basic editing, paid for DOI auto-import, ORCID sync, batch operations, formatted CV export
- Institutional licensing: Universities pay for department-wide access
- The formatted CV export feature (generating ABN-standard CVs from Lattes data) may be a strong independent value proposition

---

## 8. Validation Steps Before Building

These tests should be performed manually before committing to development:

1. **Round-trip test**: Export CV XML from Lattes, make zero changes, import it back. Verify nothing breaks, no duplicates, no data loss.

2. **Modification test**: Export, change a single field (e.g., add a word to RESUMO-CV or add a dummy publication), import, verify the change appears correctly.

3. **Minimal XML test**: Create a tiny XML file with just one ARTIGO-PUBLICADO element and the minimum required wrapper structure. Import it. See if Lattes accepts it or requires the full CV structure.

4. **Schema validation test**: Does Lattes reject XML that contains the post-2022 ghost fields (PCD, REDE-SOCIAL, etc.)? If the round-trip test passes, this is answered — those fields are in the export, so they should survive import.

5. **Duplicate handling test**: Import the same publication twice. Does Lattes create duplicates, or does it detect and skip existing items? This determines whether our tool needs deduplication logic.

---

## 9. Open Questions

- What exactly does the import validator check? Does it validate against the DTD, the XSD, an internal schema, or is it permissive?
- How does Lattes handle duplicate detection on import? By title? By DOI? By some internal sequence number?
- What is the maximum XML file size the import accepts?
- Can the import dialog handle XML generated from scratch (not derived from an export), or does it expect certain internal IDs (like NUMERO-IDENTIFICADOR, SEQUENCIA-PRODUCAO) that only Lattes generates?
- Is the import feature available to all users, or only certain institutional roles?
- How frequently do users actually use the import feature today? (This tells us if the workflow is familiar or novel.)

---

## 10. Attached File Reference

### lattes_schema_analysis.xlsx

Four sheets:

**Sheet 1 — Schema Comparison**: Side-by-side comparison of DTD (2014) vs XSD (2022) vs your XML export (2025). Shows what each source defines, where they agree, and where they diverge.

**Sheet 2 — Element Inventory**: All 324+ elements with hierarchy paths, presence in each schema source, attribute counts, child elements, and category groupings. Filterable. Yellow highlights = elements not in your XML (sections you haven't used). Green = elements your profile uses.

**Sheet 3 — Attribute Inventory**: Every attribute across all elements with: required/optional status, data type or enum values, presence in DTD, presence in your XML, and a sample value from your export where available. This is the field-level specification for building forms.

**Sheet 4 — Post-2022 Ghost Fields**: The 4-6 attributes that exist in recent XML exports but not in any published schema. Includes risk assessment for each.

### lattes_maximal_skeleton.xml

A 4,495-line XML file that includes every element and attribute defined across all three schema sources. Annotated with:

- `[REQUIRED]` markers on mandatory attributes
- Enum values in XML comments (e.g., `<!-- SIM|NAO -->`)
- `<!-- optional -->` and `<!-- repeatable -->` markers on child elements
- Placeholder empty values for all attributes

This file serves as:

- A complete UI specification (every element = a form section, every attribute = a form field)
- A starting point for generating test XML files
- A reference for understanding the complete data model including sections no single profile would use
