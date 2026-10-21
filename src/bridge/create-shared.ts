// O que as inclusões de formação e de projeto (create-formacao.ts,
// create-projeto.ts) têm em comum: a forma da operação, o mapeamento dos
// atributos do XML para os campos, e as leituras e travas em volta do envio.
// Ver create-items.ts.

import type { Change } from '../model/changes.ts';
import { childElements, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import type { FieldSpec } from './contract.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  type FormControl,
  normalizeNewlines,
  type Pairs,
  pairValue,
  successfulPairs,
  withScriptValues,
} from './form.ts';
import { decodeHtmlEntities } from './html-text.ts';
import { isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

export interface CreateOpBase {
  /** Nenhum valor anterior: o item não existe no Lattes. */
  expect: FieldValues;
  /** CODIGO-INSTITUICAO do XML (com ou sem a letra que o Lattes põe na frente). */
  institutionCode: string;
  institutionName: string;
  key: string;
  label: string;
  /** Campos digitados no formulário; instituição, curso e agência saem das buscas. */
  set: FieldValues;
}

export type Planned<T> = T | { reason: string };
export type Mapper = (value: string) => string | undefined;
export const same: Mapper = (v) => v;

/** Rótulo de um atributo como a lista de alterações mostra (Change.fields). */
export const labelIn = (change: Change, attr: string) =>
  change.fields.find((f) => f.attr === attr)?.label ?? attr;

/** Filhos com algum valor (palavras-chave, áreas, equipe…), que o conector não monta. */
export function filledChildren(el: XElement, except: string[] = []): XElement[] {
  const hasValue = (e: XElement): boolean =>
    e.attrs.some((a) => a.value.trim() !== '') || childElements(e).some(hasValue);
  return childElements(el).filter((c) => !except.includes(c.name) && hasValue(c));
}

/**
 * Os atributos preenchidos do item como campos do formulário. Os que o
 * formulário não tem, e que não são do sistema nem saem de uma busca, voltam
 * em `missing` com o rótulo, para o motivo de ir à mão.
 */
export function mapAttrs(
  change: Change,
  el: XElement,
  table: Record<string, [string, Mapper]>,
  handled: ReadonlySet<string>,
): { missing: string[]; set: FieldValues; wrong: string[] } {
  const set: FieldValues = {};
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const { name, value } of el.attrs) {
    if (!value.trim() || handled.has(name)) continue;
    const entry = table[name];
    if (!entry) {
      missing.push(labelIn(change, name));
      continue;
    }
    const mapped = entry[1](value);
    const taken = set[entry[0]];
    if (mapped === undefined) wrong.push(`${labelIn(change, name)} (${value})`);
    // Dois atributos para o mesmo campo (orientador) com valores diferentes:
    // um deles se perderia.
    else if (taken !== undefined && taken !== mapped) {
      wrong.push(`${labelIn(change, name)} (outro valor para o mesmo campo)`);
    } else set[entry[0]] = mapped;
  }
  return { missing, set, wrong };
}

export function reasonFrom(missing: string[], wrong: string[]): string | undefined {
  if (missing.length > 0) {
    return `Campos que o formulário de inclusão não tem: ${missing.join(', ')}`;
  }
  if (wrong.length > 0) return `Valores sem correspondência no formulário: ${wrong.join(', ')}`;
  return undefined;
}

// Campos do contrato ----------------------------------------------------------------

export const text = (maxLength: number): FieldSpec => ({ maxLength, type: 'text' });
export const hidden: FieldSpec = { type: 'hidden' };
export const radio: FieldSpec = { type: 'radio' };
export const select: FieldSpec = { type: 'select-one' };

// Leituras ------------------------------------------------------------------------

export class Stop extends Error {
  status: OpResult['status'];
  constructor(status: OpResult['status'], detail: string) {
    super(detail);
    this.status = status;
  }
}

export const SESSION = 'A sessão do Lattes caiu; entre de novo';

export async function getChecked(port: LattesPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path)) throw new Stop('sessao', SESSION);
  return html;
}

export async function readPairs(
  port: LattesPort,
  path: string,
  form: string,
): Promise<{ controls: FormControl[]; pairs: Pairs }> {
  const html = await getChecked(port, path);
  const controls = withScriptValues(html, port.readForm(html, form));
  if (!controls) throw new Stop('erro', `Formulário ${form} não encontrado`);
  return { controls, pairs: successfulPairs(controls) };
}

/**
 * O código do Lattes (com a letra na frente, D ou V) que corresponde ao do
 * XML. A letra é uma a mais: o código do XML pode começar por letra também
 * (K4WU00000006, no link VK4WU00000006), e tirar a primeira letra dos dois
 * lados os desencontraria.
 */
export function sameCode(fromLattes: string | null | undefined, fromXml: string): boolean {
  if (!fromLattes) return false;
  const a = fromLattes.trim();
  const b = fromXml.trim();
  const lettered = (long: string, short: string) =>
    long.length === short.length + 1 && /^[A-Za-z]/.test(long) && long.slice(1) === short;
  return a === b || lettered(a, b) || lettered(b, a);
}

/** Os argumentos literais de cada chamada `fn(...)` na página, já decodificados. */
export function jsCalls(html: string, fn: string): string[][] {
  const out: string[][] = [];
  const start = new RegExp(`\\b${fn}\\s*\\(`, 'g');
  for (const m of html.matchAll(start)) {
    const args: string[] = [];
    let i = m.index + m[0].length;
    for (;;) {
      while (/\s/.test(html[i] ?? '')) i++;
      const quote = html[i];
      let value = '';
      if (quote === "'" || quote === '"') {
        i++;
        while (i < html.length && html[i] !== quote) {
          if (html[i] === '\\') i++;
          value += html[i] ?? '';
          i++;
        }
        i++;
      } else {
        while (i < html.length && !/[,)]/.test(html[i]!)) value += html[i++];
        value = value.trim();
      }
      args.push(decodeHtmlEntities(value));
      while (/\s/.test(html[i] ?? '')) i++;
      if (html[i] === ',') {
        i++;
        continue;
      }
      break;
    }
    if (html[i] === ')') out.push(args);
  }
  return out;
}

/** As opções (valor e texto) de um <select> pelo nome. */
export function selectEntries(html: string, control: string): { text: string; value: string }[] {
  const select = new RegExp(
    `<select[^>]*\\bname\\s*=\\s*["']?${control}["'\\s>][^>]*>([\\s\\S]*?)</select>`,
    'i',
  ).exec(html);
  if (!select) return [];
  return [...(select[1] ?? '').matchAll(/<option\b([^>]*)>([^<]*)/gi)]
    .map((m) => ({
      text: decodeHtmlEntities(m[2] ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
      value: /\bvalue\s*=\s*["']?([^"'>]*)/i.exec(m[1] ?? '')?.[1]?.trim() ?? '',
    }))
    .filter((o) => o.value && o.text);
}

/** Antes de enviar: cada campo com valor precisa existir, visível, no formulário deste item. */
export function absentFields(controls: FormControl[], set: FieldValues): string[] {
  return Object.entries(set)
    .filter(([, v]) => v)
    .map(([name]) => name)
    .filter((name) => {
      const c = controls.find((x) => x.name === name);
      return !c || c.type === 'hidden';
    });
}

export function overLimit(controls: FormControl[], set: FieldValues): string | undefined {
  for (const [field, value] of Object.entries(set)) {
    const limit = controls.find((c) => c.name === field)?.maxLength;
    if (value && limit && limit > 0 && value.length > limit) {
      return `${CREATE_FIELD_LABELS[field] ?? field} passa do limite do Lattes (${limit} caracteres)`;
    }
  }
  return undefined;
}

const sameValue = (a: string | null, b: string | null) =>
  (a ?? '') === (b ?? '') || normalizeNewlines(a ?? '') === normalizeNewlines(b ?? '');

const labelOf = (name: string) => CREATE_FIELD_LABELS[name] ?? name;

/**
 * Releitura de tudo o que foi enviado, inclusive o que veio das buscas
 * (instituição, curso, agência, vínculo). Que campos ocultos o formulário de
 * alteração traz depois de uma inclusão não foi observado: campo que voltou
 * diferente é falha (`differ`), e campo que não voltou fica sem conferir
 * (`unread`), nunca dado por conferido.
 */
const TEXT_LIKE = new Set(['hidden', 'password', 'text', 'textarea']);

/** O que um controle desabilitado de texto ou de lista mostra; undefined nos outros casos. */
function displayedValue(control: FormControl): string | undefined {
  if (!control.disabled) return undefined;
  if (TEXT_LIKE.has(control.type)) return control.value;
  if (control.type.startsWith('select')) return control.selected?.[0] ?? '';
  return undefined;
}

export function readBack(
  saved: { controls: FormControl[]; pairs: Pairs },
  set: FieldValues,
): { differ: string[]; unread: string[] } {
  const differ: string[] = [];
  const unread: string[] = [];
  for (const [name, value] of Object.entries(set)) {
    const controls = saved.controls.filter((c) => c.name === name);
    if (controls.length === 0) {
      unread.push(labelOf(name));
      continue;
    }
    // Campo desabilitado (instituição, curso e agência, só pelas buscas, seção
    // 17) não vai nos pares do envio, mas o valor gravado aparece nele. Só
    // vale para um controle único de texto ou de lista; o resto (rádios,
    // caixas, nomes repetidos) segue pelos pares.
    const shown = controls.length === 1 ? displayedValue(controls[0]!) : undefined;
    const current = shown ?? pairValue(saved.pairs, name);
    if (!sameValue(current, value)) differ.push(labelOf(name));
  }
  return { differ, unread };
}

/** O motivo de uma inclusão feita mas não conferida, ou undefined se tudo voltou igual. */
export function readBackProblem(
  created: string,
  { differ, unread }: { differ: string[]; unread: string[] },
): string | undefined {
  // Rótulos, sem repetir: nome e código do mesmo campo dizem a mesma coisa.
  const list = (names: string[]) => [...new Set(names)].join(', ');
  if (differ.length > 0) {
    return `${created}, mas o Lattes guardou outro valor em: ${list(differ)}. Confira no Lattes`;
  }
  if (unread.length > 0) {
    return `${created}, mas não deu para reler: ${list(unread)}. Confira no Lattes`;
  }
  return undefined;
}

export type Result = OpResult & { assigned?: Record<string, string> };

/**
 * Depois do POST aceito, o item pode existir no Lattes mesmo quando a
 * conferência não acha um só: o aviso diz isso, para ninguém mandar de novo.
 */
export function maybeCreated(key: string, mayExist: string, why: string): Result {
  return {
    detail: `O Lattes aceitou o envio, mas ${why}. ${mayExist}: confira no Lattes antes de mandar de novo.`,
    key,
    status: 'divergente',
  };
}
