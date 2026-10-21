// A fila que o editor manda e a gravação que ele pede ('gravar-pelo-editor'):
// o que fazer quando ela não pode começar. Pelo painel isso não acontece,
// porque o botão fica desabilitado nesses casos; o editor, sem resposta,
// ficaria em "gravando".

import type { OpResult } from '../../src/bridge/apply.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import { UNKNOWN_WRITE } from '../../src/bridge/write-brake.ts';
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
 * Uma fila do editor sendo guardada, ou uma rodada pedida por ele que ainda
 * não marcou running: run() pode esperar até um minuto por uma verificação
 * antes de começar, e um segundo pedido nesse meio trocaria a fila da
 * primeira. A trava é tomada antes do primeiro await, porque os awaits de
 * dois pedidos quase juntos se intercalam.
 */
let editorRunPending = false;

/**
 * Guarda a fila que o editor mandou, no lugar da anterior, se nenhuma estiver
 * correndo. Devolve se guardou. Com true e `start`, a trava fica tomada para
 * quem chamou soltar quando a rodada terminar.
 */
export async function enqueue(
  msg: Extract<EditorMessage, { type: 'enviar' }>,
  editor: EditorEndpoint,
): Promise<boolean> {
  if (editorRunPending) return false;
  editorRunPending = true;
  let keep = false;
  try {
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
    keep = msg.start === true;
    return true;
  } finally {
    if (!keep) editorRunPending = false;
  }
}

/**
 * A rodada que ficou "correndo" porque o service worker morreu no meio dela:
 * termina aqui, ao acordar. A primeira que faltava vira divergente, porque não
 * dá para saber se ela gravou; o editor recebe o resultado e o fim, e sai do
 * "gravando".
 */
export async function endDeadRound(
  state: QueueState,
  write: (next: QueueState) => Promise<void>,
  send: (msg: BridgeMessage) => Promise<void>,
): Promise<void> {
  const first = state.ops.find((op) => state.results[op.key]?.status !== 'conferido');
  const result: OpResult | undefined = first && {
    detail: `O conector reiniciou no meio da gravação; ${UNKNOWN_WRITE}`,
    key: first.key,
    status: 'divergente',
  };
  const results = result ? { ...state.results, [result.key]: result } : state.results;
  await write({ ...state, results, running: false });
  if (result) await send({ result, type: 'resultado' });
  await send({ pause: state.pausa, type: 'fim' });
}

/**
 * Os resultados da última fila de novo, para o editor que recarregou no meio
 * dela: o que chegou com a página fechando se perdeu. O editor só registra os
 * que ainda esperava (src/ui/outgoing-store.ts). Com a fila parada, o fim
 * também.
 */
export async function replayResults(
  { pausa, results, running }: QueueState,
  send: (m: BridgeMessage) => Promise<void>,
): Promise<void> {
  for (const result of Object.values(results)) {
    await send({ replay: true, result, type: 'resultado' });
  }
  // A fila já parou: o fim também pode ter se perdido (o editor que recarregou,
  // ou o service worker que acordou e encerrou a rodada antes de o editor
  // conectar), e sem ele o editor fica "gravando".
  if (!running) await send({ pause: pausa, type: 'fim' });
}

/** Uma gravação ainda corre na extensão quando o editor pede outra. */
export const RUNNING_TEXT =
  'A extensão ainda está gravando a rodada anterior; espere ela terminar e envie de novo';

/**
 * O pedido de gravação que chega com outra rodada correndo: a fila dela fica
 * como está, e o editor recebe o porquê e o fim, em vez de ficar "gravando"
 * sem resposta. Nada vai para o estado guardado.
 */
export async function refuseBusy(
  ops: readonly BridgeOp[],
  send: (m: BridgeMessage) => Promise<void>,
): Promise<void> {
  const first = ops[0];
  if (first)
    await send({
      result: { detail: RUNNING_TEXT, key: first.key, status: 'erro' },
      type: 'resultado',
    });
  await send({ type: 'fim' });
}

/** O pedido de gravação do editor: entra na fila e começa, ou volta recusado com o porquê. */
export async function handleSend(
  msg: Extract<EditorMessage, { type: 'enviar' }>,
  editor: EditorEndpoint,
  run: (keys: undefined, fromEditor: true) => Promise<void>,
  send: (m: BridgeMessage) => Promise<void>,
): Promise<void> {
  if (await enqueue(msg, editor)) {
    if (!msg.start) return;
    void run(undefined, true).finally(() => {
      editorRunPending = false;
    });
  } else if (msg.start) await refuseBusy(msg.ops, send);
}
