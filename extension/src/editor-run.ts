// A fila que o editor manda e a gravação que ele pede ('gravar-pelo-editor'):
// o que fazer quando ela não pode começar. Pelo painel isso não acontece,
// porque o botão fica desabilitado nesses casos; o editor, sem resposta,
// ficaria em "gravando".

import type { OpResult } from '../../src/bridge/apply.ts';
import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import { type EditorEndpoint, type QueueState, readState, writeState } from './state.ts';

/** Quanto a gravação pedida pelo editor espera uma verificação em curso terminar. */
export const VERIFY_WAIT_MS = 60_000;

export const NO_CONSENT_TEXT =
  'Abra o painel da extensão e aceite o aviso de uso; depois envie de novo';
export const BUSY_TEXT =
  'O conector está ocupado com outra tarefa no Lattes; nada foi enviado. Tente de novo em instantes';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera enquanto busy for verdadeiro, até o prazo. A verificação automática
 * roda quando o menu do Lattes carrega, que é justamente quando a pessoa
 * costuma enviar.
 */
export async function waitWhile(
  busy: () => Promise<boolean>,
  ms = VERIFY_WAIT_MS,
  step = 500,
): Promise<void> {
  const deadline = Date.now() + ms;
  while ((await busy()) && Date.now() <= deadline) await sleep(step);
}

/** A primeira da fila ainda não conferida leva o motivo, e a rodada termina. */
export async function refuseRun(
  state: QueueState,
  detail: string,
  write: (next: QueueState) => Promise<void>,
  send: (msg: BridgeMessage) => Promise<void>,
): Promise<void> {
  const first = state.ops.find((op) => state.results[op.key]?.status !== 'conferido');
  if (first) {
    const result: OpResult = { detail, key: first.key, status: 'erro' };
    await write({ ...state, results: { ...state.results, [first.key]: result } });
    await send({ result, type: 'resultado' });
  }
  await send({ pause: state.pausa, type: 'fim' });
}

/**
 * Guarda a fila que o editor mandou, no lugar da anterior, se nenhuma estiver
 * correndo. Devolve se guardou.
 */
export async function enqueue(
  msg: Extract<EditorMessage, { type: 'enviar' }>,
  editor: EditorEndpoint,
): Promise<boolean> {
  if ((await readState()).running) return false;
  await writeState({
    editor,
    fromEditor: msg.start,
    lattesId: msg.lattesId,
    ops: msg.ops,
    results: {},
    running: false,
  });
  await chrome.action.setBadgeText({ text: msg.ops.length ? String(msg.ops.length) : '' });
  return true;
}
