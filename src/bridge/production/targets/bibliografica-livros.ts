// Livros e textos em jornais ou revistas. Nome do <form>, POST, nomes dos
// campos e valores das opções: censo de 15/10/2026 (censo-2026-10-15.json).
// Como nos artigos (bibliografica-artigos.ts), nenhum item destes tipos estava
// na exportação do dono: a ligação de cada atributo com o campo é Inferido,
// pelo rótulo do campo no censo, e também o link de edição de cada linha da
// lista (o formulário de inclusão com f_seq).
//
// O capítulo de livro fica fora: está na mesma lista dos livros, mas o censo
// só capturou o formulário do livro (PKG_LVR_CAP.FORM_LVR), e o do capítulo
// não foi lido.

import { byTable, country, date, language, media, yesNo } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';
import { ALL_GRIDS, DOI_MANUAL, under } from './bibliografica-comum.ts';

/**
 * Livro publicado ou organizado (GN_LIVRO, POST PKG_LVR_CAP.FORM_LVR), na
 * lista pkg_lvr_cap.lista (catálogo de menus do reconhecimento). Inferido: o
 * tipo pelos rótulos de F_COD_PROD (131 "Livro publicado", 133 "Organização de
 * obra publicada"). A natureza fica à mão: o f_sub_prod é texto com o código
 * num oculto (f_cod_sub_prod), e as opções dele não foram lidas.
 */
const LIVRO: ProductionTarget = {
  element: 'LIVRO-PUBLICADO-OU-ORGANIZADO',
  fields: {
    ...under('DADOS-BASICOS-DO-LIVRO', {
      ANO: 'f_ano',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
      'PAIS-DE-PUBLICACAO': { field: 'f_pais', toForm: country },
      TIPO: {
        field: 'F_COD_PROD',
        toForm: byTable({ LIVRO_ORGANIZADO_OU_EDICAO: '133', LIVRO_PUBLICADO: '131' }),
      },
      'TITULO-DO-LIVRO': 'f_titulo',
      'TITULO-DO-LIVRO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-LIVRO', {
      'CIDADE-DA-EDITORA': 'f_cidade_ed',
      ISBN: 'f_isbn',
      'NOME-DA-EDITORA': 'f_editora',
      'NUMERO-DA-EDICAO-REVISAO': 'f_edicao',
      'NUMERO-DA-SERIE': 'f_serie',
      'NUMERO-DE-PAGINAS': 'f_paginas',
      'NUMERO-DE-VOLUMES': 'f_volume_l',
    }),
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_LVR_CAP.FORM_LVR', name: 'GN_LIVRO' },
  grids: [...ALL_GRIDS],
  id: 'livro',
  list: { formProc: 'PKG_LVR_CAP.FORM_LVR', proc: 'pkg_lvr_cap.lista' },
  manual: {
    'DADOS-BASICOS-DO-LIVRO@DOI': DOI_MANUAL,
    'DADOS-BASICOS-DO-LIVRO@NATUREZA':
      'a natureza do livro no Lattes sai de uma escolha cujas opções o censo não leu',
  },
  title: { attr: 'TITULO-DO-LIVRO', child: 'DADOS-BASICOS-DO-LIVRO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DO-LIVRO' },
};

/**
 * Texto em jornal ou revista (GN_TEXTO, POST PKG_TEXTO.FORM), na lista
 * pkg_texto.lista da captura de 13/10/2026. Inferido: a natureza pelos
 * rótulos de F_COD_PROD (141 "Jornal de notícias", 142 "Revista (Magazine)") e
 * a data de publicação como dd/mm/aaaa no f_data (limite de 10 caracteres,
 * como as datas dos outros formulários). O formulário não tem DOI.
 */
const TEXTO: ProductionTarget = {
  element: 'TEXTO-EM-JORNAL-OU-REVISTA',
  fields: {
    ...under('DADOS-BASICOS-DO-TEXTO', {
      'ANO-DO-TEXTO': 'f_ano',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
      NATUREZA: {
        field: 'F_COD_PROD',
        toForm: byTable({ JORNAL_DE_NOTICIAS: '141', REVISTA_MAGAZINE: '142' }),
      },
      'PAIS-DE-PUBLICACAO': { field: 'f_pais', toForm: country },
      'TITULO-DO-TEXTO': 'f_titulo',
      'TITULO-DO-TEXTO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-TEXTO', {
      'DATA-DE-PUBLICACAO': { field: 'f_data', toForm: date },
      ISSN: 'f_issn',
      'LOCAL-DE-PUBLICACAO': 'f_local',
      'PAGINA-FINAL': 'f_pag_fim',
      'PAGINA-INICIAL': 'f_pag_ini',
      'TITULO-DO-JORNAL-OU-REVISTA': 'f_titulo_periodico',
      VOLUME: 'f_volume',
    }),
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_TEXTO.FORM', name: 'GN_TEXTO' },
  grids: [...ALL_GRIDS],
  id: 'texto-jornal',
  list: { formProc: 'pkg_texto.form', proc: 'pkg_texto.lista' },
  title: { attr: 'TITULO-DO-TEXTO', child: 'DADOS-BASICOS-DO-TEXTO' },
  year: { attr: 'ANO-DO-TEXTO', child: 'DADOS-BASICOS-DO-TEXTO' },
};

export const LIVRO_TARGETS: ProductionTarget[] = [LIVRO, TEXTO];
