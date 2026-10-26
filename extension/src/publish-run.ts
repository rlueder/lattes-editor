// O envio ao CNPq no service worker (src/bridge/publish.ts): recusa com
// PUBLISH_ENABLED desligado, um por vez, e nunca junto com a fila, a
// conferência do contrato, a foto ou o Importar, que usam a mesma sessão e a
// mesma aba. A checagem e a marcação acontecem sem await entre elas.

import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import {
  isPublishRequest,
  PUBLISH_ENABLED,
  publishBusy,
  type PublishRequest,
  type PublishResult,
} from '../../src/bridge/publish.ts';
import { readSendScreenReply, sendPublish } from './lattes-tab.ts';
import { readState } from './state.ts';

let inFlight = false;

/** Há um envio ao CNPq em andamento: a fila, a foto e o Importar esperam. */
export const publishRunning = (): boolean => inFlight;

export interface PublishCall {
  /** O id do pedido, que volta na resposta. */
  id: string;
  lattesId?: string;
  request: PublishRequest;
  today: string;
}

/**
 * Roda o envio pedido pelo editor e manda o resultado (a mensagem
 * "publicacao", com o id do pedido) por send. busy é o estado em memória lido
 * logo antes da chamada. Devolve se chegou a rodar na aba (para o menu ser
 * relido). enabled existe para os testes.
 */
export async function runPublish(
  call: PublishCall,
  busy: { importing: boolean; photo: boolean; queue: boolean; verifying: boolean },
  send: (msg: Extract<BridgeMessage, { type: 'publicacao' }>) => Promise<void>,
  enabled = PUBLISH_ENABLED,
): Promise<boolean> {
  const reply = (result: PublishResult) => send({ id: call.id, result, type: 'publicacao' });
  if (!enabled) {
    await reply({ detail: 'O envio ao CNPq pelo editor está desligado.', outcome: 'desligado' });
    return false;
  }
  if (!isPublishRequest(call.request)) {
    await reply({
      detail: 'O pedido de envio está incompleto ou tem um valor inválido. Nada foi enviado.',
      outcome: 'erro',
    });
    return false;
  }
  // A declaração é da pessoa: sem ela marcada no editor, nem chega à aba.
  if (call.request.declarationAccepted !== true) {
    await reply({
      detail: 'A declaração não foi marcada; nada foi enviado.',
      outcome: 'declaracao',
    });
    return false;
  }
  const blocked = publishBusy({ ...busy, publishing: inFlight });
  if (blocked) {
    await reply(blocked);
    return false;
  }
  inFlight = true;
  try {
    let stored: Awaited<ReturnType<typeof readState>>;
    try {
      stored = await readState();
    } catch {
      // Sem ler o estado guardado, não dá para saber se a fila roda: nada sai,
      // e o editor recebe a resposta em vez de esperar o prazo.
      await reply({
        detail: 'A extensão não leu o próprio estado; nada foi enviado.',
        outcome: 'erro',
      });
      return false;
    }
    const persisted = publishBusy({
      importing: false,
      photo: false,
      publishing: false,
      queue: stored.running,
      verifying: Boolean(stored.verificando),
    });
    if (persisted) {
      await reply(persisted);
      return false;
    }
    await reply(await sendPublish({ request: call.request, today: call.today }, call.lattesId));
    return true;
  } finally {
    inFlight = false;
  }
}

/**
 * Responde aos pedidos de envio ao CNPq do editor: a tela de envio (só
 * leitura, nunca no meio de uma gravação) e o envio. Devolve true quando a
 * mensagem era uma delas (já respondida), false para as outras.
 */
export async function answerPublishRequest(
  msg: EditorMessage,
  locks: { importing: boolean; photo: boolean; queue: boolean; verifying: boolean },
  io: { busy: () => Promise<boolean>; send: (msg: BridgeMessage) => Promise<void> },
): Promise<boolean> {
  if (msg.type === 'ler-envio') {
    const reply = (await io.busy())
      ? {
          detail: 'O conector está gravando no Lattes; tente de novo quando terminar.',
          reason: 'ocupado' as const,
        }
      : await readSendScreenReply();
    await io.send({ ...reply, id: msg.id, type: 'tela-envio' });
    return true;
  }
  if (msg.type !== 'publicar') return false;
  // Sem await entre ler a trava (locks, lida pelo service worker logo antes)
  // e runPublish marcar o envio em andamento.
  await runPublish(msg, locks, io.send);
  return true;
}
