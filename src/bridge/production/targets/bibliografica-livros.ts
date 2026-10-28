// Livros e textos em jornais ou revistas. Nome do <form>, POST, nomes dos
// campos e valores das opções: censo de 15/10/2026 (censo-2026-10-15.json).
// Como nos artigos (bibliografica-artigos.ts), nenhum item destes tipos estava
// na exportação do dono: a ligação de cada atributo com o campo é Inferido,
// pelo rótulo do campo no censo, e também o link de edição de cada linha da
// lista (o formulário de inclusão com f_seq).
//
// O capítulo de livro está na mesma lista dos livros; o formulário dele
// (PKG_LVR_CAP.FORM_CAP, GN_CAP) foi lido em 18/10/2026, na inclusão que a
// escolha "Capítulo" da lista abre.

import type { Change } from '../../../model/changes.ts';
import { getAttr, type XElement } from '../../../model/xml.ts';
import { byTable, country, date, language, media, yesNo } from '../mappers.ts';
import type { FieldMap, ProductionTarget } from '../types.ts';
import { ALL_GRIDS, under } from './bibliografica-comum.ts';

/**
 * A natureza do livro pelo tipo: o dominio() da página (lido em 26/10/2026)
 * oferece, para 131, 1 Coletânea, 2 Texto integral, 3 Verbete e 4 Outro, e,
 * para 133, 5 Livro, 6 Anais, 7 Catálogo, 8 Coletânea, 9 Enciclopédia,
 * 10 Periódico e 11 Outro. O atribui() grava em f_cod_sub_prod só o primeiro
 * caractere do código, então 10 e 11 chegam como 1: Periódico e o Outro da
 * organização ficam à mão. Inferido: o valor do XML pelo rótulo da opção.
 */
const BOOK_NATURE: Record<string, Record<string, string>> = {
  LIVRO_ORGANIZADO_OU_EDICAO: {
    ANAIS: '6',
    CATALOGO: '7',
    COLETANEA: '8',
    ENCICLOPEDIA: '9',
    LIVRO: '5',
    NAO_INFORMADO: '',
  },
  LIVRO_PUBLICADO: {
    COLETANEA: '1',
    NAO_INFORMADO: '',
    OUTRA: '4',
    TEXTO_INTEGRAL: '2',
    VERBETE: '3',
  },
};

const BOOK_NATURE_BY_HAND =
  'a natureza não tem código para este tipo de livro no formulário do Lattes (Periódico e o Outro da organização chegam cortados); troque no Lattes';

/**
 * A natureza vai pelo código do tipo do livro, o de antes para conferir e o
 * de agora para gravar. Trocar só o tipo leva junto o código da natureza.
 */
function bookNature(
  change: Change,
  el: XElement,
):
  | {
      also: { after: string; before: string; field: string; label: string }[];
      fields: Record<string, FieldMap>;
    }
  | { reason: string } {
  const typeChange = change.fields.find((f) => f.attr === 'TIPO');
  const natureChange = change.fields.find((f) => f.attr === 'NATUREZA');
  const typeAfter = getAttr(el, 'TIPO') ?? '';
  const typeBefore = typeChange?.before ?? typeAfter;
  const code = (type: string, nature: string) => BOOK_NATURE[type]?.[nature];
  const fields: Record<string, FieldMap> = {
    NATUREZA: {
      field: 'f_cod_sub_prod',
      toForm: (v, side) => code(side === 'before' ? typeBefore : typeAfter, v),
      unmapped: `Natureza: ${BOOK_NATURE_BY_HAND}`,
    },
  };
  if (!typeChange || natureChange) return { also: [], fields };
  const nature = getAttr(el, 'NATUREZA') ?? '';
  const after = code(typeAfter, nature);
  const before = code(typeBefore, nature);
  if (after === undefined || before === undefined) {
    return { reason: `Tipo: ${BOOK_NATURE_BY_HAND}; escolha também uma natureza do tipo novo` };
  }
  return {
    also: after === before ? [] : [{ after, before, field: 'f_cod_sub_prod', label: 'Natureza' }],
    fields,
  };
}

/**
 * Livro publicado ou organizado (GN_LIVRO, POST PKG_LVR_CAP.FORM_LVR), na
 * lista pkg_lvr_cap.lista (catálogo de menus do reconhecimento). Inferido: o
 * tipo pelos rótulos de F_COD_PROD (131 "Livro publicado", 133 "Organização de
 * obra publicada"). A natureza vai pelo código em f_cod_sub_prod
 * (BOOK_NATURE); o texto dela (f_sub_prod) é desabilitado e não vai no envio.
 */
const LIVRO: ProductionTarget = {
  doi: { duplicate: true },
  element: 'LIVRO-PUBLICADO-OU-ORGANIZADO',
  fields: {
    ...under('DADOS-BASICOS-DO-LIVRO', {
      ANO: 'f_ano',
      DOI: 'f_cod_doi',
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
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_LVR_CAP.FORM_LVR', name: 'GN_LIVRO' },
  grids: [...ALL_GRIDS],
  id: 'livro',
  list: { formProc: 'PKG_LVR_CAP.FORM_LVR', proc: 'pkg_lvr_cap.lista' },
  partFields: { 'DADOS-BASICOS-DO-LIVRO': bookNature },
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
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_TEXTO.FORM', name: 'GN_TEXTO' },
  grids: [...ALL_GRIDS],
  id: 'texto-jornal',
  list: { formProc: 'pkg_texto.form', proc: 'pkg_texto.lista' },
  title: { attr: 'TITULO-DO-TEXTO', child: 'DADOS-BASICOS-DO-TEXTO' },
  year: { attr: 'ANO-DO-TEXTO', child: 'DADOS-BASICOS-DO-TEXTO' },
};

/**
 * Capítulo de livro publicado (GN_CAP, POST PKG_LVR_CAP.FORM_CAP), na lista
 * pkg_lvr_cap.lista. Campos e limites: o formulário de inclusão lido em
 * 18/10/2026. Inferido, como no livro: a ligação de cada atributo pelo
 * rótulo do campo, que a alteração use o mesmo formulário com f_seq, e o
 * link de cada linha da lista. O tipo do capítulo vem num oculto
 * (F_COD_PROD) e não se escolhe.
 */
const CAPITULO: ProductionTarget = {
  // O capítulo confere só o formato do DOI, num campo de texto.
  doi: { duplicate: false },
  element: 'CAPITULO-DE-LIVRO-PUBLICADO',
  fields: {
    ...under('DADOS-BASICOS-DO-CAPITULO', {
      ANO: 'f_ano',
      DOI: 'f_cod_doi',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
      'PAIS-DE-PUBLICACAO': { field: 'f_pais', toForm: country },
      'TITULO-DO-CAPITULO-DO-LIVRO': 'f_titulo_cap',
      'TITULO-DO-CAPITULO-DO-LIVRO-INGLES': 'f_titulo_cap_en',
    }),
    ...under('DETALHAMENTO-DO-CAPITULO', {
      'CIDADE-DA-EDITORA': 'f_cidade_ed',
      ISBN: 'f_isbn',
      'NOME-DA-EDITORA': 'f_editora',
      'NUMERO-DA-EDICAO-REVISAO': 'f_edicao',
      'NUMERO-DA-SERIE': 'f_serie',
      'NUMERO-DE-VOLUMES': 'f_volume_c',
      ORGANIZADORES: 'f_organizadores',
      'PAGINA-FINAL': 'f_pag_fim',
      'PAGINA-INICIAL': 'f_pag_ini',
      'TITULO-DO-LIVRO': 'f_titulo',
    }),
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_LVR_CAP.FORM_CAP', name: 'GN_CAP' },
  grids: [...ALL_GRIDS],
  id: 'capitulo',
  list: { formProc: 'PKG_LVR_CAP.FORM_CAP', proc: 'pkg_lvr_cap.lista' },
  manual: {
    // F_COD_PROD oculto, sem controle na página (seção 16): o capítulo se
    // inclui pela escolha "Capítulo" na lista de livros.
    'DADOS-BASICOS-DO-CAPITULO@TIPO':
      'o tipo vem fixo num oculto do formulário: é o tipo do item no Lattes; para trocar, inclua o item de novo no tipo certo',
  },
  // f_titulo é o título do livro; o do capítulo é f_titulo_cap.
  title: {
    attr: 'TITULO-DO-CAPITULO-DO-LIVRO',
    child: 'DADOS-BASICOS-DO-CAPITULO',
    field: 'f_titulo_cap',
  },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DO-CAPITULO' },
};

export const LIVRO_TARGETS: ProductionTarget[] = [LIVRO, CAPITULO, TEXTO];
