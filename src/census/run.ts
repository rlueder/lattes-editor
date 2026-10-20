// O censo em si (LAT-55): abre, só com GET, o formulário de inclusão de cada
// entrada de targets.ts e guarda o registro sem valores do currículo. Roda na
// aba do Lattes, na sessão de quem está logado (extension/src/censo.ts), ou
// contra o Lattes simulado nos testes. Nunca envia formulário: a porta só tem
// GET, e cada caminho passa por isSafeGet antes.

import { findLinks, isLogonPage, lattesIdFrom, type LattesLink } from '../bridge/lattes-html.ts';
import {
  type CensusField,
  type CensusOption,
  type CensusPage,
  censusPage,
  pageLinks,
  pageScripts,
  publicPath,
} from './census-page.ts';
import type { FieldLink, LinkSummary } from './link.ts';
import type { CensusTarget, LattesPath, Provenance } from './targets.ts';
import { CENSUS_TARGETS } from './targets-production.ts';

export interface CensusPort {
  get(path: string): Promise<{ html: string; status: number; url: string }>;
  menuHtml(): Promise<string> | string;
  wait?(ms: number): Promise<void>;
}

export type EntryStatus =
  'desconhecido' | 'erro' | 'nao-encontrado' | 'nao-lido' | 'ok' | 'sem-formulario' | 'sem-link';

export interface CensusEntry {
  detail?: string;
  elements: string[];
  elementsProvenance: Provenance;
  id: string;
  label: string;
  /** Os endereços do Lattes que a página abre (só em inspectPages). */
  links?: string[];
  page?: CensusPage;
  /** Caminho aberto, sem o código do currículo nem números de item. */
  path?: string;
  provenance: Provenance;
  /** Os scripts da página, como ids de CensusFile.scripts (só com a opção scripts). */
  scripts?: string[];
  /** Quando a página não trouxe formulário: tamanho e contagem de tags, sem texto. */
  shape?: Record<string, number>;
  source: string;
  status: EntryStatus;
}

export interface CensusOptions {
  collector?: string;
  /** Pausa entre pedidos, para não pesar no Lattes. */
  delayMs?: number;
  /** Lê também as listas do menu e anota inclusões que targets.ts não tem (sem abri-las). */
  discover?: boolean;
  now?: () => Date;
  /** Textos a esconder se aparecerem num rótulo (o próprio nome, por exemplo). */
  redact?: string[];
  /**
   * Guarda também os scripts da própria página de cada formulário, sem dado
   * pessoal (census-page.ts, pageScripts), para ler o que a página monta antes
   * de enviar (a grade de datas da patente, as máscaras de data, o check()).
   */
  scripts?: boolean;
  targets?: CensusTarget[];
  /** Só as entradas com esses ids (ou que começam com eles). */
  only?: string[];
}

export interface CensusFile {
  capturedAt: string;
  collector: string;
  /** Inclusões achadas nas listas do menu que nenhuma entrada cobre (só com discover). */
  discovered?: string[];
  entries: CensusEntry[];
  format: 1;
  /** A sessão caiu no meio: as entradas que faltavam ficam como não lidas. */
  interrupted?: boolean;
  /** Ligações campo e atributo da passada de edição (link.ts). */
  /** Por que a passada de edição parou, quando parou (sessão caída, exportação recusada). */
  linkError?: string;
  links?: FieldLink[];
  /** O que a passada de edição leu em cada entrada (itens lidos, casados, ambíguos). */
  linkSummary?: LinkSummary[];
  /** Listas de opções longas, guardadas uma vez e citadas pelo nome nos campos. */
  lists: Record<string, CensusOption[]>;
  origin: string;
  /** Scripts das páginas (opção scripts), guardados uma vez e citados pelo id nas entradas. */
  scripts?: Record<string, string>;
}

export class SessionLost extends Error {
  constructor() {
    super('A sessão do Lattes caiu');
  }
}

/**
 * Procedimento e query, cortando só no primeiro "?": split('?', 2) do JS
 * descarta o que vem depois de um segundo "?", e um f_ctr ali passaria.
 */
export function splitAtQuery(path: string): [string, string] {
  const i = path.indexOf('?');
  return i < 0 ? [path, ''] : [path.slice(0, i), path.slice(i + 1)];
}

/** Procedimentos que gravam, publicam ou saem: o censo nunca os abre, nem por GET. */
const UNSAFE_PROC =
  /publicar|importa|impcv|upload|logon|logout|sair|enviar|salvar|exclu|seta_ultimo|verifica|_ajax|existe_email/i;

/** Um GET que não grava: procedimento seguro e sem f_ctr de operação (E2 apaga por GET). */
export function isSafeGet(path: string): boolean {
  const [proc, query] = splitAtQuery(path);
  if (UNSAFE_PROC.test(proc)) return false;
  return !/(^|[&?])f_ctr=[^&?]/i.test(query);
}

/** O caminho com os parâmetros dados trocados (ou acrescentados). */
export function withParams(path: string, set: Record<string, string>): string {
  const [proc, query] = splitAtQuery(path);
  const parts = query.split('&').filter(Boolean);
  for (const [k, v] of Object.entries(set)) {
    const i = parts.findIndex((p) => p.split('=')[0]!.toLowerCase() === k.toLowerCase());
    if (i >= 0) parts[i] = `${k}=${v}`;
    else parts.push(`${k}=${v}`);
  }
  return `${proc}?${parts.join('&')}`;
}

export function buildPath(code: string, at: LattesPath): string {
  const params = [
    ...(at.noCode ? [] : [`f_cod=${code}`]),
    ...Object.entries(at.params).map(([k, v]) => `${k}=${v}`),
  ];
  return params.length ? `${at.proc}?${params.join('&')}` : at.proc;
}

/**
 * A forma de uma página que não trouxe formulário, para entender depois o
 * que veio: tamanho e contagem de algumas tags, sem texto nenhum.
 */
export function pageShape(html: string): Record<string, number> {
  const count = (tag: string) => (html.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
  return {
    bytes: html.length,
    form: count('form'),
    frame: count('frame') + count('frameset'),
    iframe: count('iframe'),
    input: count('input'),
    script: count('script'),
    select: count('select'),
  };
}

const NETWORK_RETRY_MS = 2000;

/** Links para o procedimento numa página, sem o próprio procedimento da lista. */
function linksTo(html: string, proc: string, exclude: string[] = []): LattesLink[] {
  const skip = new Set(exclude.map((p) => p.toLowerCase()));
  return findLinks(html, proc).filter(
    (l) => !skip.has(l.proc.toLowerCase()) && !/\.(lista|ordenar)$/i.test(l.proc),
  );
}

/** O link de inclusão: sem o número do item e sem operação. */
export function inclusionLink(links: LattesLink[], itemKey: string): LattesLink | undefined {
  return links.find((l) => !l.params[itemKey.toLowerCase()] && !l.params.f_ctr);
}

/**
 * A lista do menu para esta entrada (o menu tem os parâmetros reais), ou a
 * declarada em targets.ts quando o menu não a linka.
 */
export function listPath(menu: string, code: string, list: LattesPath): string {
  const want = Object.entries(list.params).map(([k, v]) => [k.toLowerCase(), v] as const);
  const hit = findLinks(menu, list.proc).find(
    (l) =>
      l.proc.toLowerCase() === list.proc.toLowerCase() &&
      want.every(([k, v]) => l.params[k] === v) &&
      !l.params.f_sta_divulgacao_cientifica &&
      !l.params.f_sta_inovacao,
  );
  return hit?.path ?? buildPath(code, list);
}

export class CensusReader {
  private code: string;
  private delayMs: number;
  private menu: string | undefined;
  private port: CensusPort;

  constructor(port: CensusPort, code: string, delayMs: number) {
    this.port = port;
    this.code = code;
    this.delayMs = delayMs;
  }

  /** Pausa antes de repetir um pedido que falhou na rede (nada, quando não há pausa entre pedidos). */
  get retryDelay(): number {
    return this.delayMs > 0 ? NETWORK_RETRY_MS : 0;
  }

  async menuHtml(): Promise<string> {
    this.menu ??= await this.port.menuHtml();
    return this.menu;
  }

  /** GET conferido: recusa caminho inseguro e reconhece a sessão caída. */
  async get(path: string): Promise<{ html: string; status: number }> {
    if (!isSafeGet(path)) throw new Error(`Caminho recusado pelo censo: ${path.split('?')[0]}`);
    if (this.delayMs > 0) await (this.port.wait?.(this.delayMs) ?? sleep(this.delayMs));
    const res = await this.port.get(path);
    if (isLogonPage(res.html, res.url)) throw new SessionLost();
    return res;
  }

  /** Onde abrir o formulário de inclusão da entrada, ou por que não deu. */
  async locate(t: CensusTarget): Promise<{ path?: string; status?: EntryStatus }> {
    const loc = t.locate;
    if (loc.kind === 'unknown') return { status: 'desconhecido' };
    if (loc.kind === 'fixed') return { path: buildPath(this.code, loc) };
    if (loc.kind === 'menu') {
      const link = findLinks(await this.menuHtml(), loc.proc)[0];
      return link ? { path: link.path } : { status: 'sem-link' };
    }
    if (!t.list) return { status: 'sem-link' };
    let page = (await this.get(listPath(await this.menuHtml(), this.code, t.list))).html;
    if (t.via) {
      const via = findLinks(page, t.via)[0];
      if (!via) return { status: 'sem-link' };
      page = (await this.get(via.path)).html;
    }
    const link = inclusionLink(linksTo(page, loc.proc, [t.list.proc]), t.itemKey);
    if (!link) return { status: 'sem-link' };
    return { path: loc.set ? withParams(link.path, loc.set) : link.path };
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function selected(targets: CensusTarget[], only?: string[]): CensusTarget[] {
  if (!only?.length) return targets;
  return targets.filter((t) => only.some((o) => t.id === o || t.id.startsWith(`${o}-`)));
}

function splitPath(path: string): { params: Record<string, string>; proc: string } {
  const [proc, query] = splitAtQuery(path);
  const params = Object.fromEntries(
    query
      .split('&')
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf('=');
        return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
      }),
  );
  return { params, proc };
}

/** O caminho como vai para o arquivo: sem o código do currículo nem números de item. */
export function publicOf(path: string): string {
  const { params, proc } = splitPath(path);
  return publicPath(proc, params);
}

/** Chave para comparar caminhos: sem caixa e com os parâmetros em ordem. */
export function pathKey(path: string): string {
  const { params, proc } = splitPath(publicOf(path));
  const sorted = Object.entries(params)
    .map(([k, v]) => `${k.toLowerCase()}=${v}`)
    .sort();
  return [proc.toLowerCase(), ...sorted].join('&');
}

/** Abre e registra uma entrada. Sessão caída sobe; o resto vira status. */
export async function readEntry(
  reader: CensusReader,
  t: CensusTarget,
  redact: string[],
  code: string,
  extras: { links?: boolean; scripts?: boolean } = {},
): Promise<CensusEntry & { scriptText?: string[] }> {
  const base = pending(t);
  try {
    const where = await reader.locate(t);
    if (!where.path) {
      const note = t.locate.kind === 'unknown' ? t.locate.note : undefined;
      return { ...base, detail: note, status: where.status ?? 'sem-link' };
    }
    const path = publicOf(where.path);
    // Uma falha de rede isolada ("Failed to fetch" no aperfeiçoamento, 15/10/2026)
    // ganha uma segunda tentativa; a sessão caída não.
    const res = await reader.get(where.path).catch(async (err: unknown) => {
      if (err instanceof SessionLost) throw err;
      await sleep(reader.retryDelay);
      return reader.get(where.path!);
    });
    if (res.status === 404) {
      return { ...base, path, shape: pageShape(res.html), status: 'nao-encontrado' };
    }
    const page = censusPage(res.html, redact);
    const fields = page.forms.reduce((n, f) => n + f.fields.length + f.hidden.length, 0);
    const more = {
      ...(extras.links ? { links: pageLinks(res.html) } : {}),
      ...(extras.scripts ? { scriptText: pageScripts(res.html, redact) } : {}),
    };
    if (!fields) {
      return { ...base, ...more, path, shape: pageShape(res.html), status: 'sem-formulario' };
    }
    return { ...base, ...more, page, path, status: 'ok' };
  } catch (err) {
    if (err instanceof SessionLost) throw err;
    return {
      ...base,
      // O detalhe vai para o arquivo versionado: sem o código do currículo.
      detail: err instanceof Error ? err.message.replaceAll(code, '[código]') : 'Falha inesperada',
      status: 'erro',
    };
  }
}

/** Listas de opções com pelo menos tantas entradas vão para CensusFile.lists. */
const SHARED_LIST_MIN = 10;

/** Guarda as listas longas uma vez só, com o nome do campo, e cita nos campos. */
export function shareLists(entries: CensusEntry[]): Record<string, CensusOption[]> {
  const lists: Record<string, CensusOption[]> = {};
  const byContent = new Map<string, string>();
  for (const e of entries) {
    for (const form of e.page?.forms ?? []) {
      for (const field of form.fields as CensusField[]) {
        if (!Array.isArray(field.options) || field.options.length < SHARED_LIST_MIN) continue;
        const content = JSON.stringify(field.options);
        let id = byContent.get(content);
        if (!id) {
          const base = field.name.toLowerCase();
          id = base;
          for (let n = 2; id in lists; n++) id = `${base}~${n}`;
          lists[id] = field.options;
          byContent.set(content, id);
        }
        field.options = id;
      }
    }
  }
  return lists;
}

/**
 * Links de setarUrl de uma página (o menu e as listas abrem tudo por eles).
 * O link que a página completa com um número na hora (`"…&f_seq=" + arg`,
 * como o pp_autor do dicionário de coautores) é de alteração e fica de fora.
 */
function setarUrlPaths(html: string): string[] {
  return [...html.matchAll(/setarUrl\(\s*['"]([^'"]+)['"](?!\s*\+)/g)].map((m) =>
    m[1]!.replace(/&amp;/g, '&'),
  );
}

/** Inclusões nas listas do menu que nenhuma entrada abriu (só o caminho público). */
async function discover(reader: CensusReader, opened: Set<string>): Promise<string[]> {
  const menu = await reader.menuHtml();
  const lists = [...new Set(setarUrlPaths(menu).filter((p) => /lista/i.test(p.split('?')[0]!)))];
  const found = new Set<string>();
  for (const list of lists) {
    if (!isSafeGet(list)) continue;
    let html: string;
    try {
      html = (await reader.get(list)).html;
    } catch (err) {
      if (err instanceof SessionLost) throw err;
      continue;
    }
    for (const path of setarUrlPaths(html)) {
      const [proc, query] = splitAtQuery(path);
      if (/lista|ordenar|aviso/i.test(proc) || !isSafeGet(path)) continue;
      if (/(^|&)f_seq\w*=[^&]/i.test(query)) continue;
      if (!opened.has(pathKey(path))) found.add(publicOf(path));
    }
  }
  return [...found].sort();
}

export async function runCensus(
  port: CensusPort,
  code: string,
  options: CensusOptions = {},
): Promise<CensusFile> {
  const reader = new CensusReader(port, code, options.delayMs ?? 300);
  const targets = selected(options.targets ?? CENSUS_TARGETS, options.only);
  const entries: CensusEntry[] = [];
  // O código e o identificador do currículo nunca vão para um rótulo, mesmo que a página os mostre.
  const lattesId = lattesIdFrom(await reader.menuHtml().catch(() => ''));
  const redact = [...(options.redact ?? []), code, ...(lattesId ? [lattesId] : [])];
  let interrupted = false;
  for (const t of targets) {
    if (interrupted) {
      entries.push({ ...pending(t), status: 'nao-lido' });
      continue;
    }
    try {
      entries.push(await readEntry(reader, t, redact, code, { scripts: options.scripts }));
    } catch {
      interrupted = true;
      entries.push({ ...pending(t), status: 'nao-lido' });
    }
  }
  let discovered: string[] | undefined;
  if (options.discover && !interrupted) {
    const opened = new Set(entries.flatMap((e) => (e.path ? [pathKey(e.path)] : [])));
    try {
      discovered = await discover(reader, opened);
    } catch {
      interrupted = true;
    }
  }
  const scripts = shareScripts(entries);
  return {
    capturedAt: (options.now?.() ?? new Date()).toISOString(),
    collector: options.collector ?? 'lattes-editor',
    ...(discovered ? { discovered } : {}),
    entries,
    format: 1,
    ...(interrupted ? { interrupted: true } : {}),
    lists: shareLists(entries),
    origin: 'cvlattesweb: formulários de inclusão abertos por GET, sem f_seq e sem enviar',
    ...(scripts ? { scripts } : {}),
  };
}

/**
 * Os scripts lidos (scriptText) guardados uma vez só: a entrada fica com os
 * ids. Undefined quando nenhuma entrada leu script.
 */
export function shareScripts(
  entries: (CensusEntry & { scriptText?: string[] })[],
): Record<string, string> | undefined {
  const byText = new Map<string, string>();
  for (const e of entries) {
    if (!e.scriptText) continue;
    e.scripts = e.scriptText.map((text) => {
      let id = byText.get(text);
      if (!id) {
        id = `s${byText.size + 1}`;
        byText.set(text, id);
      }
      return id;
    });
    delete e.scriptText;
  }
  return byText.size ? Object.fromEntries([...byText].map(([text, id]) => [id, text])) : undefined;
}

export function pending(t: CensusTarget): CensusEntry {
  return {
    elements: t.elements,
    elementsProvenance: t.elementsProvenance,
    id: t.id,
    label: t.label,
    provenance: t.provenance,
    source: t.source,
    status: 'nao-lido',
  };
}
