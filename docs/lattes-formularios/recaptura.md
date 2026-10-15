# Recaptura: o que falta ler no Lattes

O que a LAT-57 (criar pelo editor todo tipo de item) precisa ver no Lattes e a
captura de 15/10/2026 não guardou. Tudo é leitura: GET de lista e de
formulário de inclusão, sem `f_seq` e sem enviar nada. Roda numa sessão só,
com o mesmo `dist-censo/censo-lattes.js` do censo (`README.md` desta pasta).

Estas chamadas servem para isso:

- `__lattesCensus.capture({ scripts: true, … })` guarda também os scripts da
  própria página de cada formulário, sem dado pessoal;
- `__lattesCensus.inspect([caminhos], { download: true })` abre páginas que o
  censo ainda não tem como entrada e guarda, de cada uma, o formulário, os
  scripts e os endereços do Lattes que ela abre. Os caminhos vão sem `f_cod`
  (o código entra sozinho); `{ path, noCode: true }` abre sem ele, e um
  caminho que já traz `f_cod` (copiado do Lattes) não ganha outro. O arquivo
  baixado é `recaptura-AAAA-MM-DD.json` e não é um censo versionado;
- `__lattesCensus.activities()` e `__lattesCensus.authorShape(nome)` servem
  aos lotes 3 e 4, abaixo.

Em 15/10/2026, a lista de atuações aberta à mão com `f_cod` voltou com 53
bytes e sem links. Que o `f_cod` repetido pelo `inspect` tenha causado isso é
**inferido** (o gateway responde 404 a um parâmetro que o procedimento não
declara, seção 1 de `lattes_internals.md`; o parâmetro repetido não foi
testado). O lote 3 agora acha a atuação sozinho.

Dos scripts sai, linha a linha, todo e-mail, CPF e número longo (código e
identificador do currículo), cada texto passado em `redact` e as linhas que
montam os dados das grades (`autorProvider` e parecidas). Mesmo assim, leia o
arquivo antes de entregar: procure o próprio nome e o de coautores.

## O lote

Com o menu do Lattes aberto na aba e o script colado no console:

```js
const redact = ['Seu Nome Completo', 'SOBRENOME, N.'];

// 1. Aperfeiçoamento (deu erro em 15/10/2026), com scripts, e as inclusões
//    que o menu oferece e o censo não cobre (prefácio, programa de computador
//    registrado, artigos, linhas de pesquisa…).
await __lattesCensus.capture({
  only: ['formacao-FA-X'],
  discover: true,
  scripts: true,
  redact,
  download: true,
});

// 2. As páginas avulsas.
await __lattesCensus.inspect(
  [
    // Datas e titulares da patente, da marca e da topografia (grades).
    'pkg_patente_registro.form?f_cod_tipo=PP&f_sta_inovacao=',
    'PKG_PATENTE_REGISTRO.form?f_cod_tipo=MR&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
    'PKG_PATENTE_REGISTRO.form?f_cod_tipo=TC&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
    // Datas em campo de texto: cultivares e desenho industrial.
    'PKG_PATENTE_REGISTRO.form?f_cod_tipo=CP&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
    'PKG_PATENTE_REGISTRO.form?f_cod_tipo=CR&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
    'PKG_PATENTE_REGISTRO.form?f_cod_tipo=DI&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
    // A janela prévia da patente (abre sem f_cod).
    { path: 'pkg_patente_registro.informar_dados_patente?ftipo=PP', noCode: true },
    // Programa de computador: a lista e o formulário com registro.
    'PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PC',
    'PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PC&f_reg=S',
    'PKG_PATENTE_REGISTRO.form?f_cod_tipo=PC&f_reg=S&F_STA_DIVULGACAO_CIENTIFICA=',
    // Artigo publicado: a página que veio sem formulário, e a lista.
    'PKG_ARTIGO.form?f_sta_divulgacao_cientifica=&F_ORIGEM_WS=F&F_TITULO_PERIODICO=',
    'pkg_artigo.lista',
    // Prefácio e outra produção bibliográfica: a lista dos "demais tipos".
    'prc_bib_demais_lista',
    // Corpo editorial, revisão e assessoramento: as quatro listas.
    'pkg_revisor.lista?f_natur=MB',
    'pkg_revisor.lista?f_natur=MA',
    'pkg_revisor.lista?f_natur=RV',
    'pkg_revisor.lista?f_natur=RA',
    // Licença: a máscara das datas.
    'pkg_licenca.form',
    // Áreas de atuação: a grade f_area_l.
    'prc_area_atuacao',
    // Projeto: as grades de financiadores, produções e orientações.
    'PKG_PROJETO.form?f_tpo_cooperacao=X&f_tpo_acao_inov=X&f_tematica=X&F_sta_inovacao=&f_cod_tipo=P',
    // Formação complementar: o formulário de inclusão e a lista.
    'PKG_FORMACAO_COMPL.form?f_tipo=FA',
    'pkg_formacao_compl.lista',
    // Linhas de pesquisa: a lista (o link de inclusão não foi achado).
    'pkg_linhapesq.lista',
    // Produções, orientações e bancas: a grade de autores e as buscas.
    'PKG_ARTIGO_PR.form?F_STA_DIVULGACAO_CIENTIFICA=',
    'pkg_trabalho.form?F_STA_DIVULGACAO_CIENTIFICA=',
    'pkg_relatorio.form',
    'pkg_orient.form?f_tipo=C',
    'pkg_orient.form?f_tipo=A',
    'PKG_BANCA_TRAB.form',
    'PKG_BANCA_JULG.form',
  ],
  { redact, download: true },
);

// 3. As atividades de uma atuação, uma por natureza. O lote acha sozinho a
//    primeira atuação com o link "Incluir atividade" (pkg_ativ.lista, depois
//    a tela de cargos e vínculos) e abre o formulário de cada natureza. Os
//    códigos da atuação ficam fora do arquivo.
await __lattesCensus.activities({ redact, download: true });

// 4. A forma das linhas de autor do menu (autorDP), sem nome nenhum: a ordem
//    das chaves, o padrão dos códigos e a linha do dono, achada pelo nome.
copy(JSON.stringify(__lattesCensus.authorShape('Seu Nome Completo'), null, 2));
```

## O que extrair de cada item

| Item                                              | Onde                                                          | O que procurar                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grade de datas (patente, marca, topografia)       | scripts dos três formulários de registro com grade            | `array2xml` e o que monta o vetor de `gridContatos`: nomes das chaves de cada linha, como a data é escrita (DD/MM/AAAA ou outro), se o código da data (`01` depósito…) vai junto, e se `check()` copia alguma data para os ocultos `f_dta_dep`, `f_dta_conc`, `f_dta_exp`, `f_dta_dep_pct` |
| Titular e depositante (patente)                   | scripts do formulário da patente                              | como `f_depositante_pessoa_l` e `f_depositante_inst_l` são montados: o sentido de `pais`, `staValidado` e `tipoInst`, e o que `check()` exige                                                                                                                                              |
| Formato da data em campo (cultivares, desenho)    | scripts dos formulários CP, CR e DI                           | a máscara ou a validação de `f_dta_dep` e `f_dta_conc` (DD/MM/AAAA?), e o que `check()` exige em cada tipo                                                                                                                                                                                 |
| `check()` de cada registro                        | os mesmos scripts                                             | campos obrigatórios por tipo; se o autor precisa ser o dono; se a marca exige tipo e natureza                                                                                                                                                                                              |
| Programa de computador com registro               | `entries` das duas listas de PC e o formulário com `f_reg=S`  | o link de inclusão que a lista de "registrado" usa (o valor real de `f_reg`) e os campos do formulário dele (instituição, número, datas)                                                                                                                                                   |
| Artigo publicado                                  | `shape`, `scripts` e `links` da página de `PKG_ARTIGO.form`   | o que a página carrega no lugar do formulário: um frame, um passo de busca por DOI ou título (`F_ORIGEM_WS`), um redirecionamento, e o endereço do formulário de verdade                                                                                                                   |
| Prefácio, posfácio e outra produção bibliográfica | `links` de `prc_bib_demais_lista` e o `discovered` do passo 1 | os `f_cod_tipo` dos dois tipos e o procedimento de inclusão de cada um (depois, uma entrada nova no censo)                                                                                                                                                                                 |
| Aperfeiçoamento                                   | a entrada `formacao-FA-X` do passo 1                          | os campos do nível X (no censo de 15/10/2026 deu "Failed to fetch")                                                                                                                                                                                                                        |
| Elemento do XML do corpo editorial e da revisão   | `links` das quatro listas de `pkg_revisor`                    | se o currículo tem algum item desses: o link de edição de cada um. Com item, a passada de edição (`link()`) pode casar os campos com a exportação; sem item, só um teste acompanhado (incluir, exportar, comparar e excluir) diz que elemento ele grava, e isso escreve no currículo       |

| Licença | scripts de `pkg_licenca.form` | a máscara ou a validação de `f_dta_inicio` e `f_dta_fim`, e o que `f_dta_nasc_adoc` exige |
| Áreas de atuação | scripts de `prc_area_atuacao` | como `f_area_l` é montada: o sentido das chaves `r` e `p` de cada linha e se uma área nova vai com código |
| Financiador, produção e orientação do projeto | scripts do formulário de projeto | como `f_inst_l` (quatro valores por linha), `f_producoes_l` e `f_orientacoes_l` são montados, e o que é cada valor |
| Formação complementar | o formulário e a lista | o que `check()` faz antes de `FORM2` e se a lista mostra os anos; o passo depois de `FORM2` só aparece enviando, o que fica para um teste acompanhado |
| Linha de pesquisa | `links` de `pkg_linhapesq.lista` e o `discovered` do passo 1 | o procedimento de inclusão da linha (provavelmente uma função da página, que os scripts mostram) |
| Atividades de uma atuação | o lote 3, uma página por natureza | os campos de cada natureza (órgão, unidade, cargo, curso, especificação) e a grade `f_espec_l` de disciplinas e treinamentos: chaves e separadores |

| Autores das produções e participantes das bancas | scripts dos formulários de artigo aceito, trabalho em anais, trabalho técnico e das duas bancas | se a inclusão já traz a própria pessoa no `autorProvider` (a linha sai como "[removido]": basta saber se existe), como `check()` monta `f_autores_l` e o sentido de `pais`; o mesmo para `f_plv_l`, `f_area_l` e `f_setor_l` |
| Orientações | scripts dos dois formulários de orientação | os parâmetros das buscas de instituição, curso e agência (`sele_inst`, `curso()`, `agencia()`), o sentido de `f_sub_prod` e `f_ctr_natur`, e o que `check()` exige por tipo |

Depois de lido, o que virar fato vai para `docs/lattes_internals.md` (com a
data) e para o código, e a linha sai desta lista.
