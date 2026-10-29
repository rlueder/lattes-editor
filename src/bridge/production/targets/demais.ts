// Demais trabalhos e licenças, as duas listas do menu que o motor ainda não
// conhecia. Campos: censo de 15/10/2026 (docs/lattes-formularios/), o
// formulário de inclusão de cada uma, que é o mesmo da edição. A ligação com
// o atributo do XML é pelo nome e pelo rótulo do campo (inferida).

import { licenseToForm } from '../../../schema/license-types.ts';
import { formDate } from '../../create-registro-rules.ts';
import { country, language, media, yesNo } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';
import { ALL_GRIDS, INFO, slashDate, under } from './comum-tecnica-artistica.ts';

const BASICS = 'DADOS-BASICOS-DE-DEMAIS-TRABALHOS';

/** Demais trabalhos (GN_DEMAIS, POST PKG_DEMAIS.FORM, lista pkg_demais.lista). */
const DEMAIS_TRABALHOS: ProductionTarget = {
  element: 'DEMAIS-TRABALHOS',
  fields: {
    ...under(BASICS, {
      ANO: 'f_ano',
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      'HOME-PAGE': 'f_homepage',
      IDIOMA: { field: 'F_IDIOMA', toForm: language },
      'MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
      NATUREZA: 'f_natureza',
      PAIS: { field: 'f_pais', toForm: country },
      TITULO: 'f_titulo',
      'TITULO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DE-DEMAIS-TRABALHOS', { FINALIDADE: 'f_finalidade', LOCAL: 'f_local' }),
    ...INFO,
  },
  form: { action: 'PKG_DEMAIS.FORM', name: 'GN_DEMAIS' },
  grids: [...ALL_GRIDS],
  id: 'demais-trabalhos',
  list: { formProc: 'pkg_demais.form', proc: 'pkg_demais.lista' },
  title: { attr: 'TITULO', child: BASICS },
  year: { attr: 'ANO', child: BASICS },
};

/**
 * Licença maternidade, paternidade e adoção (GN_LICENCA, POST
 * PKG_LICENCA.FORM, lista pkg_licenca.lista). O XML não traz número da
 * licença: a linha se acha pelo tipo e pela data de início.
 */
const LICENCA: ProductionTarget = {
  element: 'LICENCA',
  fields: under('LICENCA', {
    'DATA-FIM-LICENCA': { field: 'f_dta_fim', toForm: slashDate },
    'DATA-INICIO-LICENCA': { field: 'f_dta_inicio', toForm: slashDate },
    // Na exportação de 29/10/2026 (lattes_internals.md, seção 29).
    'DATA-NASCIMENTO-ADOCAO': { field: 'f_dta_nasc_adoc', toForm: slashDate },
    'TIPO-LICENCA': { field: 'f_tipo_licenca', toForm: licenseToForm },
  }),
  form: { action: 'PKG_LICENCA.FORM', name: 'GN_LICENCA' },
  grids: [],
  id: 'licenca',
  list: { formProc: 'pkg_licenca.form', proc: 'pkg_licenca.lista' },
  title: {
    attr: 'TIPO-LICENCA',
    child: 'LICENCA',
    field: 'f_tipo_licenca',
    toForm: (v) => licenseToForm(v) ?? v,
  },
  year: {
    attr: 'DATA-INICIO-LICENCA',
    child: 'LICENCA',
    field: 'f_dta_inicio',
    toForm: (v) => formDate(v) ?? v,
  },
};

const LINHA = 'LINHA-DE-PESQUISA';

/**
 * Linha de pesquisa (GN_LINHA, POST PKG_LINHAPESQ.FORM), lida em 19/10/2026
 * no Lattes real: a linha entra pela descrição de uma atividade de pesquisa e
 * desenvolvimento, e a lista pkg_linhapesq.lista traz cada uma com
 * F_SEQ_ATIV, F_SEQ_FUNCAO, F_SEQ_LINHA e F_CODINST. O formulário tem título,
 * objetivos (f_ref), se está ativa (f_status S ou N), os mesmos em inglês e
 * as grades de palavras-chave, áreas e setores. A linha não tem ano: a linha
 * da lista se acha pelo título e pelo número dela (f_seq_linha).
 */
const LINHA_PESQUISA: ProductionTarget = {
  element: LINHA,
  fields: under(LINHA, {
    'FLAG-LINHA-DE-PESQUISA-ATIVA': { field: 'f_status', toForm: yesNo },
    'OBJETIVOS-LINHA-DE-PESQUISA': 'f_ref',
    'OBJETIVOS-LINHA-DE-PESQUISA-INGLES': 'f_ref_en',
    'TITULO-DA-LINHA-DE-PESQUISA': 'f_titulo',
    'TITULO-DA-LINHA-DE-PESQUISA-INGLES': 'f_titulo_en',
  }),
  form: { action: 'PKG_LINHAPESQ.FORM', name: 'GN_LINHA' },
  grids: ['f_plv_l', 'f_setor_l', 'f_area_l'],
  id: 'linha-de-pesquisa',
  list: {
    formProc: 'pkg_linhapesq.form',
    isRow: (params) => Boolean(params.F_SEQ_LINHA ?? params.f_seq_linha),
    proc: 'pkg_linhapesq.lista',
  },
  title: { attr: 'TITULO-DA-LINHA-DE-PESQUISA', child: LINHA },
  year: { attr: 'SEQUENCIA-LINHA', child: LINHA, field: 'f_seq_linha' },
};

export const DEMAIS_TARGETS: ProductionTarget[] = [DEMAIS_TRABALHOS, LICENCA, LINHA_PESQUISA];
