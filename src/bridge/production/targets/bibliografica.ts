// Produções bibliográficas. Campos e opções: censo de 15/10/2026
// (docs/lattes-formularios/); ver tecnica.ts para a fonte das ligações.

import type { ProductionTarget } from '../types.ts';

const ALL_GRIDS = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l'] as const;

/**
 * Outra produção bibliográfica (GN_BIB, POST PRC_BIB_OUTRAPROD). Observado
 * em 16/10/2026 no Lattes real, só por GET: a lista prc_bib_demais_lista com
 * f_cod_tipo=1Z, o formulário prc_bib_outraprod com f_seq, f_ctr U e as
 * quatro grades.
 */
const OUTRA_BIBLIOGRAFICA: ProductionTarget = {
  element: 'OUTRA-PRODUCAO-BIBLIOGRAFICA',
  fields: {
    'DADOS-BASICOS-DE-OUTRA-PRODUCAO@ANO': 'f_ano',
    'DADOS-BASICOS-DE-OUTRA-PRODUCAO@TITULO': 'f_titulo',
  },
  form: { action: 'PRC_BIB_OUTRAPROD', name: 'GN_BIB' },
  grids: [...ALL_GRIDS],
  id: 'outra-bibliografica',
  list: {
    formProc: 'prc_bib_outraprod',
    params: { f_cod_tipo: '1Z' },
    proc: 'prc_bib_demais_lista',
  },
  title: { attr: 'TITULO', child: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO' },
};

export const BIBLIOGRAFICA_TARGETS: ProductionTarget[] = [OUTRA_BIBLIOGRAFICA];
