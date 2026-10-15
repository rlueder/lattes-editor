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
  return (
    key === 'f_cod' ||
    // O identificador de 16 dígitos do currículo (pkg_import_cv.form01?…&f_id=, 15/10/2026).
    key === 'f_id' ||
    key.startsWith('f_seq') ||
    key.startsWith('f_codinst')
  );
}

/** Valor de parâmetro com cara de identificador (CPF, ID Lattes, número de item). */
const PRIVATE_VALUE = /\d{6,}/;

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
    .map(([k, v]) => `${k}=${PRIVATE_VALUE.test(v) ? REMOVED : v}`)
    .join('&');
  return query ? `${proc}?${query}` : proc;
}

const REMOVED_SCRIPT = '[removido]';

/** E-mails, CPFs e números longos (código ou identificador do currículo, CPF sem pontos). */
const SCRIPT_PERSONAL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\d{3}\.\d{3}\.\d{3}-\d{2}|\b[A-Z]?\d{6,}\b/g;

const DATA_LINE = /\w*Provider\s*=|=\s*\[\s*\{|\bnew\s+Array\s*\(\s*['"{]/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Campos de nome e citação em objetos escritos na página, inclusive em JSON
 * comentado ({"n":"…","t":"…"}, autorProvider de exemplo): o valor sai.
 */
const NAME_FIELD =
  /(["']?)\b(n|t|l|nome|nome_?completo|nome_?citacao|citacao|autor|author)\1(\s*:\s*)(["'])((?:\\.|(?!\4)[^\\])*)\4/gi;

/** "comentado por Fulano", "Criado por: Fulano", "Autor: Fulano" num comentário. */
const AUTHOR_IN_COMMENT =
  /\b((?:[Cc]omentad|[Cc]riad|[Aa]lterad|[Mm]odificad|[Ee]scrit|[Dd]esenvolvid|[Ff]eit|[Aa]justad|[Cc]orrigid)[oa]s?\s+[Pp]or|[Aa]utor(?:a|es)?|AUTOR|[Aa]uthor|[Cc]reated\s+[Bb]y|[Bb]y)(\s*:?\s+)([A-ZÀ-Þ][\wÀ-ÿ.'-]*(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Þ][\wÀ-ÿ.'-]*){0,5})/g;

/** Tira do texto de um comentário os nomes de quem o escreveu. */
function scrubComment(comment: string): string {
  return comment.replace(
    AUTHOR_IN_COMMENT,
    (_, lead: string, gap: string) => `${lead}${gap}${REMOVED_SCRIPT}`,
  );
}

/**
 * Um pedaço do código da página sem dado pessoal: cada e-mail, CPF ou número
 * longo, cada campo de nome ou citação num objeto escrito na página, cada
 * nome de autor num comentário e cada texto que quem roda pediu para esconder
 * vira "[removido]". Se um desses textos ainda aparece sem acento ou com
 * outra caixa, o pedaço inteiro sai. `inComment` diz se a linha começa dentro
 * de um comentário de bloco.
 */
function scrubScript(
  text: string,
  redact: readonly string[],
  inComment = false,
): { line: string; inComment: boolean } {
  // Vetores de dados que alimentam as grades (autorProvider, palavraProvider…)
  // e listas de objetos escritas na página: podem trazer nomes de coautores.
  if (DATA_LINE.test(text))
    return { inComment: nextCommentState(text, inComment), line: REMOVED_SCRIPT };
  let out = commentAware(text, inComment)
    // A lista de coautores da janela de equipe: p[i]="<código>#<nome>@<citação> (<nome>)".
    // O nome pode ter a outra aspa (D'Ávila) ou uma aspa escapada (D\'Ávila):
    // só a aspa que abriu, sem barra antes, fecha o literal.
    .replace(
      /(["'])([\w-]*)#(?:\\.|(?!\1)[^@\\])*@(?:\\.|(?!\1)[^\\])*\1/g,
      (_, q: string, code: string) => `${q}${code}#${REMOVED_SCRIPT}@${REMOVED_SCRIPT}${q}`,
    )
    // O título de uma janela modal traz, depois do primeiro <br>, o nome da
    // instituição ou do item: setarTitulo("Atuação profissional - …<br>Nome"),
    // às vezes com o <br> escapado (&lt;br&gt;).
    .replace(
      /(setarTitulo\s*\(\s*(["'])(?:(?!\2).)*?(?:<br\s*\/?>|&lt;br\s*\/?&gt;))(?:(?!\2).)*\2/gi,
      (_, head: string, q: string) => `${head}${REMOVED_SCRIPT}${q}`,
    )
    .replace(SCRIPT_PERSONAL, REMOVED_SCRIPT)
    .replace(
      NAME_FIELD,
      (_, q: string, key: string, colon: string, vq: string) =>
        `${q}${key}${q}${colon}${vq}${REMOVED_SCRIPT}${vq}`,
    );
  for (const r of redact) {
    if (r.trim().length < 3) continue;
    out = out.replace(new RegExp(escapeRe(r.trim()), 'gi'), REMOVED_SCRIPT);
  }
  const folded = foldText(out);
  const line = redact.some((r) => r.trim().length >= 3 && folded.includes(foldText(r)))
    ? REMOVED_SCRIPT
    : out;
  return { inComment: nextCommentState(text, inComment), line };
}

/** A linha com o texto dos comentários (// e /* … *\/) passado por scrubComment. */
function commentAware(text: string, inComment: boolean): string {
  let out = '';
  let rest = text;
  let open = inComment;
  while (rest) {
    if (open) {
      const end = rest.indexOf('*/');
      if (end < 0) return out + scrubComment(rest);
      out += `${scrubComment(rest.slice(0, end))}*/`;
      rest = rest.slice(end + 2);
      open = false;
      continue;
    }
    const block = rest.indexOf('/*');
    const line = rest.indexOf('//');
    if (block < 0 && line < 0) return out + rest;
    if (line >= 0 && (block < 0 || line < block)) {
      return `${out}${rest.slice(0, line)}//${scrubComment(rest.slice(line + 2))}`;
    }
    out += `${rest.slice(0, block)}/*`;
    rest = rest.slice(block + 2);
    open = true;
  }
  return out;
}

/** Se a linha termina dentro de um comentário de bloco. */
function nextCommentState(text: string, inComment: boolean): boolean {
  let open = inComment;
  let i = 0;
  while (i < text.length) {
    if (open) {
      const end = text.indexOf('*/', i);
      if (end < 0) return true;
      open = false;
      i = end + 2;
    } else {
      const block = text.indexOf('/*', i);
      const line = text.indexOf('//', i);
      if (block < 0 || (line >= 0 && line < block)) return false;
      open = true;
      i = block + 2;
    }
  }
  return open;
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
    let inComment = false;
    const lines: string[] = [];
    for (const raw of body.split('\n')) {
      const scrubbed = scrubScript(raw, redact, inComment);
      lines.push(scrubbed.line);
      inComment = scrubbed.inComment;
    }
    out.push(lines.join('\n'));
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
