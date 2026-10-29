// "Atualizar do Lattes" no service worker (src/bridge/refresh/): uma parte da
// leitura por pedido do editor, só GET, nunca junto de uma gravação ou de
// outra tarefa na aba. O editor confere de qual currículo é a sessão pelo
// lattesId da resposta.

import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import { LATTES_REFRESH_ENABLED } from '../../src/bridge/refresh/enabled.ts';
import type { RefreshRequest } from '../../src/bridge/refresh/read.ts';
import { hasConsent } from './consent.ts';
import { BUSY_TEXT } from './editor-run.ts';
import { lattesTab, type Reply, runInTab } from './lattes-tab.ts';

type PartReply = Omit<Reply<'leitura-lattes'>, 'id'>;

/** Uma parte na aba (lattes-runner.ts, lerLattes), só com o "ok" do aviso e a chave ligada. */
export async function readLattesPart(
  request: RefreshRequest,
  enabled = LATTES_REFRESH_ENABLED,
): Promise<PartReply> {
  if (!enabled) return { error: 'A leitura pelos formulários está desligada.', reason: 'erro' };
  if (!(await hasConsent())) return { reason: 'consentimento' };
  const tabId = await lattesTab();
  if (tabId === undefined) return { reason: 'sem-aba' };
  const failed: PartReply = { error: 'A aba do Lattes não respondeu.', reason: 'erro' };
  try {
    const reply = await runInTab<PartReply>(tabId, 'lerLattes', JSON.stringify(request));
    if (!reply) return failed;
    return reply.part ? reply : { ...reply, reason: 'erro' };
  } catch {
    return failed;
  }
}

/** Responde ao pedido "ler-lattes"; ocupado, a resposta diz isso sem tocar na aba. */
export async function answerRefresh(
  msg: Extract<EditorMessage, { type: 'ler-lattes' }>,
  busy: () => Promise<boolean>,
  send: (msg: BridgeMessage) => Promise<void>,
): Promise<void> {
  const reply: PartReply = (await busy())
    ? { error: BUSY_TEXT, reason: 'ocupado' }
    : await readLattesPart(msg.request);
  await send({ ...reply, id: msg.id, type: 'leitura-lattes' });
}
