// Demais trabalhos e licenças, as duas listas do menu que o motor ainda não
// conhecia. Campos: censo de 15/10/2026 (docs/lattes-formularios/), o
// formulário de inclusão de cada uma, que é o mesmo da edição. A ligação com
// o atributo do XML é pelo nome e pelo rótulo do campo (inferida).

import { formDate } from '../../create-registro-rules.ts';
import { byTable, country, language, media, yesNo } from '../mappers.ts';
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
 * O tipo da licença no formulário (f_tipo_licenca: M, P, A, censo de
 * 15/10/2026). O XSD só tem MATERNIDADE; PATERNIDADE e ADOCAO são inferidos
 * pelo rótulo da opção.
 */
const LICENSE_TYPES = { ADOCAO: 'A', MATERNIDADE: 'M', PATERNIDADE: 'P' };

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
    'TIPO-LICENCA': { field: 'f_tipo_licenca', toForm: byTable(LICENSE_TYPES) },
  }),
  form: { action: 'PKG_LICENCA.FORM', name: 'GN_LICENCA' },
  grids: [],
  id: 'licenca',
  list: { formProc: 'pkg_licenca.form', proc: 'pkg_licenca.lista' },
  title: {
    attr: 'TIPO-LICENCA',
    child: 'LICENCA',
    field: 'f_tipo_licenca',
    toForm: (v) => LICENSE_TYPES[v as keyof typeof LICENSE_TYPES] ?? v,
  },
  year: {
    attr: 'DATA-INICIO-LICENCA',
    child: 'LICENCA',
    field: 'f_dta_inicio',
    toForm: (v) => formDate(v) ?? v,
  },
};

export const DEMAIS_TARGETS: ProductionTarget[] = [DEMAIS_TRABALHOS, LICENCA];
