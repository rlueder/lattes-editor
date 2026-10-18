// Os itens de teste da passada completa, pedidos pelo editor (só no canal
// Dev, docs/lattes-formularios/itens-de-teste.md). O service worker injeta o
// censo na página do menu do Lattes, no mundo da página (o envio usa o
// "Salvar" e a caixa de mensagens dela), e roda uma ação por pedido.

import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import { readCensusProgress, realLattesTab, runCensusInPage } from './lattes-tab.ts';

type TestItemsCall = Extract<EditorMessage, { type: 'itens-teste' }>;

let inFlight = false;

/** Há um lote de itens de teste em andamento: a fila e o resto esperam. */
export const testItemsRunning = (): boolean => inFlight;

/**
 * Responde a um pedido de itens de teste. busy: a fila, a verificação, a foto,
 * o Importar ou o envio ao CNPq usando a mesma aba agora.
 */
export async function answerTestItems(
  msg: TestItemsCall,
  busy: boolean,
  send: (m: Extract<BridgeMessage, { type: 'itens-teste' }>) => Promise<void>,
): Promise<void> {
  const reply = (r: { error?: string; result?: unknown }) =>
    send({ ...r, id: msg.id, type: 'itens-teste' });
  if (!__CANAL_DEV__) return reply({ error: 'Itens de teste só no canal Dev do conector' });
  // O andamento só lê o que a página guardou: roda mesmo com um lote correndo.
  if (msg.acao === 'andamento') {
    const tabId = await realLattesTab();
    if (tabId === undefined)
      return reply({ error: 'Abra o menu do Lattes (wwws.cnpq.br) numa aba' });
    return reply(await readCensusProgress(tabId));
  }
  if (inFlight || busy) return reply({ error: 'A extensão está usando a aba do Lattes agora' });
  inFlight = true;
  try {
    const tabId = await realLattesTab();
    if (tabId === undefined) {
      return await reply({ error: 'Abra o menu do Lattes (wwws.cnpq.br) numa aba' });
    }
    const result = await runCensusInPage(tabId, msg.acao, {
      batch: msg.batch,
      retryFailed: msg.retryFailed,
    });
    await reply(result);
  } catch (err) {
    await reply({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    inFlight = false;
  }
}
