// Todas as listas do currículo no Lattes, pelos links do menu e das páginas de
// cada atuação, só por GET. As regras de achar as listas e ler as linhas estão
// em src/census/test-ledger.ts. A comparação com a exportação
// (src/review/lists-diff.ts) e a base dos itens de teste usam esta leitura.

import { listKey, type ListSnapshot, listUrls, nestedUrls, rowsOf } from '../census/test-ledger.ts';

/** Um endereço com f_ctr é ação (incluir, excluir), nunca leitura. */
const ACTION = /[?&]f_ctr=/i;

const withCode = (url: string, code: string) =>
  /[?&]f_cod=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}f_cod=${code}`;

/** As listas que o menu abre e as de dentro delas, cada uma pela chave sem o f_cod. */
export async function snapshotCvLists(
  menuHtml: string,
  code: string,
  get: (path: string) => Promise<string>,
): Promise<ListSnapshot> {
  // Endereço de ação nem é pedido: a lista fica de fora e a seção dela sai
  // como não comparada, em vez de a leitura inteira falhar.
  const read = (url: string) => get(withCode(url, code));
  const out: ListSnapshot = {};
  for (const url of listUrls(menuHtml).filter((u) => !ACTION.test(u))) {
    const html = await read(url);
    if (/404 Not Found|Bad Request/.test(html)) continue;
    out[listKey(url)] = rowsOf(html);
    for (const inner of nestedUrls(html).filter((u) => !ACTION.test(u))) {
      out[listKey(inner)] = rowsOf(await read(inner));
    }
  }
  return out;
}
