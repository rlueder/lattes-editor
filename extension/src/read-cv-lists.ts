// Todas as listas do currículo para a comparação do diagnóstico, em partes
// (src/bridge/cv-lists.ts, uma parte por tarefa do conector, abaixo do limite
// de pedidos do transporte). Uma parte que falha deixa as listas dela, e as
// que faltavam, como não lidas: a página de conferência já lida não se perde.

import type { ListsPart } from '../../src/bridge/cv-lists.ts';
import { listKey, type ListSnapshot } from '../../src/census/test-ledger.ts';

/** Uma parte na aba: a fila em JSON (vazia na primeira, que começa pelo menu). */
export type RunPart = (args: string[]) => Promise<ListsPart | { error: string } | undefined>;

export async function readCvLists(
  run: RunPart,
): Promise<{ lists: ListSnapshot; listsUnread: string[] }> {
  const lists: ListSnapshot = {};
  const unread: string[] = [];
  let queue: string[] | undefined;
  do {
    let part: ListsPart | { error: string } | undefined;
    try {
      part = await run(queue ? [JSON.stringify(queue)] : []);
    } catch {
      part = undefined;
    }
    if (!part || 'error' in part) {
      // Sem a primeira parte, nada se sabe das listas: todas não lidas.
      unread.push(...(queue ? queue.map(listKey) : ['*']));
      break;
    }
    Object.assign(lists, part.lists);
    unread.push(...part.unread);
    queue = part.queue;
  } while (queue.length > 0);
  return { lists, listsUnread: unread };
}
