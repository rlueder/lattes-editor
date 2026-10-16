// O que o editor mandou à extensão e ainda espera de volta, guardado neste
// navegador por currículo. Só na memória, um recarregamento da página no meio
// de uma rodada perdia a ligação entre o resultado e a alteração, e a
// gravação não entrava no registro do enviado (teste acompanhado de
// 16/10/2026: a formação gravada no Lattes continuou "nova" no editor). Com o
// que está aqui, a extensão repete os resultados na reconexão e o editor
// registra os que ainda esperava.

import type { BridgeOp } from '../bridge/plan.ts';
import type { Change } from '../model/changes.ts';

/** O que foi mandado em cada chave da fila, para registrar quando voltar. */
export interface Outgoing {
  change?: Change;
  op: BridgeOp;
  undoOf?: number;
}

const keyOf = (lattesId: string) => `lattes-editor:envio-em-curso:${lattesId}`;

export function loadOutgoing(lattesId: string | undefined): Map<string, Outgoing> {
  if (!lattesId) return new Map();
  try {
    const raw = localStorage.getItem(keyOf(lattesId));
    const entries = raw ? (JSON.parse(raw) as [string, Outgoing][]) : [];
    return new Map(Array.isArray(entries) ? entries : []);
  } catch {
    // Armazenamento bloqueado ou conteúdo estragado: começa vazio.
    return new Map();
  }
}

export function saveOutgoing(lattesId: string | undefined, map: Map<string, Outgoing>): void {
  if (!lattesId) return;
  try {
    if (map.size === 0) localStorage.removeItem(keyOf(lattesId));
    else localStorage.setItem(keyOf(lattesId), JSON.stringify([...map]));
  } catch {
    // Sem armazenamento, fica só na memória, como antes.
  }
}
