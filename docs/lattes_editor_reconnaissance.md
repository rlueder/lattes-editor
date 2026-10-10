# Lattes CV Editor — Reconnaissance Report

Date: 2026-10-10
Method: Claude in Chrome driving a logged-in session in Rafael's own browser. Every action was open, read, close. No data was saved, deleted or published.
Scope reached: editor shell, menu catalogue, Atuação profissional (list and insert form), Formação acadêmica (list, level picker, insert form, institution lookup), Assistente de importação, Importação de produção, Imprimir dialog, Exportar and Importar entry points.
Not reached by the extension: XML import dialog DOM, Idiomas, Resumo, Endereço, Enviar dialog. Reason: the server session dropped four times within minutes (see section 7). The import itself was then tested by hand with generated files (section 5.1).

---

## 1. Stack

| Layer       | Finding                                                                                                                                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server      | Oracle PL/SQL web application. Every URL is `PKG_<module>.<procedure>` or `prc_<name>` under `/cvlattesweb/`. Parameter matching is strict: calling `pkg_formacao.lista` without `f_tipo` returns HTTP 404 (the gateway's way of saying "no procedure with that signature").                                      |
| Auth        | Keycloak SSO at `login.cnpq.br` (realm `cnpq`, client `lattes`), initialized in the page with `check-sso`. Session state on the editor side is a cookie on `.cnpq.br`. Not inspected further.                                                                                                                     |
| Front end   | jQuery 1.6.4 and 1.7.2 both loaded, jQuery UI 1.8.13 and 1.8.16, jkmegamenu, tipsy tooltips, custom `modal_cv.js`, `caixa_msg.js`, `gridcv.js`, `lista.js`. Google Analytics `ga.js`.                                                                                                                             |
| Identifiers | Two codes appear. The page URL carries a 32-hex `f_cod` that changes on each login (it survived one re-login early on, then changed on the next three, so treat it as a session token). Every in-page procedure call carries a different 10-character `f_cod` (the CV's own code). Treat both as secrets in logs. |

## 2. Navigation model

Every section is a separate PL/SQL page loaded into an iframe inside a div-based modal. There are no popup windows anywhere in the editor itself.

| Modal      | Role                         | Example                                                    |
| ---------- | ---------------------------- | ---------------------------------------------------------- |
| `modalCV1` | Section list                 | `pkg_ativ.lista`, `pkg_formacao.lista?f_tipo=FA`           |
| `modalCV2` | Insert/edit form             | `PKG_ATIV.inclui`, `pkg_formacao.form?f_tipo=FA&f_nivel=9` |
| `modalCV3` | Lookup dialogs               | `prc_inst_form` (institutions), `prc_inst_ativ`            |
| `caixaMsg` | Custom in-page confirm/combo | "unsaved changes" prompt, Nível picker, Vínculo picker     |

Opening a section is `modalCVn.setarUrl(url, true)`; the modal sets `iframe.src = url` and the child page calls `self.parent.modalCVn.habilitaModal()` when ready. Nested modals close via `removerModal()`. Child pages reach the parent form with `self.parent.modalCV2.getDocument().document.forms[0]`.

One exception: the login page opens the editor as a new window (`pkg_login.prc_form` → new tab with `PKG_MENU.menu`). This is what repeatedly pushed the editor tab out of the extension's tab group.

### Menu catalogue (procedure per section)

Dados gerais: `prc_ident` (Identificação, takes `f_pcd`), `prc_endereco`, `pkg_formacao.lista` (`f_tipo=FA` academic, `f_tipo=AP` pós-doc/livre-docência), `pkg_formacao_compl.lista`, `pkg_idioma.lista`, `pkg_premio.lista`, `prc_area_atuacao`, `pkg_resume.form`, `prc_outras_inf`, `pkg_licenca.lista` (maternity/paternity leave, matches the LICENCA element added to the 2022 XSD).

Atuação: `pkg_ativ.lista`, `pkg_linhapesq.lista`, `pkg_revisor.lista` (corpo editorial, revisor de periódico, comitê de assessoramento, revisor de agência, all one package), `pkg_projeto.lista` (pesquisa, extensão, desenvolvimento, ensino, outros).

Produção bibliográfica: `pkg_artigo.lista`, `pkg_artigo_pr.lista` (aceitos), `pkg_lvr_cap.lista`, `pkg_trabalho.lista` (anais), `pkg_texto.lista` (jornal/revista), `prc_bib_demais_lista` (prefácio, tradução, partitura, outras).

Produção técnica: `PKG_PATENTE_REGISTRO.LISTA` (patente, software registrado ou não, cultivar, desenho industrial, marca, topografia), `pkg_produto.lista`, `pkg_processo.lista`, `pkg_relatorio.lista` (trabalhos técnicos), `prc_tec_demais_lista` (apresentação de trabalho, curso de curta duração, material didático, editoração, maquete, cartas/mapas, organização de evento, entrevistas, redes sociais, relatório de pesquisa, outras), `PKG_ASSESSORIA_CONSULTORIA.lista`, `PKG_EXTENSAO_TECNOLOGICA.lista`.

Artística: `pkg_arte_nova.lista` (artes cênicas, música, artes visuais), `prc_arte_lista`.

Orientações: `pkg_orient.lista` (concluídas e em andamento). Bancas: `pkg_banca_trab.lista`, `pkg_banca_julg.lista`. Eventos: `pkg_evento.lista`. Demais trabalhos: `pkg_demais.lista`. Citações: `prc_indicadores`.

Dictionaries (shared): `pkg_dic_autor.lista`, `pkg_identificacao_coautor.form`, `pkg_dic_plv_nv.lista` (keywords), `pkg_dic_area.lista`, `pkg_dic_instituicao_nova.lista`, `pkg_alteracao_periodico.lista`.

Tools: `pkg_impcv.form` (Imprimir), `pkg_impcv.get_arquivo` (Exportar XML), `pkg_importa_xml.inicio` (Importar XML), `pkg_import_cv.lista` (Importação de produção), `PKG_IMPORT_ASSISTENTE.lista` (Assistente de importação), `pkg_publicar.mostrar_cv` (Enviar ao CNPq).

## 3. Save mechanics (the part that decides the bridge)

Both forms captured follow the same pattern:

1. The form is a classic HTML form, `method=post`, action = the same package (`PKG_ATIV.INCLUI`, `pkg_formacao.FORM`).
2. The Salvar button calls a client-side `check()` that validates required fields and date logic, collects messages in an array and shows them through `alerta()`.
3. On success, `enviar()` runs `dc.submit()`. A full-page POST inside the iframe. No AJAX for the save itself.
4. Hidden `f_ctr` carries the operation: `I` insert, `V` cancel/back, with `E` and `A` seen in the Formação code for delete and alter.
5. No CSRF token in either form. The only session-bound values are `f_cod` and the cookie.

AJAX exists only for validators and side effects, returning JSON or plain text:

| Endpoint                               | Called from                                                                       | Purpose                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pkg_formacao.valida_orientador_lates` | Formação form (POST, `f_cod`, `f_nme`, `f_nivel`)                                 | Resolves an advisor name to a Lattes ID; fills `f_id_orientador` and `f_seq_orientacao` |
| `PKG_FORMACAO.SETA_ULTIMO_PUBLICO`     | Formação form (POST, `f_cod`, `f_seq`, `f_tipo`, `f_op`)                          | Enforces "at least one public entry"                                                    |
| `PRC_INST_FORM`                        | Institution lookup (POST, `f_nome`, `F_CTR=C`, `F_COD`, `F_NIVEL`, `F_STA_OUTRA`) | Returns an HTML result list; each result is `javascript:seleciona(code, name)`          |

Native dialogs are everywhere: 10 `alert()` and 5 `confirm()` in the Atuação form script, 58 `alert()` and 6 `confirm()` in the Formação form script, 2 `confirm()` on the editor shell for leaving. Typing an institution by hand instead of using the lookup triggers an immediate `alert()`. Delete uses `confirm()`. Leaving the editor shows a long legal text in `alert()` before Keycloak logout. Any automation that drives the real UI has to neutralize these (override `window.alert`/`window.confirm` inside the iframe before acting).

## 4. Form field maps

### 4.1 Atuação profissional (`GN_ATIV` → `PKG_ATIV.INCLUI`)

| Field                                                     | Type                                    | Notes                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `f_inst`                                                  | text, max 75                            | Display name. Must come from lookup; manual typing triggers `alertainst()` which restores `f_inst_old`                   |
| `f_cod_inst` / `f_cod_inst2`                              | hidden                                  | Institution code. Lookup fills `f_cod_inst` when the code starts with `V`, otherwise `f_cod_inst2` ("outra instituição") |
| `f_instold`, `f_inst_old`                                 | hidden                                  | Previous value guards                                                                                                    |
| `f_vinc`                                                  | text, max 30                            | Tipo do vínculo, set by `dominio()` combo: Servidor público, Celetista, Professor Visitante, Bolsista, Outro (free text) |
| `f_vinculo`                                               | hidden                                  | Internal vínculo code                                                                                                    |
| `f_stavinc`                                               | select: blank, 0=Não, 1=Sim             | Possui vínculo empregatício                                                                                              |
| `f_enqua`                                                 | text, max 45                            | Enquadramento funcional                                                                                                  |
| `f_carga`                                                 | text, max 3                             | Carga horária semanal                                                                                                    |
| `f_regime`                                                | checkbox                                | Dedicação exclusiva                                                                                                      |
| `f_mes_ini`, `f_ano_ini`                                  | text 2 / 4                              | Required: ano início                                                                                                     |
| `f_status`                                                | radio S / N                             | Atual (não finalizado) / Anterior (finalizado)                                                                           |
| `f_mes_fim`, `f_ano_fim`                                  | text 2 / 4                              |                                                                                                                          |
| `f_outras_inf`                                            | textarea, max 3950                      |                                                                                                                          |
| `f_tipo_privacidade`                                      | text, with a select 1=Público 2=Privado | `verificaPriv()` forces Público if it is the only vínculo                                                                |
| `f_ctr`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_hist` | hidden                                  | Operation and keys                                                                                                       |

Editing an existing row opens `PKG_ATIV.cargos_vinculos?f_cod=…&f_codinst=…&f_seq_ativ=N` in `modalCV2`. Reordering is `PKG_ATIV.ordenar`.

### 4.2 Formação acadêmica (`GN_FORMACAO2` → `pkg_formacao.FORM`)

Level is chosen before the form opens, through a `caixaMsg` combo whose option values are the form URLs:

| `f_nivel` | Level                                |
| --------- | ------------------------------------ |
| 4         | Doutorado                            |
| 3         | Mestrado                             |
| 9         | Mestrado Profissional                |
| 2         | Especialização                       |
| D         | Especialização - Residência médica   |
| 1         | Graduação                            |
| 7         | Ensino Profissional de nível técnico |
| C         | Ensino Médio                         |
| B         | Ensino Fundamental                   |
| X         | Aperfeiçoamento                      |

Fields (55 total, Mestrado Profissional variant):

| Group          | Fields                                                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys           | `f_ctr=I`, `f_cod`, `f_seq`, `f_tipo=FA`, `f_nivel=9`                                                                                                                                                                      |
| Type           | `f_tpo_doutorado` radio N (normal) / S (sanduíche)                                                                                                                                                                         |
| Institution    | `f_inst` (max 75, lookup only), `f_cod_inst`, `f_cod_inst2`, `f_inst_old`                                                                                                                                                  |
| Course         | `f_curso` (max 75, lookup only), `f_cod_curso`, `f_cod_curso2`, `f_curso_old`, `f_carga` hidden                                                                                                                            |
| Status         | `F_STATUS` radio N (em andamento) / S (concluído) / I (incompleto)                                                                                                                                                         |
| Period         | `f_ano_ini`, `f_ano_fim`, `f_mes_obten`, `f_ano_obten`                                                                                                                                                                     |
| Bolsa          | `F_BOLSA` radio S / N, `f_nme_agencia` (max 75, lookup), `f_agencia` hidden                                                                                                                                                |
| Detalhamento   | `f_titulo` (max 254), `f_orient` (max 60), `f_coorient` (max 60), `f_id_orientador`, `f_seq_orientacao`                                                                                                                    |
| Doutorado-only | `f_orient_dout`, `f_inst_dout`, `f_meses_sw`, `f_orient_dout_sw`, `f_inst_dout_sw`, `f_meses_sw_aux`, `f_orient_dout_ct`, `f_inst_dout_ct`, plus six `f_cod_inst*_dout*` hidden codes (sandwich and cotutela institutions) |
| Lists          | `f_plv_l` (palavras-chave), `f_setor_l`, `f_area_l` hidden, filled by three unnamed text inputs with their own pickers                                                                                                     |
| Privacy        | select 1=Público 2=Privado, `f_tipo_privacidade`                                                                                                                                                                           |

A second form `formchk` (`f_cod_chk`, `f_seq_chk`, `start`, `finish`, `status`, `f_nme_orientador`) backs the advisor validation call.

Visibility note: Rafael's current CV has 3 Formação rows (Mestrado 2006–2007 at PUCRS, Graduação 2001–2004 at UFPel, técnico 1995–1998 at CEFET Pelotas) and 17 Atuação rows through 2026. The November 2025 XML export analysed earlier is stale; the biographical catch-up is mostly done already, which lowers the value of a biographical write path for Rafael himself.

### 4.3 Institution lookup (`prc_inst_form`, `modalCV3`)

Search is a POST to `PRC_INST_FORM` with `f_nome`, `F_CTR=C`, `F_COD`, `F_NIVEL`, `F_STA_OUTRA=N`. The response is HTML; each hit is a link `javascript:seleciona('<code>','<name>')`. `seleciona` writes the code and name into the parent form and calls `cancelar()` to close the modal. A "Cadastrar nova instituição" path exists (`prc_inst_outra`). The same mechanism serves courses (`curso()`) and funding agencies.

Implication: a bridge does not need to drive the lookup UI. It can POST the search, parse the links, and write `f_inst`, `f_inst_old` and `f_cod_inst` directly.

## 5. Import and export surfaces

| Entry                    | Procedure                                      | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Assistente de importação | `PKG_IMPORT_ASSISTENTE.lista`                  | Exactly one source: Oasisbr (Ibict) theses and dissertations, "Importar Dados" button. No DOI, Crossref, ORCID, Scopus or Web of Science import exists in the editor.                                                                                                                                                                                                                                                                                                                      |
| Importação de produção   | `pkg_import_cv.lista` → `pkg_import_cv.form01` | Co-author copy: when another CV lists you as co-author (via the co-author ID feature), you can copy that item. Empty for Rafael.                                                                                                                                                                                                                                                                                                                                                           |
| Imprimir                 | `pkg_impcv.form` → POST `pkg_impcv.trata`      | Print/HTML generation. Fields: 40 section checkboxes (`f_check`), `f_tpo` R/A/C/P (Resumido, Ampliado, Completo, Personalizado), `f_est` (with or without graphics), `f_idioma` 1/2 (PT/EN), `f_padrao` A/C (ABNT/Chicago), `f_per_atu` + `f_ano_atu`, `f_per_prod` + `f_ano_prod` (year filters), `f_plv`, `f_setor`, `f_area`, `f_et_al`, `f_inf`, `f_relev`, `f_cit`, `f_exibir_cit`, `f_fmt=H`, `f_tpo_arq=0`. Useful as the reference for what CNPq considers a "complete" CV layout. |
| Exportar                 | `pkg_impcv.get_arquivo?f_cod=…` in `modalCV1`  | Downloads `CV_<id>.zip` containing one `<id>.xml` (ISO-8859-1, root `SISTEMA-ORIGEM-XML="LATTES_OFFLINE"`). DOM not captured.                                                                                                                                                                                                                                                                                                                                                              |
| Importar                 | `pkg_importa_xml.inicio?f_cod=…` in `modalCV1` | Three steps, not two. Tested by hand on 2026-10-10; see 5.1.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Enviar                   | `pkg_publicar.mostrar_cv?f_cod=…`              | Publish step. Not opened.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 5.1 XML import, tested

Tests run by Rafael on his own CV with files generated from the fresh export. Every fake item was deleted afterwards.

| Step                  | Behavior observed                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passo 1               | Accepts only a bare `.xml`. The ZIP that Exportar produces is refused, so export and import are asymmetric. Success is a native `alert()`: "O arquivo foi enviado com sucesso!".                                            |
| Passo 2               | Module checkboxes, all pre-checked ("Selecionar todos" on by default). Year filter "Produção C&T a partir de" defaulted to 2004 this time (2007 in February), so the default is derived from the file or the CV, not fixed. |
| Passo 3               | Item-level list for the chosen modules. Each item carries a marker: green "não está cadastrada", red "está cadastrada". All pre-checked. Confirmar / Descartar.                                                             |
| Confirming a red item | Inserts a duplicate. The marker is a warning, not a guard. Verified: the 2004 TCC came back as two identical rows.                                                                                                          |
| Update in place       | Does not exist through import. Edits to existing items go through the forms.                                                                                                                                                |
| Matching key          | `SEQUENCIA-PRODUCAO`, a single global sequence across every production type in the CV.                                                                                                                                      |

Sequence-number behavior, from three runs with a fake conference paper (`TRABALHO-EM-EVENTOS`, valid against DTD and XSD):

| `SEQUENCIA-PRODUCAO` on the fake item                 | Result in Passo 3      |
| ----------------------------------------------------- | ---------------------- |
| 1 (absent from the export, but a gap in the sequence) | Silently dropped       |
| 33 (above the export's maximum of 32)                 | Listed green, accepted |
| Attribute omitted                                     | Silently dropped       |

Reading: gaps in the exported sequence (1, 3, 7, 14, 19, 23, 24, 28 to 31 in this CV) are occupied by deleted or hidden rows on the server, and the importer discards any item whose sequence is missing or already taken, with no message. Rules for the app:

- Every new item gets a sequence number strictly greater than the highest number found anywhere in the user's export.
- Never omit the attribute, never reuse a gap.
- Dedupe on the app side and default known items to unchecked, since the server will duplicate on Confirmar.
- Unzip on load, write bare `.xml` on export.
- Upper bound of the sequence is unknown; 33 worked. Large offsets should be tested before relying on them.

## 6. Native dialogs and other automation hazards

- `alert()` on manual institution/course entry, on privacy coercion, on validation.
- `confirm()` on delete and on leaving a form with changes ("Foram realizadas modificações nesta página…").
- `confirm()` + long `alert()` on logout, and the page uses a leave guard that can block closing the tab.
- The `caixaMsg` component is in-page and safe; the native ones freeze any WebDriver-style automation and did freeze the Chrome extension once during this session.
- Each form page reloads jQuery and its plugins; `dd.min.js` (dropdown skin) appears only on forms.

## 7. Session behavior observed

| Session | How the editor tab was opened                                              | Lifetime before every call redirected to `pkg_sec.logon` | What preceded the drop                               |
| ------- | -------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| 1       | Direct URL in a new tab, user's own tab also open                          | ~12 min                                                  | Institution lookup (`prc_inst_ativ`)                 |
| 2       | Direct URL in a new tab, user's own tab also open                          | ~3.5 min                                                 | Closing modals after a successful institution search |
| 3       | Direct URL in a new tab, user's tab closed                                 | ~3 min                                                   | Opening Exportar                                     |
| 4       | Through `pkg_login.prc_form` (SSO auto-login), editor opened as new window | Tab left the extension's group before any call           | n/a                                                  |

What this does not prove: a cause. What it suggests: a session born from a direct URL is treated differently from one born through the login window, or two editor instances for one CV invalidate each other. Either way the bridge design should assume the server session is short-lived and single-instance, and should do its work in the tab the user already has, in short bursts, with a check for the `pkg_sec.logon` stub in every response.

## 8. Verdict for the bridge (shapes B, C, D from the brainstorm)

- The write path is simpler than feared. Plain POST, no CSRF, one `f_cod`, known field names. A bridge can either fill the real form and call `enviar()`, or replicate the POST from page context with `fetch` using the same session. The second is thinner and avoids the native dialogs entirely, at the cost of being plainly "automation" under the 2022 Portaria wording.
- The institution dictionary is the only real dependency beyond field names, and it is a POST that returns parseable HTML.
- Native dialogs are the main fragility for the fill-the-real-form approach; the POST approach sidesteps them.
- The session instability observed is the main operational risk; it argues for small, resumable operations and for running inside the user's existing editor tab rather than opening a second one.
- The XML import is confirmed as the write path for new production items: a hand-built `TRABALHO-EM-EVENTOS` with a fresh sequence number was accepted and landed in the right section. It is insert-only, keyed on `SEQUENCIA-PRODUCAO`, and duplicates on request (section 5.1).

## 9. Open items

- [ ] DOM of `pkg_importa_xml.inicio` (upload form field names, Passo 2 checkbox values, Passo 3 item keys, the pending-request mechanism)
- [ ] DOM of `pkg_impcv.get_arquivo`
- [ ] Idiomas, Resumo (`pkg_resume.form`), Endereço (`prc_endereco`) field maps
- [ ] Whether `f_ctr=A` on `PKG_ATIV.INCLUI` with `f_seq_ativ` updates an existing row (expected from the code, not verified)
- [ ] Upper bound and reuse rules for `SEQUENCIA-PRODUCAO` (does max+1000 work; does a number freed by a manual delete become usable again)
- [ ] Whether Passo 3's red/green match uses the sequence alone or also title and year (a new sequence with an existing title would tell)
- [ ] Cause of the session drops; cheapest test is one editor tab opened through the login window, left alone for 15 minutes, then one click
