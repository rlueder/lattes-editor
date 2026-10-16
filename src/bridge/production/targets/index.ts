// O registro dos tipos que o motor de alteração no lugar conhece (types.ts),
// uma família por arquivo.

import type { ProductionTarget } from '../types.ts';
import { BIBLIOGRAFICA_TARGETS } from './bibliografica.ts';
import { ORIENTACOES_BANCAS_TARGETS } from './orientacoes-bancas.ts';
import { TECNICA_TARGETS } from './tecnica.ts';

export const PRODUCTION_TARGETS: ProductionTarget[] = [
  ...BIBLIOGRAFICA_TARGETS,
  ...TECNICA_TARGETS,
  ...ORIENTACOES_BANCAS_TARGETS,
];
