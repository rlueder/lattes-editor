// "Carregar do Lattes": o currículo montado do zero pelas listas e pelos
// formulários do próprio Lattes, sem a exportação. As listas do menu dizem que
// itens existem; o formulário de alteração de cada item dá os valores, pelas
// mesmas especificações com que o conector grava, ao contrário. Campo que
// nenhum formulário mostra não entra: o editor mostra o que o Lattes deixa
// ver e alterar.
//
// A aba só busca páginas (pages.ts). Cada seção (sections/) diz que páginas
// quer e o que fazer com elas; o que uma seção não consegue ler fica em
// `gaps`, com o motivo, em vez de sumir calado.

import { listKey, listUrls, nestedUrls } from '../../census/test-ledger.ts';
import { element, type XDocument, type XElement } from '../../model/xml.ts';
import type { FormControl } from '../form.ts';
import { cvCodeFrom, lattesIdFrom } from '../lattes-html.ts';
import { pageKey, type PageRequest, type PagesPart } from './pages.ts';
import { SECTIONS } from './sections/index.ts';

export interface LoadPort {
  /** O menu do currículo, como a aba o mostra. */
  menu(): Promise<string>;
  /** Uma leva de páginas (pages.ts, na aba). */
  pages(requests: PageRequest[]): Promise<PagesPart>;
  readForm(html: string, formName: string): FormControl[] | undefined;
}

/** O que não foi lido, por seção, com o motivo. */
export interface LoadGap {
  count: number;
  reason: string;
  section: string;
}

export interface LoadProgress {
  done: number;
  phase: 'formularios' | 'listas' | 'menu';
  total?: number;
}

export interface LoadResult {
  doc?: XDocument;
  gaps: LoadGap[];
  /** Páginas lidas. */
  pages: number;
  /** A leitura parou no meio: nada é carregado. */
  stopped?: { error: string; reason: 'erro' | 'sessao' };
}

class Stopped extends Error {
  readonly reason: 'erro' | 'sessao';
  constructor(reason: 'erro' | 'sessao', error: string) {
    super(error);
    this.reason = reason;
  }
}

/** O que cada seção recebe: as listas lidas, a busca de páginas e onde escrever. */
export interface LoadContext {
  code: string;
  /** Busca páginas, em levas, pela chave de cada pedido (pageKey); o que não veio fica fora. */
  fetch(requests: PageRequest[]): Promise<Map<string, string>>;
  gap(section: string, reason: string, count?: number): void;
  /** As listas lidas, pela chave (listKey), com o endereço e o HTML. */
  lists: Map<string, { html: string; url: string }>;
  menu: string;
  readForm: LoadPort['readForm'];
  root: XElement;
}

export interface LoadSection {
  id: string;
  load(ctx: LoadContext): Promise<void>;
}

const withCode = (url: string, code: string) =>
  /[?&]f_cod=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}f_cod=${code}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** A raiz como a exportação a escreve, com o identificador e a hora da leitura. */
function rootOf(lattesId: string, now: Date): XElement {
  return element('CURRICULO-VITAE', {
    'DATA-ATUALIZACAO': `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`,
    'HORA-ATUALIZACAO': `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    'NUMERO-IDENTIFICADOR': lattesId,
    'SISTEMA-ORIGEM-XML': 'LATTES_FORMULARIOS',
  });
}

export async function loadCvFromLattes(
  port: LoadPort,
  options: { now?: Date; onProgress?: (p: LoadProgress) => void } = {},
): Promise<LoadResult> {
  const gaps: LoadGap[] = [];
  let pages = 0;
  const progress = options.onProgress ?? (() => undefined);
  const fetch = async (requests: PageRequest[]) => {
    const out = new Map<string, string>();
    let todo = [...new Map(requests.map((r) => [pageKey(r), r])).values()];
    while (todo.length > 0) {
      const part = await port.pages(todo);
      for (const p of part.pages) if (p.html !== undefined) out.set(pageKey(p), p.html);
      pages += part.pages.length;
      progress({ done: pages, phase: 'formularios' });
      if (part.reason) throw new Stopped(part.reason, part.error ?? 'A leitura parou.');
      todo = part.rest;
    }
    return out;
  };
  try {
    progress({ done: 0, phase: 'menu' });
    const menu = await port.menu().catch((err: unknown) => {
      throw new Stopped(
        'erro',
        err instanceof Error ? err.message : 'A aba do Lattes não respondeu.',
      );
    });
    const code = cvCodeFrom(menu);
    const lattesId = lattesIdFrom(menu);
    if (!code || !lattesId) {
      return {
        gaps,
        pages,
        stopped: { error: 'O menu do Lattes não trouxe o currículo.', reason: 'erro' },
      };
    }
    // As listas do menu e as de dentro delas (a página de cada atuação).
    const lists = new Map<string, { html: string; url: string }>();
    let queue = listUrls(menu).map((u) => withCode(u, code));
    while (queue.length > 0) {
      const read = await fetch(queue);
      const next: string[] = [];
      for (const url of queue) {
        const html = read.get(url);
        if (html === undefined) continue;
        lists.set(listKey(url), { html, url });
        next.push(...nestedUrls(html).map((u) => withCode(u, code)));
      }
      queue = next.filter((u) => !lists.has(listKey(u)));
      progress({ done: pages, phase: 'listas' });
    }
    const root = rootOf(lattesId, options.now ?? new Date());
    const ctx: LoadContext = {
      code,
      fetch,
      gap: (section, reason, count = 1) => {
        const known = gaps.find((g) => g.section === section && g.reason === reason);
        if (known) known.count += count;
        else gaps.push({ count, reason, section });
      },
      lists,
      menu,
      readForm: port.readForm,
      root,
    };
    for (const section of SECTIONS) await section.load(ctx);
    const doc: XDocument = {
      epilog: '\n',
      prolog: '<?xml version="1.0" encoding="ISO-8859-1" standalone="no" ?>\n',
      root,
    };
    return { doc, gaps, pages };
  } catch (err) {
    if (err instanceof Stopped) {
      return { gaps, pages, stopped: { error: err.message, reason: err.reason } };
    }
    throw err;
  }
}
