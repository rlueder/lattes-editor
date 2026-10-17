// Artigos publicados, artigos aceitos e trabalhos em anais. Nome do <form>,
// POST, nomes dos campos e valores das opções: censo de 15/10/2026
// (censo-2026-10-15.json; o artigo publicado está em censo-2026-10-15b.json,
// da recaptura). Nenhum item destes tipos estava na exportação do dono, e a
// passada de edição saiu "sem-itens": a ligação de cada atributo com o campo
// é Inferido, pelo rótulo do campo no censo, e confere com a do relatório
// onde ele tem uma.
//
// Ficam à mão de propósito o DOI (DOI_MANUAL) e o que o formulário não tem.
// Inferido também, para todos: que o link de cada linha da lista seja o
// formulário de inclusão com f_seq, como no trabalho técnico; e que gravar o
// título, o ano, o periódico ou o ISSN sem mexer nos ocultos f_*_h (o valor
// de antes) e f_seq_per (o periódico escolhido na busca) grave o que foi
// digitado. A releitura depois do envio acusa se não gravou.

import { byTable, country, language, media, yesNo } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';
import { ALL_GRIDS, DOI_MANUAL, mediaAmong, under } from './bibliografica-comum.ts';

/**
 * Artigo publicado (GN_ARTIGO, POST PKG_ARTIGO.FORM). A lista é
 * pkg_artigo.lista (catálogo de menus do reconhecimento); a entrada à mão
 * dela abre PKG_ARTIGO.form, que é o formulário do censo. Inferido: o link de
 * edição de cada linha (PKG_ARTIGO.form com f_seq).
 */
const ARTIGO_PUBLICADO: ProductionTarget = {
  element: 'ARTIGO-PUBLICADO',
  fields: {
    ...under('DADOS-BASICOS-DO-ARTIGO', {
      'ANO-DO-ARTIGO': 'f_ano',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      // O formulário só tem impresso, meio digital e "impresso e mídia eletrônica".
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: mediaAmong(['I', 'D', 'V']) },
      'TITULO-DO-ARTIGO': 'f_titulo',
      'TITULO-DO-ARTIGO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-ARTIGO', {
      ISSN: 'f_issn',
      'PAGINA-FINAL': 'f_pag_fim',
      'PAGINA-INICIAL': 'f_pag_ini',
      SERIE: 'f_serie',
      'TITULO-DO-PERIODICO-OU-REVISTA': 'f_titulo_periodico',
      VOLUME: 'f_volume',
    }),
    ...under('INFORMACOES-ADICIONAIS', {
      'DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
      'DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
    }),
  },
  form: { action: 'PKG_ARTIGO.FORM', name: 'GN_ARTIGO' },
  grids: [...ALL_GRIDS],
  id: 'artigo-publicado',
  list: { formProc: 'PKG_ARTIGO.form', proc: 'pkg_artigo.lista' },
  manual: { 'DADOS-BASICOS-DO-ARTIGO@DOI': DOI_MANUAL },
  title: { attr: 'TITULO-DO-ARTIGO', child: 'DADOS-BASICOS-DO-ARTIGO' },
  year: { attr: 'ANO-DO-ARTIGO', child: 'DADOS-BASICOS-DO-ARTIGO' },
};

/**
 * Artigo aceito (GN_ARTIGO, POST PKG_ARTIGO_PR.FORM), na lista
 * pkg_artigo_pr.lista da captura de 13/10/2026. O formulário é mais curto que
 * o do publicado: sem meio, home page, volume, páginas nem "Outras
 * informações" em português.
 */
const ARTIGO_ACEITO: ProductionTarget = {
  element: 'ARTIGO-ACEITO-PARA-PUBLICACAO',
  fields: {
    ...under('DADOS-BASICOS-DO-ARTIGO', {
      // "Ano previsto para publicação".
      'ANO-DO-ARTIGO': 'f_ano',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'TITULO-DO-ARTIGO': 'f_titulo',
      'TITULO-DO-ARTIGO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-ARTIGO', {
      ISSN: 'f_issn',
      'TITULO-DO-PERIODICO-OU-REVISTA': 'f_titulo_periodico',
    }),
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_ARTIGO_PR.FORM', name: 'GN_ARTIGO' },
  grids: [...ALL_GRIDS],
  id: 'artigo-aceito',
  list: { formProc: 'PKG_ARTIGO_PR.form', proc: 'pkg_artigo_pr.lista' },
  manual: { 'DADOS-BASICOS-DO-ARTIGO@DOI': DOI_MANUAL },
  title: { attr: 'TITULO-DO-ARTIGO', child: 'DADOS-BASICOS-DO-ARTIGO' },
  year: { attr: 'ANO-DO-ARTIGO', child: 'DADOS-BASICOS-DO-ARTIGO' },
};

/**
 * Trabalho em anais (GN_TRABALHO, POST PKG_TRABALHO.FORM), na lista
 * pkg_trabalho.lista da captura de 13/10/2026. Inferido: a natureza pelos
 * rótulos de F_COD_PROD (121 Completo, 122 Resumo, 123 Resumo Expandido), a
 * classificação pelos de f_tipo_evento, e PAIS-DO-EVENTO no f_pais, cujo
 * rótulo é "País de publicação" (o XML só tem esse país no trabalho).
 */
const TRABALHO_EM_EVENTOS: ProductionTarget = {
  element: 'TRABALHO-EM-EVENTOS',
  fields: {
    ...under('DADOS-BASICOS-DO-TRABALHO', {
      'ANO-DO-TRABALHO': 'f_ano',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
      NATUREZA: {
        field: 'F_COD_PROD',
        toForm: byTable({ COMPLETO: '121', RESUMO: '122', RESUMO_EXPANDIDO: '123' }),
      },
      'PAIS-DO-EVENTO': { field: 'f_pais', toForm: country },
      'TITULO-DO-TRABALHO': 'f_titulo',
      'TITULO-DO-TRABALHO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-TRABALHO', {
      'ANO-DE-REALIZACAO': 'f_ano_evento',
      'CIDADE-DA-EDITORA': 'f_cidade_ed',
      'CIDADE-DO-EVENTO': 'f_cidade_evento',
      'CLASSIFICACAO-DO-EVENTO': {
        field: 'f_tipo_evento',
        toForm: byTable({ INTERNACIONAL: 'I', LOCAL: 'L', NACIONAL: 'N', REGIONAL: 'R' }),
      },
      FASCICULO: 'f_fasciculo',
      // "ISBN/ISSN".
      ISBN: 'f_isbn',
      'NOME-DA-EDITORA': 'f_editora',
      'NOME-DO-EVENTO': 'f_evento',
      'PAGINA-FINAL': 'f_pag_fim',
      'PAGINA-INICIAL': 'f_pag_ini',
      SERIE: 'f_serie',
      'TITULO-DOS-ANAIS-OU-PROCEEDINGS': 'f_titulo_pub',
      VOLUME: 'f_volume',
    }),
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_TRABALHO.FORM', name: 'GN_TRABALHO' },
  grids: [...ALL_GRIDS],
  id: 'trabalho-em-eventos',
  list: { formProc: 'pkg_trabalho.form', proc: 'pkg_trabalho.lista' },
  manual: { 'DADOS-BASICOS-DO-TRABALHO@DOI': DOI_MANUAL },
  title: { attr: 'TITULO-DO-TRABALHO', child: 'DADOS-BASICOS-DO-TRABALHO' },
  year: { attr: 'ANO-DO-TRABALHO', child: 'DADOS-BASICOS-DO-TRABALHO' },
};

export const ARTIGO_TARGETS: ProductionTarget[] = [
  ARTIGO_PUBLICADO,
  ARTIGO_ACEITO,
  TRABALHO_EM_EVENTOS,
];
