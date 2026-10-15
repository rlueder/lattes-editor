// Tipos de produção que, com a inclusão pelo conector ligada
// (CREATE_ITEMS_ENABLED), deixam o arquivo do Importar e vão ao Lattes pela
// lista de alterações, incluídos pelo formulário do próprio Lattes (LAT-57).
// A decisão, com a evidência, está em docs/inclusao_por_tipo.md. Hoje são as
// participações em eventos (src/bridge/create-evento.ts).
//
// Só saem do Importar quando a extensão ligada anuncia 'incluir-itens' (a
// mesma capacidade que leva o planejamento a incluir pelo conector, plan.ts):
// com uma extensão mais antiga, ou sem extensão, o evento novo fica no
// Importar. E um evento que o formulário de eventos não leva (participantes
// além da pessoa, campos que o formulário não tem) volta ao Importar quando
// o Importar o leva, isto é, com a própria pessoa entre os participantes.

import { CREATE_ITEMS_ENABLED } from '../bridge/create.ts';
import { eventCarriedByImport, eventoProblem } from '../bridge/create-evento.ts';
import type { XElement } from './xml.ts';

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

// A capacidade da extensão ligada, avisada pelo aperto de mão (use-bridge.ts).
let canInclude = false;
const listeners = new Set<() => void>();

/** A extensão ligada anunciou 'incluir-itens' (ou deixou de anunciar). */
export function setIncludeCapability(on: boolean): void {
  if (on === canInclude) return;
  canInclude = on;
  for (const listener of listeners) listener();
}

export const includeCapability = (): boolean => canInclude;

/**
 * Segue as capacidades da extensão ligada: sem extensão (lista vazia) ou com
 * uma que não anuncia 'incluir-itens', o evento novo volta ao Importar.
 */
export const syncIncludeCapability = (features: readonly string[]): void =>
  setIncludeCapability(features.includes('incluir-itens'));

export function subscribeIncludeCapability(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Os tipos que saem do Importar agora: nenhum enquanto a inclusão está
 * desligada ou a extensão ligada não a anuncia.
 */
export function directInclusion(
  enabled: boolean = CREATE_ITEMS_ENABLED && canInclude,
): ReadonlySet<string> {
  return enabled ? DIRECT_INCLUSION_TYPES : NONE;
}

/**
 * O item novo deste tipo vai pelo formulário, e não pelo Importar? Com a raiz
 * do currículo, só quando o formulário o leva, ou quando o Importar também
 * não levaria (aí vai à mão pela lista de alterações, com o motivo). Sem a
 * raiz (só para o texto de um cartão), vale o tipo.
 */
export function goesDirect(
  el: XElement,
  direct: ReadonlySet<string> = directInclusion(),
  root?: XElement,
): boolean {
  if (!direct.has(el.name)) return false;
  if (!root) return true;
  return !eventoProblem(el, root) || !eventCarriedByImport(el, root);
}
