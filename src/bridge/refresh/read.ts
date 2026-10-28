// "Atualizar do Lattes" na aba do Lattes: uma parte por tarefa do conector,
// abaixo do teto de pedidos do transporte (transport.ts). Só GET, e só
// endereços que passam por isSafeGet (src/census/run.ts): nenhum f_ctr,
// nenhum procedimento que grava. A primeira passada lê as listas do menu
// (cv-lists.ts); a seguinte, os formulários das linhas que o editor pediu,
// e só os dos tipos que a leitura conhece (coverage.ts).

import { isSafeGet } from '../../census/run.ts';
import { listKey, type ListSnapshot } from '../../census/test-ledger.ts';
import { cvListQueue, LISTS_PER_TASK, readListsPart } from '../cv-lists.ts';
import { type FormControl, withScriptValues } from '../form.ts';
import { isLogonPage } from '../lattes-html.ts';
import { type PageRequest, type PagesPart, readPages } from '../load/pages.ts';
import { GRID_SPECS, type Grids, readGrids } from '../production/grids.ts';
import type { GridField } from '../production/types.ts';
import { READ_CONCURRENCY } from '../transport.ts';
import { readableFormProcs } from './coverage.ts';

/** Formulários por tarefa: abaixo dos 100 pedidos do transporte, com folga. */
export const FORMS_PER_TASK = 80;

/** Uma linha a ler: o link do formulário e os nomes de <form> que ele pode ter. */
export interface FormRequest {
  forms: string[];
  link: string;
}

export type RefreshRequest =
  | { queue?: string[]; step: 'listas' }
  | { reads: FormRequest[]; step: 'formularios' }
  // "Carregar do Lattes" (src/bridge/load/): o menu da aba, e páginas como vieram.
  | { step: 'menu' }
  | { paths: PageRequest[]; step: 'paginas' };

/** O formulário de uma linha, como a página o mostra. */
export interface FormReading {
  /** Por que não veio: a página não tinha o formulário, ou o link não é de leitura. */
  error?: 'erro' | 'sem-formulario';
  /** O nome do <form> lido. */
  form?: string;
  /** As grades que a página escreve em script (autorProvider…), quando ela as tem. */
  grids?: Grids;
  link: string;
  /** Cada campo com o valor que a página mostra: o texto, a opção escolhida, o rádio marcado. */
  values?: Record<string, string>;
}

export type RefreshPart =
  | {
      /** A parte parou: a sessão caiu, ou a aba falhou. O que veio antes vale. */
      error?: string;
      forms: FormReading[];
      reason?: 'erro' | 'sessao';
      /** Os links que ficaram sem leitura. */
      rest: string[];
      step: 'formularios';
    }
  | {
      error?: string;
      lists: ListSnapshot;
      /** O que falta ler; vazio quando acabou. */
      queue: string[];
      reason?: 'erro' | 'sessao';
      step: 'listas';
      /** Chaves (listKey) das listas que falharam. */
      unread: string[];
    }
  | { html: string; step: 'menu' }
  | (PagesPart & { step: 'paginas' });

export interface RefreshPort {
  get(path: string): Promise<string>;
  /** Só para o POST de leitura de "Carregar do Lattes" (load/pages.ts). */
  post?(path: string, body: string): Promise<string>;
  readForm(html: string, formName: string): FormControl[] | undefined;
}

class SessionLost extends Error {}

const NEVER = new Set(['button', 'submit', 'reset', 'file', 'image']);

/** O valor de cada campo como a página mostra, inclusive os desabilitados. */
export function formValues(controls: FormControl[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of controls) {
    if (!c.name || NEVER.has(c.type)) continue;
    if (c.type === 'radio') {
      if (c.checked) out[c.name] = c.value;
      continue;
    }
    if (c.type === 'checkbox') {
      if (c.checked) out[c.name] = c.value;
      else out[c.name] ??= '';
      continue;
    }
    if (c.name in out) continue;
    out[c.name] =
      c.type === 'select' || c.type.startsWith('select-') ? (c.selected?.[0] ?? '') : c.value;
  }
  return out;
}

/** As grades que a página tem, cada uma lida à parte (a que falta não impede as outras). */
function pageGrids(html: string): Grids {
  const out: Grids = {};
  for (const field of Object.keys(GRID_SPECS) as GridField[]) {
    const read = readGrids(html, [field]);
    if (!('missing' in read)) out[field] = read[field];
  }
  return out;
}

/** O link é um formulário de alteração de um tipo lido, só por GET? */
function readableLink(link: string, procs: Set<string>): boolean {
  if (!isSafeGet(link)) return false;
  const [proc = '', query = ''] = link.split('?');
  return procs.has(proc.toLowerCase()) && Boolean(new URLSearchParams(query).get('f_seq'));
}

/** Um formulário: o primeiro dos nomes pedidos que a página tem. */
export function readFormPage(
  html: string,
  request: FormRequest,
  readForm: RefreshPort['readForm'],
): FormReading {
  for (const name of request.forms) {
    const controls = withScriptValues(html, readForm(html, name));
    if (controls) {
      return {
        form: name,
        grids: pageGrids(html),
        link: request.link,
        values: formValues(controls),
      };
    }
  }
  return { error: 'sem-formulario', link: request.link };
}

async function readForms(port: RefreshPort, reads: FormRequest[]): Promise<RefreshPart> {
  const procs = readableFormProcs();
  const forms: FormReading[] = [];
  const todo = reads.slice(0, FORMS_PER_TASK);
  const rest = reads.slice(FORMS_PER_TASK).map((r) => r.link);
  for (const [i, request] of todo.entries()) {
    if (!readableLink(request.link, procs)) {
      forms.push({ error: 'erro', link: request.link });
      continue;
    }
    try {
      const html = await port.get(request.link);
      if (isLogonPage(html)) throw new SessionLost();
      forms.push(readFormPage(html, request, port.readForm));
    } catch (err) {
      const left = [...todo.slice(i).map((r) => r.link), ...rest];
      if (err instanceof SessionLost) {
        return {
          error: 'A sessão do Lattes caiu.',
          forms,
          reason: 'sessao',
          rest: left,
          step: 'formularios',
        };
      }
      return {
        error: 'A aba do Lattes não respondeu.',
        forms,
        reason: 'erro',
        rest: left,
        step: 'formularios',
      };
    }
  }
  return { forms, rest, step: 'formularios' };
}

async function readLists(port: RefreshPort, menu: string, code: string, queue?: string[]) {
  let lost = false;
  const get = async (path: string) => {
    const html = await port.get(path);
    if (isLogonPage(html)) {
      lost = true;
      throw new SessionLost();
    }
    return html;
  };
  const start = queue ?? cvListQueue(menu);
  const part = await readListsPart(start.filter(isSafeGet), code, get, {
    max: LISTS_PER_TASK,
    skipFailed: true,
  });
  if (lost) {
    return {
      error: 'A sessão do Lattes caiu.',
      lists: {},
      queue: start,
      reason: 'sessao' as const,
      step: 'listas' as const,
      unread: start.map(listKey),
    };
  }
  return { ...part, step: 'listas' as const };
}

/** Uma parte da leitura, conforme o pedido do editor. */
export function readRefreshPart(
  port: RefreshPort,
  menu: string,
  code: string,
  request: RefreshRequest,
): Promise<RefreshPart> {
  switch (request.step) {
    case 'listas':
      return readLists(port, menu, code, request.queue);
    case 'formularios':
      return readForms(port, request.reads);
    case 'menu':
      return Promise.resolve({ html: menu, step: 'menu' });
    case 'paginas':
      return readPages(
        {
          get: (path) => port.get(path),
          post: port.post && ((path, body) => port.post!(path, body)),
        },
        request.paths,
        READ_CONCURRENCY,
      ).then((part) => ({
        ...part,
        step: 'paginas',
      }));
  }
}
