// Formulários do Lattes vistos como o navegador os envia: só os controles
// "bem-sucedidos" (com nome, habilitados, caixas marcadas), em Latin-1, do
// jeito que o POST clássico de enviar() mandaria.

import { foldText } from '../model/fold-text.ts';

export interface FormControl {
  checked?: boolean;
  disabled?: boolean;
  /** Limite do campo (maxlength), quando o HTML declara. */
  maxLength?: number;
  name: string;
  /** Valores escolhidos de uma lista (select). */
  selected?: string[];
  /** input type, "select", "textarea". */
  type: string;
  value: string;
}

export type Pairs = [string, string][];

const NEVER_SENT = new Set(['button', 'submit', 'reset', 'file', 'image']);

export function successfulPairs(controls: FormControl[]): Pairs {
  const pairs: Pairs = [];
  for (const c of controls) {
    if (!c.name || c.disabled || NEVER_SENT.has(c.type)) continue;
    if ((c.type === 'checkbox' || c.type === 'radio') && !c.checked) continue;
    if (c.type === 'select' || c.type.startsWith('select-')) {
      for (const v of c.selected ?? []) pairs.push([c.name, v]);
      continue;
    }
    pairs.push([c.name, c.value]);
  }
  return pairs;
}

/**
 * O que check() faz antes de enviar e o navegador não: no vínculo, o tipo
 * fica num campo desabilitado (f_vinc) e é copiado para o oculto f_vinculo.
 *
 * No evento de ouvinte (F_FORMA 40), a lista F_TPO vem vazia no HTML e só
 * ganha opções no clique da forma (montaTipoApres(); para ouvinte, só a
 * opção vazia). O envio leva F_TPO vazio, como a página mandaria depois de
 * montar a lista. Observado: o POST de 14/10/2026 foi com F_TPO vazio e o
 * Lattes gravou (docs/lattes_internals.md, seção 16).
 */
export function withCheckRules(form: string, controls: FormControl[], pairs: Pairs): Pairs {
  // GN_TEC é também o nome do formulário de editoração e de outras produções
  // técnicas; só o de eventos tem o rádio F_FORMA e a lista F_TPO.
  if (form === 'GN_TEC') {
    const has = (name: string, type: string) =>
      controls.some((c) => c.name === name && c.type === type);
    const evento = has('F_FORMA', 'radio') && has('F_TPO', 'select-one');
    const ouvinte = pairValue(pairs, 'F_FORMA') === '40';
    return evento && ouvinte && pairValue(pairs, 'F_TPO') === null
      ? [...pairs, ['F_TPO', '']]
      : pairs;
  }
  if (form !== 'GN_ATIV_VINC') return pairs;
  const vinc = controls.find((c) => c.name === 'f_vinc')?.value ?? '';
  return pairs.map(([k, v]) => (k === 'f_vinculo' ? [k, vinc] : [k, v]));
}

/** Valor de um campo nos pares; null quando não vai no envio (caixa desmarcada). */
export function pairValue(pairs: Pairs, name: string): string | null {
  const found = pairs.find(([k]) => k === name);
  return found ? found[1] : null;
}

/** Troca valores; null tira o campo do envio (desmarca a caixa); campo novo vai no fim. */
export function setPairs(pairs: Pairs, set: Record<string, string | null>): Pairs {
  const out: Pairs = [];
  const done = new Set<string>();
  for (const [k, v] of pairs) {
    if (k in set) {
      if (done.has(k)) continue;
      done.add(k);
      const next = set[k];
      if (next !== null && next !== undefined) out.push([k, next]);
      continue;
    }
    out.push([k, v]);
  }
  for (const [k, v] of Object.entries(set)) {
    if (!done.has(k) && v !== null) out.push([k, v]);
  }
  return out;
}

/** Quebra de linha como o navegador envia (CRLF), para comparar e para codificar. */
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n');
}

const UNRESERVED = /[A-Za-z0-9_.~*-]/;

/** Um valor em application/x-www-form-urlencoded, com bytes Latin-1. */
function encodeValue(value: string): string {
  let out = '';
  for (const ch of normalizeNewlines(value)) {
    const code = ch.codePointAt(0)!;
    if (code > 255) {
      // Fora do Latin-1: referência numérica, como o navegador faz num formulário Latin-1.
      out += encodeURIComponent(`&#${code};`);
    } else if (UNRESERVED.test(ch)) out += ch;
    else if (ch === ' ') out += '+';
    else out += `%${code.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

export function encodeLatin1Form(pairs: Pairs): string {
  return pairs.map(([k, v]) => `${encodeValue(k)}=${encodeValue(v)}`).join('&');
}

/** Para comparar: sem acento, caixa nem espaço nas pontas, e número sem zero à esquerda (06 é 6). */
const folded = (value: string | null) => {
  const text = value === null ? '' : foldText(value.trim());
  // Só os zeros à esquerda: número longo (processo, documento) não passa por Number.
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, '') : text;
};

/**
 * Os campos de identidade (OpBase.identity) que o formulário não confirma:
 * sem acento, caixa nem espaço nas pontas, e com números comparados pelo
 * valor, o do Lattes precisa ser um dos aceitos.
 */
export function identityMismatches(
  identity: Record<string, string[]> | undefined,
  value: (name: string) => string | null,
): string[] {
  return Object.entries(identity ?? {})
    .filter(([name, ok]) => !ok.some((v) => folded(v) === folded(value(name))))
    .map(([name]) => name);
}

/**
 * Os valores que a página põe por script depois de carregar, num comando
 * solto `$("[name=campo]").val("valor")`: as privacidades e o oculto da cor
 * ou raça do formulário de identificação (lido em 18/10/2026) vêm assim, com
 * o HTML no valor padrão. Lido só o HTML, o envio voltava os padrões
 * (Privado virava Público). Só esse seletor exato, que a página usa fora de
 * função; os $("input[name=…]") de dentro de cliques ficam de fora.
 */
export function scriptValues(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(
    /\$\(\s*"\[name=([A-Za-z0-9_]+)\]"\s*\)\.val\(\s*"([^"\\]*)"\s*\)/g,
  )) {
    out.set(m[1]!, m[2]!);
  }
  return out;
}

/** Os controles com os valores que a página põe por script (scriptValues). */
export function withScriptValues(
  html: string,
  controls: FormControl[] | undefined,
): FormControl[] | undefined {
  if (!controls) return controls;
  const values = scriptValues(html);
  if (values.size === 0) return controls;
  return controls.map((c) => {
    const v = values.get(c.name);
    if (v === undefined || c.type === 'radio' || c.type === 'checkbox') return c;
    return c.type === 'select' || c.type.startsWith('select-')
      ? { ...c, selected: [v], value: v }
      : { ...c, value: v };
  });
}
