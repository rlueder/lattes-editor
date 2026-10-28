// "Carregar do Lattes" na aba: só busca páginas. O editor pede uma leva de
// endereços, a aba busca cada um e devolve o HTML como veio; tudo o mais (que
// listas existem, que formulários abrir, como o formulário vira XML) fica no
// editor (loader.ts). Um GET só passa por isSafeGet (src/census/run.ts):
// nenhum f_ctr, nenhum procedimento que grava.
//
// A exceção é um POST de leitura: o segundo passo da formação complementar,
// que só abre pelo POST de PKG_FORMACAO_COMPL.FORM2 com o f_ctr vazio do
// formulário de edição. Esse POST não grava nada e responde com o segundo
// formulário (observado em 27/10/2026; formacao-compl-steps.ts). Só ele passa,
// e só com f_ctr vazio no corpo.

import { isSafeGet } from '../../census/run.ts';
import { isLogonPage } from '../lattes-html.ts';

/** Páginas por tarefa: abaixo dos 100 pedidos do transporte (transport.ts), com folga. */
export const PAGES_PER_TASK = 80;

/** Um endereço para GET, ou o POST de leitura do segundo passo. */
export type PageRequest = string | { body: string; path: string };

export interface PageRead {
  /** O corpo, quando foi o POST de leitura. */
  body?: string;
  /** Por que não veio: o endereço não é de leitura, ou a aba não respondeu a ele. */
  error?: 'erro' | 'inseguro';
  html?: string;
  path: string;
}

export interface PagesPart {
  error?: string;
  pages: PageRead[];
  /** A parte parou: a sessão caiu, ou a aba falhou. O que veio antes vale. */
  reason?: 'erro' | 'sessao';
  /** Os pedidos que ficaram sem leitura. */
  rest: PageRequest[];
}

export interface PagesPort {
  get(path: string): Promise<string>;
  post?(path: string, body: string): Promise<string>;
}

const READ_POST = /^PKG_FORMACAO_COMPL\.FORM2$/i;

/** O POST de leitura do segundo passo: o procedimento certo e um f_ctr, vazio. */
export function isReadPost(path: string, body: string): boolean {
  if (!READ_POST.test(path)) return false;
  const ctr = body.split('&').filter((p) => /^f_ctr=/i.test(p));
  return ctr.length === 1 && ctr[0]!.toLowerCase() === 'f_ctr=';
}

/** A chave de um pedido no mapa de páginas lidas (loader.ts). */
export const pageKey = (r: PageRequest | PageRead) =>
  typeof r === 'string' ? r : r.body === undefined ? r.path : `${r.path}\n${r.body}`;

/**
 * Uma leva de páginas, até PAGES_PER_TASK, com até `concurrency` pedidos ao
 * mesmo tempo (o transporte da aba os espaça, transport.ts). As páginas voltam
 * na ordem pedida; se a sessão cai ou a aba falha, o que já veio vale e o
 * resto volta em `rest`.
 */
export async function readPages(
  port: PagesPort | ((path: string) => Promise<string>),
  requests: readonly PageRequest[],
  concurrency = 1,
): Promise<PagesPart> {
  const p: PagesPort = typeof port === 'function' ? { get: port } : port;
  const todo = requests.slice(0, PAGES_PER_TASK);
  const done: (PageRead | undefined)[] = [];
  let stop: Pick<PagesPart, 'error' | 'reason'> | undefined;
  let next = 0;
  const one = async (i: number) => {
    const r = todo[i]!;
    const path = typeof r === 'string' ? r : r.path;
    const body = typeof r === 'string' ? undefined : r.body;
    const withBody = body === undefined ? {} : { body };
    const safe = body === undefined ? isSafeGet(path) : Boolean(p.post) && isReadPost(path, body);
    if (!safe) {
      done[i] = { error: 'inseguro', path, ...withBody };
      return;
    }
    let html: string;
    try {
      html = body === undefined ? await p.get(path) : await p.post!(path, body);
    } catch {
      stop ??= { error: 'A aba do Lattes não respondeu.', reason: 'erro' };
      return;
    }
    if (isLogonPage(html, path)) {
      stop ??= { error: 'A sessão do Lattes caiu.', reason: 'sessao' };
      return;
    }
    done[i] = { html, path, ...withBody };
  };
  const worker = async () => {
    while (!stop && next < todo.length) await one(next++);
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const pages = done.filter((x): x is PageRead => x !== undefined);
  const rest = [...todo.filter((_, i) => done[i] === undefined), ...requests.slice(PAGES_PER_TASK)];
  return stop ? { ...stop, pages, rest } : { pages, rest };
}
