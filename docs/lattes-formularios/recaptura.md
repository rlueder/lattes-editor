# Recaptura: o que falta ler no Lattes

O que a LAT-57 (criar pelo editor todo tipo de item) precisa ver no Lattes e a
captura de 15/10/2026 não guardou. Tudo é leitura: GET de lista e de
formulário de inclusão, sem `f_seq` e sem enviar nada. Roda numa sessão só,
com o mesmo `dist-censo/censo-lattes.js` do censo (`README.md` desta pasta).

Duas chamadas novas servem para isso:

- `__lattesCensus.capture({ scripts: true, … })` guarda também os scripts da
  própria página de cada formulário, sem dado pessoal;
- `__lattesCensus.inspect([caminhos], { download: true })` abre páginas que o
  censo ainda não tem como entrada e guarda, de cada uma, o formulário, os
  scripts e os endereços do Lattes que ela abre. Os caminhos vão sem `f_cod`
  (o código entra sozinho); `{ path, noCode: true }` abre sem ele. O arquivo
  baixado é `recaptura-AAAA-MM-DD.json` e não é um censo versionado.

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
  ],
  { redact, download: true },
);
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

Depois de lido, o que virar fato vai para `docs/lattes_internals.md` (com a
data) e para o código, e a linha sai desta lista.
