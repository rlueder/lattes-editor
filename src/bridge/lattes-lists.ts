// Listas do Lattes lidas ao vivo pelo conector (LAT-48): a árvore de áreas do
// conhecimento, as agências de fomento, a busca de instituição e os cursos de
// uma instituição. Não dá para trazê-las para o repositório como as de país e
// idioma, então a extensão as lê na sessão da pessoa, só com GET, e o editor
// guarda uma cópia (src/model/store.ts). Nada aqui grava no Lattes. Ver
// docs/campos_tipados.md e docs/lattes_internals.md, seção 18.

import { institutionResults } from './create.ts';
import { decodeHtmlEntities } from './html-text.ts';
import { cvCodeFrom, isLogonPage } from './lattes-html.ts';

/**
 * Um nó da árvore de áreas, compacto: nome, código de 8 dígitos e filhos. O
 * nível é a profundidade (1 grande área, 2 área, 3 subárea, 4 especialidade),
 * conferida contra o `n` do Lattes na leitura.
 */
export interface AreaNode {
  b?: AreaNode[];
  c: string;
  l: string;
}

/** Uma agência da lista fixa do Lattes (prc_agencia): código de 12 caracteres e nome. */
export interface Agency {
  code: string;
  name: string;
}

/**
 * Um resultado da busca de instituição: o código como o Lattes o devolve (uma
 * letra e 12 caracteres), o nome que o formulário grava e o texto do link,
 * que traz a UF ("NOME (UF)").
 */
export interface Institution {
  code: string;
  label: string;
  name: string;
}

/** Uma opção da lista de cursos (f_curso): o valor (letra e 8 dígitos) e o texto. */
export interface Course {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Leitor de literal JavaScript, sem eval: só arrays, objetos, textos, números,
// true, false e null. Qualquer outra coisa (chamada, variável, expressão) faz
// a leitura falhar, em vez de executar código vindo da página.

class LiteralError extends Error {}

const MAX_DEPTH = 16;

function literalParser(src: string, start: number) {
  let i = start;
  const fail = (what: string): never => {
    throw new LiteralError(`${what} na posição ${i}`);
  };
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i]!)) i++;
      if (src.startsWith('//', i)) {
        const end = src.indexOf('\n', i);
        i = end < 0 ? src.length : end + 1;
      } else if (src.startsWith('/*', i)) {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) fail('comentário sem fim');
        i = end + 2;
      } else return;
    }
  };
  const string = (): string => {
    const quote = src[i]!;
    i++;
    let out = '';
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === quote) {
        i++;
        return out;
      }
      if (ch === '\n') fail('quebra de linha no texto');
      if (ch !== '\\') {
        out += ch;
        i++;
        continue;
      }
      const esc = src[i + 1];
      i += 2;
      if (esc === undefined) fail('escape no fim');
      if (esc === 'n') out += '\n';
      else if (esc === 't') out += '\t';
      else if (esc === 'r') out += '\r';
      else if (esc === 'x' || esc === 'u') {
        const size = esc === 'x' ? 2 : 4;
        const hex = src.slice(i, i + size);
        if (!new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex)) fail('escape inválido');
        out += String.fromCharCode(parseInt(hex, 16));
        i += size;
      } else out += esc;
    }
    return fail('texto sem fim');
  };
  const key = (): string => {
    const ch = src[i];
    if (ch === '"' || ch === "'") return string();
    const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i, i + 64));
    if (!m) return fail('chave inválida');
    i += m[0].length;
    return m[0];
  };
  const value = (depth: number): unknown => {
    if (depth > MAX_DEPTH) fail('aninhamento demais');
    skip();
    const ch = src[i];
    if (ch === '[') {
      i++;
      const out: unknown[] = [];
      for (;;) {
        skip();
        if (src[i] === ']') {
          i++;
          return out;
        }
        out.push(value(depth + 1));
        skip();
        if (src[i] === ',') i++;
        else if (src[i] !== ']') fail('esperava , ou ]');
      }
    }
    if (ch === '{') {
      i++;
      const out: Record<string, unknown> = {};
      for (;;) {
        skip();
        if (src[i] === '}') {
          i++;
          return out;
        }
        const k = key();
        skip();
        if (src[i] !== ':') fail('esperava :');
        i++;
        // Chave "__proto__" e afins não viram propriedade especial.
        Object.defineProperty(out, k, {
          enumerable: true,
          value: value(depth + 1),
          writable: true,
        });
        skip();
        if (src[i] === ',') i++;
        else if (src[i] !== '}') fail('esperava , ou }');
      }
    }
    if (ch === '"' || ch === "'") return string();
    const m = /^(?:-?\d+(?:\.\d+)?|true|false|null)\b/.exec(src.slice(i, i + 32));
    if (!m) return fail('valor que não é literal');
    i += m[0].length;
    if (m[0] === 'true') return true;
    if (m[0] === 'false') return false;
    if (m[0] === 'null') return null;
    return Number(m[0]);
  };
  return {
    end: () => i,
    value,
  };
}

/**
 * Lê um literal JavaScript que começa em `start` (depois de espaços); devolve
 * o valor e onde ele termina. Lança se o texto não for só literal.
 */
export function parseJsLiteral(src: string, start = 0): { end: number; value: unknown } {
  const parser = literalParser(src, start);
  const value = parser.value(0);
  return { end: parser.end(), value };
}

// ---------------------------------------------------------------------------
// Áreas do conhecimento: o vetor areaDP do menu (PKG_MENU.menu).

const AREA_LEVELS = 4;

function toAreaNode(raw: unknown, level: number): AreaNode | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const label = typeof r.l === 'string' ? decodeHtmlEntities(r.l).replace(/\s+/g, ' ').trim() : '';
  const code = typeof r.c === 'string' || typeof r.c === 'number' ? String(r.c).trim() : '';
  if (!label || !/^\d{8}$/.test(code)) return undefined;
  // O nível que o Lattes declara tem de bater com a profundidade.
  if (r.n !== undefined && String(r.n).trim() !== String(level)) return undefined;
  const node: AreaNode = { c: code, l: label };
  if (r.b !== undefined) {
    if (!Array.isArray(r.b) || level >= AREA_LEVELS) return undefined;
    const children = r.b.map((child) => toAreaNode(child, level + 1));
    if (children.some((c) => c === undefined)) return undefined;
    if (children.length) node.b = children as AreaNode[];
  }
  return node;
}

/**
 * A árvore de áreas declarada no menu do Lattes (`areaDP = [...]`), lida como
 * literal, sem executar nada. undefined se o menu não a tem ou se ela não está
 * no formato conhecido (nó sem nome, código fora de 8 dígitos, nível trocado):
 * melhor nenhuma lista que uma lista torta.
 */
export function parseAreaTree(html: string): AreaNode[] | undefined {
  const m = /\bareaDP\s*=\s*/.exec(html);
  if (!m) return undefined;
  try {
    const { value } = parseJsLiteral(html, m.index + m[0].length);
    if (!Array.isArray(value) || value.length === 0) return undefined;
    const nodes = value.map((raw) => toAreaNode(raw, 1));
    if (nodes.some((n) => n === undefined)) return undefined;
    return nodes as AreaNode[];
  } catch {
    return undefined;
  }
}

/** Quantos nós a árvore tem, de todos os níveis. */
export function countAreas(nodes: readonly AreaNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countAreas(n.b ?? []), 0);
}

// ---------------------------------------------------------------------------
// Chamadas de função com textos como argumentos, nos links das janelas do
// Lattes: atribuir('<código>','<nome>') na de agências.

function quotedCalls(html: string, fn: string): string[][] {
  const out: string[][] = [];
  const re = new RegExp(`\\b${fn}\\(`, 'g');
  for (const m of html.matchAll(re)) {
    try {
      const args: string[] = [];
      let i = m.index + m[0].length;
      for (;;) {
        const { end, value } = parseJsLiteral(html, i);
        if (typeof value !== 'string') break;
        args.push(value);
        const rest = /^\s*([,)])/.exec(html.slice(end, end + 32));
        if (!rest) break;
        i = end + rest[0].length;
        if (rest[1] === ')') {
          out.push(args);
          break;
        }
      }
    } catch {
      // Chamada que não é só de textos: fica de fora.
    }
  }
  return out;
}

/** Nome sem entidade que sobrou nem barra: nunca vai ao XML um nome corrompido. */
const cleanName = (name: string) => {
  const decoded = decodeHtmlEntities(name).replace(/\s+/g, ' ').trim();
  return /&\w+;|\\/.test(decoded) ? '' : decoded;
};

/**
 * A lista de agências de fomento (prc_agencia): cada uma é um link
 * `atribuir('<código>','<nome>')`. Sem repetidas, na ordem da página.
 */
export function parseAgencies(html: string): Agency[] {
  const seen = new Set<string>();
  const out: Agency[] = [];
  for (const [code = '', name = ''] of quotedCalls(html, 'atribuir')) {
    const clean = cleanName(name);
    if (!code.trim() || !clean || seen.has(code)) continue;
    seen.add(code);
    out.push({ code: code.trim(), name: clean });
  }
  return out;
}

/**
 * Os resultados da busca de instituição (PRC_INST_FORM), com o texto de cada
 * link, que traz a UF. A leitura de código e nome é a mesma da inclusão de
 * atuação (create.ts).
 */
export function parseInstitutions(html: string): Institution[] {
  const labels = new Map<string, string>();
  for (const m of html.matchAll(/<a\b[^>]*seleciona\(\s*'([^'\\]*)'[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = decodeHtmlEntities((m[2] ?? '').replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (m[1] && text && !labels.has(m[1])) labels.set(m[1], text);
  }
  const seen = new Set<string>();
  return institutionResults(html)
    .filter((r) => r.code && r.name && !seen.has(r.code) && seen.add(r.code))
    .map((r) => ({ code: r.code, label: labels.get(r.code) ?? r.name, name: r.name }));
}

/** Valor e texto das opções de um <select>, sem a opção vazia; undefined sem o combo. */
export function selectEntries(html: string, control: string): Course[] | undefined {
  const name = control.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const select = new RegExp(
    `<select[^>]*\\bname\\s*=\\s*["']?${name}["'\\s>][^>]*>([\\s\\S]*?)</select>`,
    'i',
  ).exec(html);
  if (!select) return undefined;
  const out: Course[] = [];
  for (const m of (select[1] ?? '').matchAll(/<option\b([^>]*)>([^<]*)/gi)) {
    const attrs = m[1] ?? '';
    const value = (/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i.exec(attrs) ?? [])
      .slice(1)
      .find((v) => v !== undefined);
    const text = decodeHtmlEntities(m[2] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!value?.trim() || !text) continue;
    out.push({ label: text, value: value.trim() });
  }
  return out;
}

/** Os cursos da instituição no nível (f_curso, em prc_curso_form), sem valor repetido. */
export function parseCourses(html: string): Course[] | undefined {
  const seen = new Set<string>();
  return selectEntries(html, 'f_curso')?.filter((c) => !seen.has(c.value) && seen.add(c.value));
}

// ---------------------------------------------------------------------------
// Endereços, todos GET, com o código de 10 caracteres do currículo.

/**
 * Texto para a URL como o escape() do JavaScript, que o Lattes espera: Latin-1
 * em %XX. O % sai, como a página faz (recuperaInstMacro); caractere fora do
 * Latin-1 também, porque o servidor não o entenderia.
 */
export function latin1Param(text: string): string {
  let out = '';
  for (const ch of text.replace(/%/g, '')) {
    const code = ch.codePointAt(0)!;
    if (/[A-Za-z0-9@*_+\-./]/.test(ch)) out += ch;
    else if (code <= 0xff) out += `%${code.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

/**
 * Nível usado na busca de instituição fora da formação: o do teste de
 * 14/10/2026 (doutorado). Se o nível muda o resultado da busca não se sabe.
 */
export const DEFAULT_SEARCH_LEVEL = '4';

/** Mínimo de letras para buscar instituição (o Lattes aceita duas; três evita listas enormes). */
export const MIN_INSTITUTION_QUERY = 3;

export const agenciesPath = (cv: string) => `prc_agencia?f_cod=${cv}`;

export const institutionSearchPath = (cv: string, query: string, level = DEFAULT_SEARCH_LEVEL) =>
  `PRC_INST_FORM?F_CTR=C&F_COD=${cv}&F_NIVEL=${encodeURIComponent(level)}&F_STA_OUTRA=N&f_nome=${latin1Param(query)}`;

/**
 * A lista de cursos: a da formação (f_pgm FORM) ou a de orientação e banca
 * (TESE, com o f_sta_area que a página manda; pkg_orient.form e
 * PKG_BANCA_TRAB.form, lidas em 18/10/2026).
 */
export const coursesPath = (
  cv: string,
  institution: string,
  level: string,
  program: 'FORM' | 'TESE' = 'FORM',
  staArea = '',
) =>
  program === 'TESE'
    ? `prc_curso_form?f_pgm=TESE&f_cod=${cv}&f_inst=${encodeURIComponent(institution)}&f_nivel=${encodeURIComponent(level)}&f_sta_area=${encodeURIComponent(staArea)}`
    : `prc_curso_form?f_cod=${cv}&f_pgm=FORM&f_nivel=${encodeURIComponent(level)}&f_inst=${encodeURIComponent(institution)}`;

// ---------------------------------------------------------------------------
// Leituras, pelo mesmo tipo de porta da aba do Lattes que o resto do conector.

export interface ListsPort {
  get(path: string): Promise<string>;
  /** O menu que já está na aba. */
  menuHtml(): Promise<string> | string;
}

export interface ListsReading {
  agencies?: Agency[];
  areas?: AreaNode[];
  /** Por que alguma lista não veio. */
  error?: string;
}

const SESSION_GONE = 'A sessão do Lattes caiu; entre de novo';

class SessionGone extends Error {}

async function getPage(port: ListsPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path)) throw new SessionGone(SESSION_GONE);
  return html;
}

function failure(err: unknown): string {
  if (err instanceof SessionGone) return err.message;
  return 'A aba do Lattes não respondeu';
}

/**
 * As duas listas fixas: as áreas, do menu que já está na aba (sem pedido, e
 * com um GET do menu se a aba não as tiver), e as agências, num GET. Uma que
 * falha não leva a outra junto.
 */
export async function readLists(port: ListsPort): Promise<ListsReading> {
  let menu: string;
  try {
    menu = await port.menuHtml();
  } catch (err) {
    return { error: failure(err) };
  }
  if (isLogonPage(menu)) return { error: SESSION_GONE };
  const cv = cvCodeFrom(menu);
  const errors: string[] = [];
  let areas = parseAreaTree(menu);
  if (!areas) {
    try {
      areas = parseAreaTree(await getPage(port, 'PKG_MENU.menu'));
      if (!areas) errors.push('A tabela de áreas não está no menu do Lattes');
    } catch (err) {
      errors.push(failure(err));
    }
  }
  let agencies: Agency[] | undefined;
  if (!cv) errors.push('O código do currículo não está no menu');
  else {
    try {
      const found = parseAgencies(await getPage(port, agenciesPath(cv)));
      if (found.length) agencies = found;
      else errors.push('A lista de agências veio vazia');
    } catch (err) {
      errors.push(failure(err));
    }
  }
  return { agencies, areas, error: errors.length ? [...new Set(errors)].join('; ') : undefined };
}

/** Busca de instituição no diretório do Lattes, só leitura. */
export async function searchInstitutions(
  port: ListsPort,
  query: string,
  level?: string,
): Promise<{ error?: string; results?: Institution[] }> {
  const q = query.replace(/%/g, '').trim();
  if (q.length < MIN_INSTITUTION_QUERY) return { results: [] };
  try {
    const cv = cvCodeFrom(await port.menuHtml());
    if (!cv) return { error: 'O código do currículo não está no menu' };
    return { results: parseInstitutions(await getPage(port, institutionSearchPath(cv, q, level))) };
  } catch (err) {
    return { error: failure(err) };
  }
}

/** Os cursos de uma instituição (código com a letra) num nível da formação, só leitura. */
export async function readCourses(
  port: ListsPort,
  institution: string,
  level: string,
  program: 'FORM' | 'TESE' = 'FORM',
  staArea = '',
): Promise<{ courses?: Course[]; error?: string }> {
  try {
    const cv = cvCodeFrom(await port.menuHtml());
    if (!cv) return { error: 'O código do currículo não está no menu' };
    const courses = parseCourses(
      await getPage(port, coursesPath(cv, institution, level, program, staArea)),
    );
    return courses ? { courses } : { error: 'A lista de cursos não veio na página do Lattes' };
  } catch (err) {
    return { error: failure(err) };
  }
}
