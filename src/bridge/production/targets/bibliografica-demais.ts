// Os demais tipos de produção bibliográfica, na lista prc_bib_demais_lista,
// um f_cod_tipo por tipo (1A tradução, 1B partitura, 1Z outra produção; seções
// 16 e 17 de lattes_internals.md). Tradução e partitura: nome do <form>, POST,
// campos e opções do censo de 15/10/2026, com a ligação atributo → campo
// Inferido pelo rótulo (nenhum item na exportação do dono), e o link de
// edição de cada linha também (o formulário de inclusão com f_seq).
//
// O prefácio e o posfácio ficam fora: o f_cod_tipo da lista deles e o
// formulário não foram lidos, e a leitura das listas do menu só achou
// inclusão de tradução e partitura.

import { byTable, country, language, media, yesNo } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';
import { ALL_GRIDS, under } from './bibliografica-comum.ts';

/** Os campos que os dois formulários GN_BIB do censo (tradução e partitura) têm iguais. */
const bibBasics = (child: string) =>
  under(child, {
    ANO: 'f_ano',
    'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
    'HOME-PAGE-DO-TRABALHO': 'f_homepage',
    IDIOMA: { field: 'F_IDIOMA', toForm: language },
    'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
    'PAIS-DE-PUBLICACAO': { field: 'f_pais', toForm: country },
    TITULO: 'f_titulo',
    'TITULO-INGLES': 'f_titulo_en',
  });

const INFO_EN = { 'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en' };

/**
 * Tradução (GN_BIB, POST PRC_BIB_TRADUCAO). Inferido: a natureza pelos
 * rótulos de F_COD_PROD (1A1 Artigo, 1A2 Livro, 1A9 Outra); o idioma da obra
 * usa a mesma lista do idioma (f_idioma_obra é a f_idioma com uma opção vazia).
 */
const TRADUCAO: ProductionTarget = {
  element: 'TRADUCAO',
  fields: {
    ...bibBasics('DADOS-BASICOS-DA-TRADUCAO'),
    'DADOS-BASICOS-DA-TRADUCAO@NATUREZA': {
      field: 'F_COD_PROD',
      toForm: byTable({ ARTIGO: '1A1', LIVRO: '1A2', OUTRO: '1A9' }),
    },
    ...under('DETALHAMENTO-DA-TRADUCAO', {
      'CIDADE-DA-EDITORA': 'f_cidade',
      'EDITORA-DA-TRADUCAO': 'f_editora',
      FASCICULO: 'f_fasciculo',
      'IDIOMA-DA-OBRA-ORIGINAL': { field: 'F_IDIOMA_OBRA', toForm: language },
      'ISSN-ISBN': 'f_issn',
      'NOME-DO-AUTOR-TRADUZIDO': 'f_autor_trad',
      'NUMERO-DA-EDICAO-REVISAO': 'f_edicao',
      'NUMERO-DE-PAGINAS': 'f_paginas',
      SERIE: 'f_serie',
      'TITULO-DA-OBRA-ORIGINAL': 'f_tit_obra',
      VOLUME: 'f_volume',
    }),
    ...INFO_EN,
  },
  form: { action: 'PRC_BIB_TRADUCAO', name: 'GN_BIB' },
  grids: [...ALL_GRIDS],
  id: 'traducao',
  list: {
    formProc: 'prc_bib_traducao',
    params: { f_cod_tipo: '1A' },
    proc: 'prc_bib_demais_lista',
  },
  title: { attr: 'TITULO', child: 'DADOS-BASICOS-DA-TRADUCAO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DA-TRADUCAO' },
};

/**
 * Partitura musical (GN_BIB, POST PRC_BIB_PARTITURA). Inferido: a natureza
 * pelos rótulos de F_COD_PROD (1B1 Canto, 1B2 Coral, 1B3 Orquestral, 1B9
 * Outra) e o número do catálogo no f_issn, cujo rótulo é "Número do catálogo".
 */
const PARTITURA: ProductionTarget = {
  element: 'PARTITURA-MUSICAL',
  fields: {
    ...bibBasics('DADOS-BASICOS-DA-PARTITURA'),
    'DADOS-BASICOS-DA-PARTITURA@NATUREZA': {
      field: 'F_COD_PROD',
      toForm: byTable({ CANTO: '1B1', CORAL: '1B2', ORQUESTRA: '1B3', OUTRO: '1B9' }),
    },
    ...under('DETALHAMENTO-DA-PARTITURA', {
      'CIDADE-DA-EDITORA': 'f_cidade',
      EDITORA: 'f_editora',
      'FORMACAO-INSTRUMENTAL': 'f_formacao',
      'NUMERO-DE-PAGINAS': 'f_paginas',
      'NUMERO-DO-CATALOGO': 'f_issn',
    }),
    ...INFO_EN,
  },
  form: { action: 'PRC_BIB_PARTITURA', name: 'GN_BIB' },
  grids: [...ALL_GRIDS],
  id: 'partitura',
  list: {
    formProc: 'prc_bib_partitura',
    params: { f_cod_tipo: '1B' },
    proc: 'prc_bib_demais_lista',
  },
  title: { attr: 'TITULO', child: 'DADOS-BASICOS-DA-PARTITURA' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DA-PARTITURA' },
};

const NOT_CAPTURED = 'o formulário de outra produção bibliográfica não foi capturado no censo';

/**
 * Outra produção bibliográfica (GN_BIB, POST PRC_BIB_OUTRAPROD). Observado em
 * 16/10/2026 no Lattes real, só por GET: a lista prc_bib_demais_lista com
 * f_cod_tipo=1Z, o formulário prc_bib_outraprod com f_seq, f_ctr U e as
 * quatro grades. Os campos não foram capturados.
 *
 * Inferido, todos menos título e ano: os campos são os que a tradução e a
 * partitura (os outros formulários GN_BIB do censo) têm iguais, e os do
 * detalhamento os de mesmo rótulo nelas (editora, cidade da editora, páginas,
 * ISSN/ISBN). Um campo que a página não tiver para o envio antes do POST, sem
 * nada gravado. A natureza, o DOI e a divulgação científica ficam à mão: nas
 * duas irmãs não há campo de DOI nem de divulgação, e a natureza tem códigos
 * próprios de cada tipo.
 */
const OUTRA_BIBLIOGRAFICA: ProductionTarget = {
  element: 'OUTRA-PRODUCAO-BIBLIOGRAFICA',
  fields: {
    ...bibBasics('DADOS-BASICOS-DE-OUTRA-PRODUCAO'),
    ...under('DETALHAMENTO-DE-OUTRA-PRODUCAO', {
      'CIDADE-DA-EDITORA': 'f_cidade',
      EDITORA: 'f_editora',
      'ISSN-ISBN': 'f_issn',
      'NUMERO-DE-PAGINAS': 'f_paginas',
    }),
    ...INFO_EN,
  },
  form: { action: 'PRC_BIB_OUTRAPROD', name: 'GN_BIB' },
  grids: [...ALL_GRIDS],
  id: 'outra-bibliografica',
  list: {
    formProc: 'prc_bib_outraprod',
    params: { f_cod_tipo: '1Z' },
    proc: 'prc_bib_demais_lista',
  },
  manual: under('DADOS-BASICOS-DE-OUTRA-PRODUCAO', {
    DOI: NOT_CAPTURED,
    'FLAG-DIVULGACAO-CIENTIFICA': NOT_CAPTURED,
    NATUREZA: NOT_CAPTURED,
    'NATUREZA-INGLES': NOT_CAPTURED,
  }),
  title: { attr: 'TITULO', child: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO' },
};

export const DEMAIS_TARGETS: ProductionTarget[] = [TRADUCAO, PARTITURA, OUTRA_BIBLIOGRAFICA];
