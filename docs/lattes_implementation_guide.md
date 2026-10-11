# Lattes CV Editor — Implementation Guide

Audience: the coding agent that builds the first version.
Date: 2026-10-10
Companion documents, attach them with this guide:

| File                              | What it holds                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `lattes_product_requirements.md`  | Why the product exists, user research, competitive and legal analysis, product strategy                               |
| `lattes_editor_reconnaissance.md` | How the Lattes editor works inside: stack, menu catalogue, form field maps, save mechanics, import behavior as tested |
| `lattes_schema_analysis.xlsx`     | Element and attribute inventories from DTD (2014), XSD (2022) and real exports; ghost fields                          |
| `lattes_maximal_skeleton.xml`     | Every element and attribute the schema allows, with enum values in comments; the UI field map                         |
| `CurriculoLattes_12_09_2022.xsd`  | Primary schema (CNPq, Extrator Lattes page)                                                                           |
| `LMPLCurriculo.DTD`               | Secondary schema (CNPq, Import dialog link), version 4.0 of 2014, with changelog comments                             |
| A real export `CV_<id>.zip`       | Private fixture. Never commit it.                                                                                     |

Read the reconnaissance report before touching the exporter. Section 5.1 there is the contract the exporter has to honor.

---

## 1. Decisions already made

| Topic                                | Decision                                                                                                                                         | Reason                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Product shape                        | Local-first web app. Loads a Lattes XML export, edits it, writes XML the Lattes import accepts. No backend, no accounts, no server-side storage. | FOSS, single maintainer, personal data (CPF, RG, birth date, parents' names) never leaves the machine |
| Write path for production            | XML export from the app, imported by the user through Lattes' own Importar dialog                                                                | Tested on 2026-10-10 with a hand-built item; it works                                                 |
| Write path for biographical sections | Out of scope for v1. A browser bridge is phase 3, after the editor exists.                                                                       | Import ignores Dados Gerais, Formação, Atuação, Idiomas, Endereço                                     |
| Users                                | Rafael and his first-year master's cohort at Unisinos                                                                                            | No monetization, no institutional features                                                            |
| Language                             | UI in pt-BR, with Lattes' own section names so users recognize them                                                                              | Users switch between the app and Lattes                                                               |
| License                              | MIT                                                                                                                                              | Simplest for a personal FOSS tool. Switch to AGPL only if hosting by third parties becomes a concern. |
| Legal posture                        | The app never touches Lattes. The user exports, edits, imports.                                                                                  | Avoids the 2022 Portaria's anti-automation clause and the commercial-use clause entirely              |

Not decided, pick the default unless Rafael objects:

| Topic       | Default                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stack       | Vite, TypeScript, React, no UI framework beyond a small component set, CSS with design tokens. Rafael is a front-end engineer and will review the UI himself.            |
| Persistence | IndexedDB (Dexie) for the working copy and autosave history, plus explicit "Salvar arquivo" to disk. The uploaded export is the source; the app never edits it in place. |
| Hosting     | Static, GitHub Pages. The app must work from `file://` or any static host with no configuration.                                                                         |
| Tests       | Vitest for units, Playwright for a few flows, `xmllint --schema` in CI for every generated XML fixture                                                                   |

## 2. The data model

### 2.1 Source of truth

The 2022 XSD, patched with six attributes that current exports carry and the XSD lacks:

| Element                                               | Attribute                                             |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `DADOS-GERAIS`                                        | `PCD`                                                 |
| `ENDERECO`                                            | `REDE-SOCIAL`, `ELETRONICO`, `OUTRA-FORMA-DE-CONTATO` |
| `MESTRADO` (and presumably the other degree elements) | `ID-OASIS`, `STATUS-OASISBR`                          |

Keep the patched schema in the repo as `schema/CurriculoLattes_2022_patched.xsd`, generated from the original by a script, with the diff visible. Validate every generated XML against the patched version in CI. Expect CNPq to add more attributes over time; the parser must never drop an unknown attribute or element (see 2.4).

### 2.2 Generate the model, do not hand-write it

A build-time script reads the XSD and emits `src/schema/lattes.json`: for each of the 324 elements, its children with cardinality, its attributes with required flag, enum values and defaults. From that JSON, emit TypeScript types. Forms for the long tail of sections render from this JSON. Hand-designed forms are reserved for the sections people use weekly (section 4).

Facts about the schema that the generator must respect:

- Data lives in attributes. Elements are mostly empty or contain only child elements. Three elements carry text content (`DISCIPLINA`, `INTEGRANTES-DO-PROJETO`, `TREINAMENTO`).
- Child order is a sequence, not a bag. `PRODUCAO-BIBLIOGRAFICA` children must appear in the order TRABALHOS-EM-EVENTOS, ARTIGOS-PUBLICADOS, LIVROS-E-CAPITULOS, TEXTOS-EM-JORNAIS-OU-REVISTAS, DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA, ARTIGOS-ACEITOS-PARA-PUBLICACAO. Same for every container. The serializer orders children from the schema, never from insertion order.
- 251 enumerated types with 1,086 values. Enum values are UPPER_SNAKE (`CONCLUIDO`, `MEIO_DIGITAL`, `CIENCIAS_SOCIAIS_APLICADAS`). The UI shows pt-BR labels and stores the enum.
- Dates: `DDMMAAAA` strings in DADOS-GERAIS (`DATA-NASCIMENTO="15031990"`), four-digit year strings elsewhere, two-digit month strings. Never emit ISO dates.
- Every production item has `SEQUENCIA-PRODUCAO` (section 3.2). Every list item has its own `SEQUENCIA-*` attribute in the biographical sections (`SEQUENCIA-FORMACAO`, `SEQUENCIA-ATIVIDADE` and so on).
- Authors are repeated `AUTORES` elements with `NOME-COMPLETO-DO-AUTOR`, `NOME-PARA-CITACAO`, `ORDEM-DE-AUTORIA`, `NRO-ID-CNPQ`. The CV owner's own `NRO-ID-CNPQ` is the 16-digit `NUMERO-IDENTIFICADOR` from the root.

### 2.3 Encoding

Exports are `ISO-8859-1` and declare it. The browser's `TextEncoder` only produces UTF-8, so the serializer needs its own Latin-1 writer: code points 0 to 255 become single bytes, anything above 255 becomes a numeric character reference (`&#x2014;`), which is valid XML in a Latin-1 document. Read with `TextDecoder("iso-8859-1")`. Keep the `standalone="no"` declaration as exported.

### 2.4 Round-trip fidelity

The parser keeps every attribute and element it sees, known or unknown, and the serializer writes them back. A load followed by an immediate save must produce a file whose only differences from the original are attribute order and whitespace. Add a CI test that round-trips the synthetic fixture and diffs a canonicalized form of both files.

### 2.5 Fixtures

- `fixtures/synthetic_full.xml`: generated from `lattes_maximal_skeleton.xml` with fake values for every attribute. Committed. Used for round-trip, validation and form-rendering tests.
- `fixtures/synthetic_minimal.xml`: DADOS-GERAIS with the few attributes a real export always carries, plus one item in each importable section. Committed.
- Rafael's real export: `.gitignore`d, used locally only.

## 3. The import contract

Everything in this section was observed on the live platform on 2026-10-10. The reconnaissance report has the evidence.

### 3.1 What Lattes accepts

| Rule         | Detail                                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File type    | Bare `.xml`. The ZIP that Lattes' own Exportar produces is refused. The app unzips on load and writes `.xml` on export.                                                                                                          |
| Root         | `CURRICULO-VITAE` with `SISTEMA-ORIGEM-XML="LATTES_OFFLINE"`, `NUMERO-IDENTIFICADOR`, `DATA-ATUALIZACAO` (DDMMAAAA), `HORA-ATUALIZACAO` (HHMMSS). Copy the identifier from the loaded export. Stamp the date and time at export. |
| Flow         | Passo 1 upload, Passo 2 module checkboxes (all pre-checked by default, with a "a partir de" year filter), Passo 3 item list with green (new) and red (already in the CV) markers, all pre-checked, then Confirmar.               |
| Duplicates   | Confirming a red item inserts a duplicate. There is no update-in-place and no delete through import.                                                                                                                             |
| Matching key | `SEQUENCIA-PRODUCAO`.                                                                                                                                                                                                            |

### 3.2 Sequence numbers

`SEQUENCIA-PRODUCAO` is one global counter across every production type in the CV (bibliographic, technical, artistic, events, bancas, orientações). Observed behavior:

| Value on a new item                      | Result                     |
| ---------------------------------------- | -------------------------- |
| A number above the highest in the export | Accepted                   |
| A number missing from the export (a gap) | Silently dropped, no error |
| Attribute omitted                        | Silently dropped, no error |

Gaps are occupied by deleted or hidden rows on the server. Therefore:

- On load, compute `maxSeq` over every `SEQUENCIA-PRODUCAO` in the file.
- Each new item gets `maxSeq + n`, assigned once and stored with the item. Never renumber, never reuse, never omit.
- Persist the counter in IndexedDB alongside the document, so items created across sessions keep increasing.
- After the user imports and re-exports from Lattes, reload the new export; the server's numbering wins from then on.

Open question to settle with a test early (section 7): how large a number is accepted. Only `max + 1` has been verified.

### 3.3 What goes into the import file

Two options; the first is untested and must be tested before the exporter is designed around it:

1. Minimal file: root, a `DADOS-GERAIS` with `NOME-COMPLETO` and `NOME-EM-CITACOES-BIBLIOGRAFICAS`, and only the new items inside their containers. If Lattes accepts this, Passo 3 shows only green items and the user cannot duplicate anything by accident.
2. Full file: the whole CV with new items added. Verified to work, but Passo 3 then lists every existing item in red and pre-checked, and the user must uncheck them one by one.

Test option 1 first. If it fails, ship option 2 with the loudest possible instruction on screen: "Em Passo 3, desmarque os itens vermelhos."

### 3.4 Importable sections and their XML containers

The 17 checkboxes in Passo 2 and where each one reads from:

| Passo 2 checkbox                         | XML container                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artigos completos publicados             | `PRODUCAO-BIBLIOGRAFICA/ARTIGOS-PUBLICADOS/ARTIGO-PUBLICADO`                                                                                                                    |
| Artigos aceitos para publicação          | `PRODUCAO-BIBLIOGRAFICA/ARTIGOS-ACEITOS-PARA-PUBLICACAO/ARTIGO-ACEITO-PARA-PUBLICACAO`                                                                                          |
| Livros e capítulos                       | `PRODUCAO-BIBLIOGRAFICA/LIVROS-E-CAPITULOS/LIVROS-PUBLICADOS-OU-ORGANIZADOS/LIVRO-PUBLICADO-OU-ORGANIZADO` and `.../CAPITULOS-DE-LIVROS-PUBLICADOS/CAPITULO-DE-LIVRO-PUBLICADO` |
| Trabalhos publicados em anais de eventos | `PRODUCAO-BIBLIOGRAFICA/TRABALHOS-EM-EVENTOS/TRABALHO-EM-EVENTOS`                                                                                                               |
| Texto em jornal ou revista               | `PRODUCAO-BIBLIOGRAFICA/TEXTOS-EM-JORNAIS-OU-REVISTAS/TEXTO-EM-JORNAL-OU-REVISTA`                                                                                               |
| Apresentação de Trabalho                 | `PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA/APRESENTACAO-DE-TRABALHO`                                                                                                    |
| Outras produções bibliográficas          | `PRODUCAO-BIBLIOGRAFICA/DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA/*`                                                                                                               |
| Softwares                                | `PRODUCAO-TECNICA/SOFTWARE`                                                                                                                                                     |
| Produtos                                 | `PRODUCAO-TECNICA/PRODUTO-TECNOLOGICO`                                                                                                                                          |
| Processos                                | `PRODUCAO-TECNICA/PROCESSOS-OU-TECNICAS`                                                                                                                                        |
| Trabalhos técnicos                       | `PRODUCAO-TECNICA/TRABALHO-TECNICO`                                                                                                                                             |
| Outras produções técnicas                | `PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA/*` (except Apresentação de Trabalho)                                                                                         |
| Produção artística/cultural              | `OUTRA-PRODUCAO/PRODUCAO-ARTISTICA-CULTURAL/*`                                                                                                                                  |
| Orientações e Supervisões                | `OUTRA-PRODUCAO/ORIENTACOES-CONCLUIDAS/*` and `DADOS-COMPLEMENTARES/ORIENTACOES-EM-ANDAMENTO/*`                                                                                 |
| Demais Trabalhos                         | `OUTRA-PRODUCAO/DEMAIS-TRABALHOS/DEMAIS-TRABALHOS`                                                                                                                              |
| Eventos                                  | `DADOS-COMPLEMENTARES/PARTICIPACAO-EM-EVENTOS-CONGRESSOS/*`                                                                                                                     |
| Bancas                                   | `DADOS-COMPLEMENTARES/PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO/*` and `.../PARTICIPACAO-EM-BANCA-JULGADORA/*`                                                                  |

Everything under `DADOS-GERAIS` is not importable. The app shows and edits those sections (they are needed for the formatted CV in phase 2) and labels them "não importável no Lattes", with a per-field "copiar" affordance so the user can paste into the Lattes form by hand.

### 3.5 A verified item

This exact shape was accepted on 2026-10-10. Use it as the template for the conference-paper exporter and as the first exporter test.

```xml
<TRABALHOS-EM-EVENTOS>
  <TRABALHO-EM-EVENTOS SEQUENCIA-PRODUCAO="33">
    <DADOS-BASICOS-DO-TRABALHO NATUREZA="COMPLETO" TITULO-DO-TRABALHO="…" ANO-DO-TRABALHO="2025"
      PAIS-DO-EVENTO="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="MEIO_DIGITAL" HOME-PAGE-DO-TRABALHO=""
      FLAG-RELEVANCIA="NAO" DOI="" TITULO-DO-TRABALHO-INGLES="" FLAG-DIVULGACAO-CIENTIFICA="NAO"/>
    <DETALHAMENTO-DO-TRABALHO CLASSIFICACAO-DO-EVENTO="NACIONAL" NOME-DO-EVENTO="…" CIDADE-DO-EVENTO="…"
      ANO-DE-REALIZACAO="2025" TITULO-DOS-ANAIS-OU-PROCEEDINGS="…" VOLUME="" FASCICULO="" SERIE=""
      PAGINA-INICIAL="1" PAGINA-FINAL="2" ISBN="" NOME-DA-EDITORA="" CIDADE-DA-EDITORA="" NOME-DO-EVENTO-INGLES=""/>
    <AUTORES NOME-COMPLETO-DO-AUTOR="…" NOME-PARA-CITACAO="…" ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ="…"/>
    <PALAVRAS-CHAVE PALAVRA-CHAVE-1="…" PALAVRA-CHAVE-2="" PALAVRA-CHAVE-3="" PALAVRA-CHAVE-4="" PALAVRA-CHAVE-5="" PALAVRA-CHAVE-6=""/>
    <AREAS-DO-CONHECIMENTO>
      <AREA-DO-CONHECIMENTO-1 NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_SOCIAIS_APLICADAS" NOME-DA-AREA-DO-CONHECIMENTO="Desenho Industrial" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE=""/>
    </AREAS-DO-CONHECIMENTO>
  </TRABALHO-EM-EVENTOS>
</TRABALHOS-EM-EVENTOS>
```

Empty attributes are written as empty strings, matching what Lattes itself exports. Do not omit them.

## 4. Scope by milestone

### Milestone 0: contract tests (half a day, done by hand with Rafael's account)

- [ ] Minimal file test (3.3, option 1)
- [ ] Large sequence test: one item with `SEQUENCIA-PRODUCAO = max + 1000`
- [ ] Second item type: one `ARTIGO-PUBLICADO` built from the XSD, to confirm the pattern holds beyond conference papers
- [ ] `DADOS-GERAIS` minimum: does the import need `CPF`, or is the name enough

The exporter's design depends on the first two answers. Build milestones 1 and 2 in parallel with these tests; they only affect the export module.

### Milestone 1: load, view, save (the read path)

- [ ] Drop zone accepting `.zip` or `.xml`; unzip in the browser; decode Latin-1; parse to the model
- [ ] Section navigation mirroring Lattes' top menu: Dados gerais, Formação, Atuação, Projetos, Produções, Patentes e Registros, Inovação, Educação e Popularização de C&T, Eventos, Orientações, Bancas
- [ ] Read-only rendering of every section from the schema JSON, with pt-BR labels for element and attribute names (a labels file, hand-maintained for the common sections, falling back to a humanized attribute name)
- [ ] Autosave of the working copy to IndexedDB on every change, with a visible "salvo" indicator and a history of the last 50 states
- [ ] "Salvar arquivo" writing the full CV as `.xml`, byte-for-byte compatible with the original except for the edits
- [ ] Round-trip CI test against both synthetic fixtures

Done when Rafael can load his export, browse every section, save, and diff the output against the input with no unexpected changes.

### Milestone 2: add production items (the write path)

- [x] Hand-designed forms for: Trabalhos publicados em anais de eventos, Artigos completos publicados, Apresentação de trabalho, Participação em eventos, Livros e capítulos. These are the five a master's student touches.
- [x] Generic schema-driven form for every other importable section
- [x] Sequence-number assignment per 3.2
- [x] Author management: a per-document list of co-authors (name, citation name, `NRO-ID-CNPQ`) reused across items; the owner is author 1 by default
- [ ] DOI lookup against Crossref (`api.crossref.org/works/{doi}`, CORS enabled, send a `mailto` parameter) mapping title, authors, year, journal, volume, issue, pages, ISSN, DOI, language into the article form; the user reviews before saving
- [x] "Gerar XML para importação" producing the file described in 3.3, plus an on-screen checklist of the Lattes steps: Importar, escolher o arquivo, marcar só os módulos listados aqui, conferir os itens verdes, Confirmar, e nunca marcar itens vermelhos
- [x] A "novos itens" badge per section so the user knows what the next import will carry
- [x] After the user re-imports and exports from Lattes, "Recarregar do Lattes" replaces the working copy and clears the new-item markers
- [ ] Manual path for the non-importable sections (Dados gerais, Formação, Atuação, Projetos, Patentes e Registros), added 2026-10-10:
  - A per-field "copiar" button, so the user can paste a value into the matching Lattes form.
  - A "Alterações a levar ao Lattes" list: every field and item that differs from the loaded export, grouped by Lattes section and form, with old and new values. It is computed from `originalXml` against the working copy, items are matched by their `SEQUENCIA-*` key, and the user marks entries as done.
  - The list is a data structure first and a screen second. It is the input the phase 3 browser bridge will consume, so the bridge only automates what this list already describes.

Status on 2026-10-11, with the milestone 0 tests skipped on purpose:

- The import file is option 2 of 3.3 (whole CV plus new items), the only verified shape. The on-screen steps tell the user to uncheck the red items in Passo 3. Switch to option 1 only after the minimal-file test passes.
- Sequence numbers are spent on save, never on opening a form, so a cancelled draft leaves no gap. Removing a saved new item before import does leave a gap between new numbers (for example 33 removed, 34 kept). Whether Lattes accepts 34 when its own maximum is 32 is the same open question as the max + 1000 test.
- New items mirror the structure Lattes exports: basic data and detail with every attribute, authors without CPF, and optional extras (keywords, knowledge areas, sectors, additional info) only when filled. Knowledge areas cannot be edited in the forms yet.
- `FLAG-*` attributes start as `NAO`, like an unchecked box in the Lattes form. Other enumerated attributes start empty and block the export until chosen, because Lattes drops invalid items without a message. Part of the milestone 3 validation panel exists for this reason (`src/model/validate.ts`).
- Labels in the forms are still generated from the XML names, not taken from the Lattes forms.

Done when Rafael adds a conference paper in the app, imports it into Lattes, re-exports, reloads, and the app shows no pending items. For the manual path, done when an edit to an Atuação row shows up in the list with its old and new values, can be copied field by field, and drops off the list after "Recarregar do Lattes" brings back an export that matches.

### Milestone 3: polish for the cohort

- [ ] First-run screen in pt-BR explaining the loop (exportar no Lattes, editar aqui, importar no Lattes) with the two screenshots of the Lattes dialogs
- [ ] Validation panel: required attributes missing, enum values invalid, years out of range, items with no author, DOI format
- [ ] Deployed to GitHub Pages with a README in pt-BR and English

## 5. Later phases, not in v1

| Phase          | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Precondition                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Formatted CV   | Print stylesheet rendering the loaded CV in a clean layout, ABNT citation style, browser print to PDF. Lattes' own print dialog (`pkg_impcv.form`) is the reference for what a "Completo" CV contains.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Milestone 1                                                         |
| LLM extraction | Paste a BibTeX, an ORCID export, a Google Scholar page or a résumé; the model maps it onto schema items for review. Bring-your-own-key, calls from the browser, nothing stored.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Milestone 2                                                         |
| ORCID import   | `pub.orcid.org/v3.0/{orcid}/works`, public, CORS enabled. Map works to articles and conference papers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Milestone 2                                                         |
| Browser bridge | Userscript or extension that fills the biographical forms from the app's data. Field maps for Atuação and Formação are in the reconnaissance report (section 4); saves are plain POSTs with no CSRF token; the institution lookup is a POST to `PRC_INST_FORM`. Must override `window.alert` and `window.confirm` inside the form iframe, and must detect the `pkg_sec.logon` stub in responses because the server session is short-lived. Its input is the "Alterações a levar ao Lattes" list from milestone 2. Open before building: whether `f_ctr=A` updates a row in place (untested), and field maps for Idiomas, Resumo and Endereço. | Milestone 3, and a decision by Rafael on whether he wants it at all |

## 6. Things that will bite

- Lattes drops items silently. Any mistake in sequence numbers, element order or container placement produces an empty Passo 3 with no error. The validation panel and the CI schema check exist to catch this before the user uploads.
- `SEQUENCIA-PRODUCAO` is global, not per section. Two new items in different sections still need different numbers.
- Passo 2 and Passo 3 pre-check everything. The import instructions on screen matter as much as the file.
- The XSD lags reality. Six attributes exist in exports and not in the schema; more will appear. Unknown attributes are preserved, never rejected.
- Personal data in `DADOS-GERAIS`: CPF, RG with issuing body and date, birth date and place, parents' names, passport number. The app never sends the document anywhere, never logs it, never puts it in a URL, and the DOI and ORCID lookups send only the DOI or ORCID iD. Any future "share" feature strips `DADOS-GERAIS` down to name and Lattes ID.
- The export ZIP contains one XML named `<NUMERO-IDENTIFICADOR>.xml`. Keep that name on save so the user recognizes the file.
- Enum labels: the UI must not show `NAO_INFORMADO` or `MEIO_DIGITAL` raw. Maintain a label map; the Lattes forms themselves are the source for the pt-BR wording.
- The DTD and XSD disagree on a few element names in the technical production module (`TITULARES`, old patent codes). Follow the XSD; export files from 2026 agree with it.

## 7. Repository layout

```
lattes-editor/
  schema/
    CurriculoLattes_12_09_2022.xsd        original, untouched
    CurriculoLattes_2022_patched.xsd      generated: original + ghost attributes
    LMPLCurriculo.DTD                      reference only
    patch.json                             the six attributes to add
  scripts/
    gen-schema.ts                          XSD -> src/schema/lattes.json + types
    gen-fixtures.ts                        skeleton -> fixtures/synthetic_*.xml
  src/
    schema/                                generated JSON and types
    model/                                 parse, serialize (Latin-1), sequence counter, diff
    import-export/                         zip handling, import-file builder, Lattes step checklist
    forms/                                 hand-designed forms + generic schema form
    lookups/                               crossref, orcid
    ui/                                    shell, navigation, validation panel
    labels/pt-BR.json                      element, attribute and enum labels
  fixtures/
    synthetic_full.xml
    synthetic_minimal.xml
  docs/
    lattes_product_requirements.md
    lattes_editor_reconnaissance.md
    lattes_implementation_guide.md        this file
```

## 8. Definition of done for v1

- [ ] Rafael's export loads, every section renders, save round-trips cleanly
- [ ] A conference paper and a journal article added in the app import into Lattes without manual edits to the file
- [ ] CI validates every generated fixture against the patched XSD and round-trips both synthetic fixtures
- [ ] No network call carries anything beyond a DOI or an ORCID iD
- [ ] Two cohort colleagues complete the loop with their own CVs using only the on-screen instructions
