// O Importar pelo conector no service worker (src/bridge/importar.ts): recusa
// com IMPORT_ENABLED desligado, um por vez, e nunca junto com a fila, a
// conferência do contrato ou uma troca de foto, que usam a mesma sessão e a
// mesma aba. A checagem e a marcação acontecem sem await entre elas.

import { IMPORT_ENABLED, importBusy, type ImportResult } from '../../src/bridge/importar.ts';
import type { BridgeMessage } from '../../src/bridge/protocol.ts';
import { sendImport } from './lattes-tab.ts';
import { readState } from './state.ts';

let inFlight = false;

/** Há um Importar em andamento: a fila e a foto esperam. */
export const importRunning = (): boolean => inFlight;

export interface ImportCall {
  file: string;
  fileName: string;
  /** O id do pedido, que volta na resposta. */
  id: string;
  lattesId?: string;
  modules: number[];
  oldestYear?: number;
}

/**
 * Roda o Importar pedido pelo editor e manda o resultado (a mensagem
 * "importacao", com o id do pedido) por send. busy é o estado em memória lido
 * logo antes da chamada: daqui até marcar o Importar em andamento não há
 * await; só depois vem a leitura do estado guardado da fila. Devolve se chegou a rodar na aba (para o menu ser relido). enabled
 * existe para os testes.
 */
export async function runImport(
  call: ImportCall,
  busy: { photo: boolean; queue: boolean; verifying: boolean },
  send: (msg: Extract<BridgeMessage, { type: 'importacao' }>) => Promise<void>,
  enabled = IMPORT_ENABLED,
): Promise<boolean> {
  const reply = (result: ImportResult) => send({ ...result, id: call.id, type: 'importacao' });
  if (!enabled) {
    await reply({ detail: 'O Importar pelo conector está desligado.', reason: 'desligado' });
    return false;
  }
  const blocked = importBusy({ ...busy, importing: inFlight });
  if (blocked) {
    await reply(blocked);
    return false;
  }
  inFlight = true;
  try {
    // Marcado o Importar, o estado guardado também conta: depois de o service
    // worker reiniciar no meio de uma fila, só ele sabe que ela ainda roda.
    const stored = await readState();
    const persisted = importBusy({
      importing: false,
      photo: false,
      queue: stored.running,
      verifying: Boolean(stored.verificando),
    });
    if (persisted) {
      await reply(persisted);
      return false;
    }
    await reply(await sendImport(call, call.lattesId));
    return true;
  } finally {
    inFlight = false;
  }
}
