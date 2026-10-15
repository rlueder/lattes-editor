// Tipos de produção que, com a inclusão pelo conector ligada
// (CREATE_ITEMS_ENABLED), deixam o arquivo do Importar e vão ao Lattes pela
// lista de alterações, incluídos pelo formulário do próprio Lattes (LAT-57).
// A decisão, com a evidência, está em docs/inclusao_por_tipo.md. Hoje são as
// participações em eventos (src/bridge/create-evento.ts).

import { CREATE_ITEMS_ENABLED } from '../bridge/create.ts';

export const DIRECT_INCLUSION_TYPES: ReadonlySet<string> = new Set([
  'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS',
  'PARTICIPACAO-EM-CONGRESSO',
  'PARTICIPACAO-EM-ENCONTRO',
  'PARTICIPACAO-EM-EXPOSICAO',
  'PARTICIPACAO-EM-FEIRA',
  'PARTICIPACAO-EM-OFICINA',
  'PARTICIPACAO-EM-OLIMPIADA',
  'PARTICIPACAO-EM-SEMINARIO',
  'PARTICIPACAO-EM-SIMPOSIO',
]);

const NONE: ReadonlySet<string> = new Set();

/** Os tipos que saem do Importar agora: nenhum enquanto a inclusão está desligada. */
export function directInclusion(enabled: boolean = CREATE_ITEMS_ENABLED): ReadonlySet<string> {
  return enabled ? DIRECT_INCLUSION_TYPES : NONE;
}
