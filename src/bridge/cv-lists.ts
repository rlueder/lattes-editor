// Todas as listas do currículo no Lattes, pelos links do menu e das páginas de
// cada atuação, só por GET. As regras de achar as listas e ler as linhas estão
// em src/census/test-ledger.ts. A comparação com a exportação
// (src/review/lists-diff.ts) e a base dos itens de teste usam esta leitura.

import { listKey, type ListSnapshot, listUrls, nestedUrls, rowsOf } from '../census/test-ledger.ts';

/** Um endereço com f_ctr é ação (incluir, excluir), nunca leitura. */
const ACTION = /[?&]f_ctr=/i;

/**
 * Listas por tarefa do conector. O transporte (transport.ts) para a tarefa
 * em 100 pedidos; um currículo real tem mais de 120 listas, então a leitura
 * vem em partes, cada uma numa tarefa.
 */
export const LISTS_PER_TASK = 60;

const withCode = (url: string, code: string) =>
  /[?&]f_cod=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}f_cod=${code}`;

/** As listas que o menu abre, na ordem, sem as ações. */
export function cvListQueue(menuHtml: string): string[] {
  return listUrls(menuHtml).filter((u) => !ACTION.test(u));
}

export interface ListsPart {
  lists: ListSnapshot;
  /** O que falta ler; vazio quando acabou. */
  queue: string[];
  /** Chaves (listKey) das listas que falharam: a seção delas não é comparada. */
  unread: string[];
}

/**
 * Lê até `max` listas da fila. As de dentro de uma lista (os vínculos de cada
 * atuação) entram no começo da fila. Com `skipFailed`, a que falha fica em
 * `unread` e a leitura segue; sem, o erro sobe.
 */
export async function readListsPart(
  queue: string[],
  code: string,
  get: (path: string) => Promise<string>,
  options: { max?: number; skipFailed?: boolean } = {},
): Promise<ListsPart> {
  const pending = [...queue];
  const lists: ListSnapshot = {};
  const unread: string[] = [];
  let reads = 0;
  while (pending.length > 0 && reads < (options.max ?? Infinity)) {
    const url = pending.shift()!;
    if (ACTION.test(url)) continue;
    reads++;
    let html: string;
    try {
      html = await get(withCode(url, code));
    } catch (error) {
      if (!options.skipFailed) throw error;
      unread.push(listKey(url));
      continue;
    }
    if (/404 Not Found|Bad Request/.test(html)) continue;
    lists[listKey(url)] = rowsOf(html);
    pending.unshift(...nestedUrls(html).filter((u) => !ACTION.test(u)));
  }
  return { lists, queue: pending, unread };
}

/** Todas as listas de uma vez; um erro de leitura sobe (a base dos itens de teste conta com isso). */
export async function snapshotCvLists(
  menuHtml: string,
  code: string,
  get: (path: string) => Promise<string>,
  keep: (url: string) => boolean = () => true,
): Promise<ListSnapshot> {
  return (await readListsPart(cvListQueue(menuHtml).filter(keep), code, get)).lists;
}
