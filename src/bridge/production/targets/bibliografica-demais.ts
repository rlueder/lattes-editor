// Os demais tipos de produção bibliográfica, na lista prc_bib_demais_lista,
// um f_cod_tipo por tipo (1A tradução, 1B partitura, 1Z outra produção; seções
// 16 e 17 de lattes_internals.md). Tradução e partitura: nome do <form>, POST,
// campos e opções do censo de 15/10/2026, com a ligação atributo → campo
// Inferido pelo rótulo (nenhum item na exportação do dono), e o link de
// edição de cada linha também (o formulário de inclusão com f_seq).
//
// O prefácio e o posfácio: a lista é f_cod_tipo=1C (link do menu "Prefácio,
// posfácio") e o formulário, prc_bib_prefacio, lidos em 18/10/2026.

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

/**
 * As informações adicionais, nos dois idiomas. O f_ref não estava na captura
 * de 15/10/2026 e está na de 27/10/2026, em todos estes formulários.
 */
const INFO_EN = {
  'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
  'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
};

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

const NO_FIELD = 'O formulário de outra produção bibliográfica do Lattes não tem campo para';

/**
 * Outra produção bibliográfica (GN_BIB, POST PRC_BIB_OUTRAPROD), na lista
 * prc_bib_demais_lista com f_cod_tipo=1Z. O formulário foi lido por GET em
 * 26/10/2026, na inclusão e numa alteração: título, ano, país, idioma, meio,
 * home page, relevância (F_RELEV), divulgação científica
 * (F_STA_DIVULGACAO_CIENTIFICA, S/N), natureza em texto livre (f_natureza; o
 * dominio() da página só sugere "Trabalho de Conclusão de Curso"), editora,
 * cidade, páginas, ISSN/ISBN, f_ref e os textos em inglês. Não há campo de
 * DOI nem de natureza em inglês. Inferido: que a alteração grave os mesmos
 * campos com f_seq, como nas irmãs.
 */
const OUTRA_BIBLIOGRAFICA: ProductionTarget = {
  element: 'OUTRA-PRODUCAO-BIBLIOGRAFICA',
  fields: {
    ...bibBasics('DADOS-BASICOS-DE-OUTRA-PRODUCAO'),
    ...under('DADOS-BASICOS-DE-OUTRA-PRODUCAO', {
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      NATUREZA: 'f_natureza',
    }),
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
    DOI: `${NO_FIELD} DOI`,
    'NATUREZA-INGLES': `${NO_FIELD} a natureza em inglês`,
  }),
  title: { attr: 'TITULO', child: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO' },
};

/**
 * Prefácio, posfácio, apresentação ou introdução (GN_BIB, POST
 * PRC_BIB_PREFACIO), na lista prc_bib_demais_lista com f_cod_tipo=1C.
 * Campos, limites e opções: o formulário de inclusão lido em 18/10/2026; o
 * tipo e a natureza pelos rótulos das opções (F_COD_PROD 1C1 a 1C4, f_sub_tipo
 * com o espaço no fim do valor). Inferido, como nas irmãs: a ligação de cada
 * atributo pelo rótulo, que a alteração use o mesmo formulário com f_seq, e o
 * link de cada linha. O formulário não tem DOI.
 */
const PREFACIO: ProductionTarget = {
  element: 'PREFACIO-POSFACIO',
  fields: {
    ...under('DADOS-BASICOS-DO-PREFACIO-POSFACIO', {
      ANO: 'f_ano',
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
      NATUREZA: {
        field: 'f_sub_tipo',
        toForm: byTable({
          LIVRO: '31 ',
          NAO_INFORMADO: '',
          OUTRA: '33 ',
          REVISTAS_OU_PERIODICOS: '32 ',
        }),
      },
      'PAIS-DE-PUBLICACAO': { field: 'f_pais', toForm: country },
      TIPO: {
        field: 'F_COD_PROD',
        toForm: byTable({
          APRESENTACAO: '1C3',
          INTRODUCAO: '1C4',
          POSFACIO: '1C2',
          PREFACIO: '1C1',
        }),
      },
      TITULO: 'f_titulo',
      'TITULO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-PREFACIO-POSFACIO', {
      'CIDADE-DA-EDITORA': 'f_cidade',
      'EDITORA-DO-PREFACIO-POSFACIO': 'f_editora',
      FASCICULO: 'f_fasciculo',
      'ISSN-ISBN': 'f_issn',
      'NOME-DO-AUTOR-DA-PUBLICACAO': 'f_autor_trad',
      'NUMERO-DA-EDICAO-REVISAO': 'f_edicao',
      SERIE: 'f_serie',
      'TITULO-DA-PUBLICACAO': 'f_tit_obra',
      VOLUME: 'f_volume',
    }),
    ...INFO_EN,
  },
  form: { action: 'PRC_BIB_PREFACIO', name: 'GN_BIB' },
  grids: [...ALL_GRIDS],
  id: 'prefacio',
  list: {
    formProc: 'prc_bib_prefacio',
    params: { f_cod_tipo: '1C' },
    proc: 'prc_bib_demais_lista',
  },
  title: { attr: 'TITULO', child: 'DADOS-BASICOS-DO-PREFACIO-POSFACIO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DO-PREFACIO-POSFACIO' },
};

export const DEMAIS_TARGETS: ProductionTarget[] = [
  TRADUCAO,
  PARTITURA,
  PREFACIO,
  OUTRA_BIBLIOGRAFICA,
];
