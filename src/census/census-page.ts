// O registro versionado de um formulário do Lattes (LAT-55): nomes, rótulos,
// tipos, limites e opções, sem nenhum valor do currículo. O que estava
// digitado, marcado ou escolhido na página fica de fora; dos ocultos sai só o
// nome, menos os poucos que dizem que formulário é este (f_ctr, f_tipo,
// f_nivel...), que vêm do próprio Lattes e não da pessoa.

import { foldText } from '../bridge/html-text.ts';
import { scanForms, type ScannedField, type ScannedForm } from './html-scan.ts';

export interface CensusOption {
  label: string;
  value: string;
}

export interface CensusField {
  disabled?: true;
  inHiddenBlock?: true;
  label: string;
  maxLength?: number;
  name: string;
  /** Opções de rádio, caixa ou lista, ou a referência a uma lista comum (ver CensusFile.lists). */
  options?: CensusOption[] | string;
  readOnly?: true;
  /** Lista vazia no HTML: as opções são montadas por script (o F_TPO dos eventos). */
  scriptFilled?: true;
  type: string;
}

export interface CensusForm {
  action: string;
  fields: CensusField[];
  /** Nomes dos ocultos, na ordem da página. */
  hidden: string[];
  /** Valores dos ocultos que identificam o formulário (IDENTITY_FIELDS). */
  identity: Record<string, string>;
  method: string;
  name: string;
  unnamed: number;
}

export interface CensusPage {
  forms: CensusForm[];
  title: string;
}

/**
 * Ocultos cujo valor vem do Lattes e diz que formulário é este: a operação, o
 * tipo, o nível. Nenhum deles é dado da pessoa.
 */
export const IDENTITY_FIELDS = new Set([
  'f_cod_tipo',
  'f_ctr',
  'f_natur',
  'f_nivel',
  'f_origem',
  'f_reg',
  'f_tematica',
  'f_tipo',
  'f_tpo_acao_inov',
  'f_tpo_cooperacao',
]);

/** Parâmetros de URL que identificam a pessoa ou um item dela: nunca vão para o arquivo. */
export function isPrivateParam(name: string): boolean {
  const key = name.toLowerCase();
  return key === 'f_cod' || key.startsWith('f_seq') || key.startsWith('f_codinst');
}

const REMOVED = '[removido]';

/** E-mail, CPF ou um número longo: cara de dado pessoal num texto que devia ser fixo. */
const PERSONAL = /@|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{6,}/;

/**
 * Texto da página que vai para o arquivo (rótulo, título, opção). Se parece
 * dado pessoal, ou contém um dos textos que quem roda pediu para esconder (o
 * próprio nome, por exemplo), sai como "[removido]".
 */
export function scrubText(text: string, redact: readonly string[] = []): string {
  if (PERSONAL.test(text)) return REMOVED;
  const folded = foldText(text);
  return redact.some((r) => r.trim().length >= 3 && folded.includes(foldText(r))) ? REMOVED : text;
}

/** Rótulos muito longos são instruções da tela, não nomes de campo. */
const LABEL_MAX = 160;

function censusField(f: ScannedField, redact: readonly string[]): CensusField {
  const out: CensusField = {
    label: scrubText(f.label.slice(0, LABEL_MAX), redact),
    name: f.name,
    type: f.type,
  };
  if (f.maxLength) out.maxLength = f.maxLength;
  if (f.disabled) out.disabled = true;
  if (f.readOnly) out.readOnly = true;
  if (f.inHiddenBlock) out.inHiddenBlock = true;
  if (f.options) {
    out.options = f.options.map((o) => ({
      label: scrubText(o.label, redact),
      // Códigos longos de opção (instituições, agências) são do Lattes; e-mail e
      // CPF não. Uma opção que é endereço (o combo de níveis) perde o f_cod.
      value: /@|\d{3}\.\d{3}\.\d{3}-\d{2}/.test(o.value) ? REMOVED : publicUrl(o.value),
    }));
    if (f.type.startsWith('select') && !f.options.some((o) => o.value || o.label)) {
      out.scriptFilled = true;
    }
  }
  return out;
}

export function censusForm(form: ScannedForm, redact: readonly string[] = []): CensusForm {
  const hidden: string[] = [];
  const identity: Record<string, string> = {};
  const fields: CensusField[] = [];
  for (const f of form.fields) {
    if (f.type === 'hidden') {
      if (!hidden.includes(f.name)) hidden.push(f.name);
      const key = f.name.toLowerCase();
      if (IDENTITY_FIELDS.has(key) && !(key in identity)) identity[key] = f.value;
      continue;
    }
    fields.push(censusField(f, redact));
  }
  return {
    action: publicUrl(form.action),
    fields,
    hidden,
    identity,
    method: form.method,
    name: form.name,
    unnamed: form.unnamed,
  };
}

/** O registro de uma página, pronto para o arquivo. */
export function censusPage(html: string, redact: readonly string[] = []): CensusPage {
  const { forms, title } = scanForms(html);
  return {
    forms: forms.map((f) => censusForm(f, redact)),
    title: scrubText(title, redact),
  };
}

/** Um endereço com parâmetros (ação de formulário, opção) sem os parâmetros privados. */
export function publicUrl(url: string): string {
  const i = url.indexOf('?');
  if (i < 0) return url;
  const params: Record<string, string> = {};
  for (const part of url.slice(i + 1).split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    params[eq < 0 ? part : part.slice(0, eq)] = eq < 0 ? '' : part.slice(eq + 1);
  }
  return publicPath(url.slice(0, i), params);
}

/** Um caminho do Lattes sem o código do currículo nem números de item. */
export function publicPath(proc: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .filter(([k]) => !isPrivateParam(k))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return query ? `${proc}?${query}` : proc;
}

const REMOVED_SCRIPT = '[removido]';

/** E-mails, CPFs e números longos (código ou identificador do currículo, CPF sem pontos). */
const SCRIPT_PERSONAL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\d{3}\.\d{3}\.\d{3}-\d{2}|\b[A-Z]?\d{6,}\b/g;

const DATA_LINE = /\w*Provider\s*=|=\s*\[\s*\{|\bnew\s+Array\s*\(\s*['"{]/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Um pedaço do código da página sem dado pessoal: cada e-mail, CPF ou número
 * longo e cada texto que quem roda pediu para esconder vira "[removido]". Se
 * um desses textos ainda aparece sem acento ou com outra caixa, o pedaço
 * inteiro sai.
 */
function scrubScript(text: string, redact: readonly string[]): string {
  // Vetores de dados que alimentam as grades (autorProvider, palavraProvider…)
  // e listas de objetos escritas na página: podem trazer nomes de coautores.
  if (DATA_LINE.test(text)) return REMOVED_SCRIPT;
  let out = text.replace(SCRIPT_PERSONAL, REMOVED_SCRIPT);
  for (const r of redact) {
    if (r.trim().length < 3) continue;
    out = out.replace(new RegExp(escapeRe(r.trim()), 'gi'), REMOVED_SCRIPT);
  }
  const folded = foldText(out);
  return redact.some((r) => r.trim().length >= 3 && folded.includes(foldText(r)))
    ? REMOVED_SCRIPT
    : out;
}

/**
 * Os scripts da própria página (sem `src`), para ler como ela monta o que
 * envia: a grade de datas, as máscaras, o check(). Sai o que tem cara de dado
 * pessoal e o que quem roda pediu para esconder (scrubScript), linha a linha;
 * o resto do código fica como veio. Linhas que montam os dados das grades (os
 * autores de um item, por exemplo) saem inteiras como "[removido]".
 */
export function pageScripts(html: string, redact: readonly string[] = []): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=/i.test(m[1] ?? '')) continue;
    const body = (m[2] ?? '').trim();
    if (!body) continue;
    out.push(
      body
        .split('\n')
        .map((line) => scrubScript(line, redact))
        .join('\n'),
    );
  }
  return out;
}

/** Os endereços do Lattes que a página abre (links, setarUrl, location), sem os parâmetros privados. */
export function pageLinks(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/\b((?:pkg|prc)_[\w.]+)(\?[^'"\s<>\\]*)?/gi)) {
    found.add(publicUrl(`${m[1]}${(m[2] ?? '').replace(/&amp;/g, '&')}`));
  }
  return [...found].sort();
}
