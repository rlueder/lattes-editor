// Formulários do Lattes vistos como o navegador os envia: só os controles
// "bem-sucedidos" (com nome, habilitados, caixas marcadas), em Latin-1, do
// jeito que o POST clássico de enviar() mandaria.

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
 * montar a lista. Inferido: nenhum evento foi enviado (docs/lattes_internals.md,
 * seção 16).
 */
export function withCheckRules(form: string, controls: FormControl[], pairs: Pairs): Pairs {
  if (form === 'GN_TEC') {
    const ouvinte = pairValue(pairs, 'F_FORMA') === '40';
    const tpo = controls.some((c) => c.name === 'F_TPO');
    return ouvinte && tpo && pairValue(pairs, 'F_TPO') === null ? [...pairs, ['F_TPO', '']] : pairs;
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
