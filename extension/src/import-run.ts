// O Importar pelo conector no service worker (src/bridge/importar.ts): recusa
// com IMPORT_ENABLED desligado, um por vez, e nunca junto com a fila ou com
// uma troca de foto, que usam a mesma sessão e a mesma aba.

import { IMPORT_ENABLED, importBusy, type ImportResult } from '../../src/bridge/importar.ts';
import { sendImport } from './lattes-tab.ts';

let inFlight = false;

/** Há um Importar em andamento: a fila e a foto esperam. */
export const importRunning = (): boolean => inFlight;

export interface ImportCall {
  file: string;
  fileName: string;
  lattesId?: string;
  modules: number[];
  oldestYear?: number;
}

/**
 * Roda o Importar pedido pelo editor e entrega o resultado em reply; depois,
 * after (o menu relido). enabled existe para os testes ligarem o fluxo.
 */
export async function runImport(
  call: ImportCall,
  busy: { photo: boolean; queue: boolean },
  reply: (result: ImportResult) => Promise<void>,
  after: () => Promise<void>,
  enabled = IMPORT_ENABLED,
): Promise<void> {
  if (!enabled) {
    return reply({ detail: 'O Importar pelo conector está desligado.', reason: 'desligado' });
  }
  const blocked = importBusy(busy.queue, busy.photo, inFlight);
  if (blocked) return reply(blocked);
  inFlight = true;
  try {
    await reply(await sendImport(call, call.lattesId));
    await after();
  } finally {
    inFlight = false;
  }
}
