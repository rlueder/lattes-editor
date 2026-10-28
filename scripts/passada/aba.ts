// O que as partes da passada (passada-ponte-entry.ts) dividem na aba do
// Lattes: o estado entre chamadas, as leituras com o passo de leitura, a foto
// das listas e a porta do conector.

import { type LattesPort } from '../../src/bridge/apply.ts';
import { readFormInPage } from '../../src/bridge/form-dom.ts';
import { cvCodeFrom } from '../../src/bridge/lattes-html.ts';
import type { LoadResult } from '../../src/bridge/load/loader.ts';
import { LattesTransport, READ_PACE } from '../../src/bridge/transport.ts';
import {
  listKey,
  type ListSnapshot,
  listUrls,
  nestedUrls,
  rowsOf,
} from '../../src/census/test-ledger.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { decodeLatin1 } from '../../src/model/latin1.ts';
import type { XElement } from '../../src/model/xml.ts';
import type { Variant } from './variantes.ts';

/** O que aconteceu com cada variante enviada: no passo 3 nova, já existente, ou não listada. */
export type Fate = 'confirmada' | 'existente' | 'fora-do-passo-3' | 'formulario';

export interface State {
  base?: ListSnapshot;
  exported?: XElement;
  /** Os tipos que o exercitar já tentou e não conferiram: não se repetem. */
  failedTypes?: string[];
  fates?: Record<string, Fate>;
  /** As variantes que incluir() já tentou pelo formulário. */
  formTried?: string[];
  lastSnapshot?: ListSnapshot;
  loaded?: LoadResult;
  seen?: Record<string, string[]>;
  step3?: { html: string; modules: number[]; request: string };
  traffic?: LattesTransport;
  variants?: Variant[];
}
export const state = ((globalThis as unknown as { __carregarEstado?: State }).__carregarEstado ??=
  {});

export const text = (bytes: ArrayBuffer) => decodeLatin1(new Uint8Array(bytes));

/** Leituras com o passo de leitura, uma tarefa por chamada. */
export function reading<T>(work: (get: (p: string) => Promise<string>) => Promise<T>): Promise<T> {
  const traffic = (state.traffic ??= new LattesTransport());
  return traffic.run(
    () =>
      work(async (p) => {
        const res = await traffic.request(new URL(p, location.href), { credentials: 'include' });
        return text((await traffic.bytes(res)).buffer as ArrayBuffer);
      }),
    undefined,
    READ_PACE,
  );
}

const withCode = (url: string, code: string) =>
  /[?&]f_cod=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}f_cod=${code}`;

/** Todas as listas do menu e as de dentro delas, como a base do teste (test-ledger.ts). */
export async function snapshot(): Promise<ListSnapshot> {
  const menu = document.documentElement.outerHTML;
  const code = cvCodeFrom(menu) ?? '';
  const lists: ListSnapshot = {};
  const queue = listUrls(menu).map((u) => withCode(u, code));
  while (queue.length > 0) {
    const part = queue.splice(0, 80);
    const next: string[] = [];
    await reading(async (get) => {
      for (const url of part) {
        const html = await get(url);
        lists[listKey(url)] = rowsOf(html);
        next.push(...nestedUrls(html).map((u) => withCode(u, code)));
      }
    });
    queue.push(...next.filter((u) => !(listKey(u) in lists)));
  }
  return lists;
}

/** A variante no texto de uma linha: o tipo e o número depois da marca. */
export const TAG = new RegExp(`${TEST_MARK} ([A-Z0-9-]+ v\\d+)`);

/** A porta do conector na aba, com o transporte das gravações (como conector-ponte-entry.ts). */
export function connectorPort(traffic: LattesTransport): LattesPort {
  const request = (path: string, init?: RequestInit) =>
    traffic.request(new URL(path, location.href), { credentials: 'include', ...init });
  const textOf = async (res: Response) => decodeLatin1(await traffic.bytes(res));
  return {
    get: async (path) => textOf(await request(path)),
    menuHtml: () => document.documentElement.outerHTML,
    post: async (path, body) =>
      textOf(
        await request(path, {
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
        }),
      ),
    readForm: readFormInPage,
  };
}
