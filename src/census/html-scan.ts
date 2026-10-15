// Leitura dos formulários de uma página do Lattes sem DOM (LAT-55): os
// controles em ordem de documento, com o rótulo que a pessoa vê ao lado de
// cada um, as opções de rádios e listas e o que está escondido. Roda igual na
// aba do Lattes e nos testes.
//
// O resultado desta leitura ainda tem os valores da página (o que está
// digitado, marcado ou escolhido), porque a passada de edição (link.ts) casa
// esses valores com a exportação. Eles nunca saem daqui para um arquivo:
// census-page.ts monta o registro versionado sem nenhum valor do currículo.

import { decodeHtmlEntities } from '../bridge/html-text.ts';

export interface ScannedOption {
  /** Texto logo antes do rádio ou da caixa, para o desenho "Sim (o) Não (o)". */
  before?: string;
  /** Marcado (rádio, caixa) ou escolhido (lista) na página. Só em memória. */
  chosen: boolean;
  label: string;
  value: string;
}

export interface ScannedField {
  /** O trecho antes do rótulo, caso o rótulo seja na verdade o da primeira opção. */
  altLabel?: string;
  disabled: boolean;
  /** Dentro de um bloco com display:none, que o script da página mostra. */
  inHiddenBlock: boolean;
  label: string;
  maxLength?: number;
  name: string;
  options?: ScannedOption[];
  readOnly: boolean;
  /** input type, "select-one", "select-multiple" ou "textarea". */
  type: string;
  /** Texto digitado (texto, área, oculto). Só em memória. */
  value: string;
}

export interface ScannedForm {
  action: string;
  fields: ScannedField[];
  method: string;
  name: string;
  /** Controles sem name (caixas de busca das grades), que não vão no envio. */
  unnamed: number;
}

/** Tags que não se fecham. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Tags que quebram o texto em trechos, como o navegador quebra a linha ou a célula. */
const BREAKS = new Set([
  'br',
  'dd',
  'div',
  'dt',
  'fieldset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'label',
  'legend',
  'li',
  'p',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

/** Botões não são campos: o texto ao lado deles não é rótulo do campo seguinte. */
const BUTTON_TYPES = new Set(['button', 'image', 'reset', 'submit']);

// Sem caixa: páginas PL/SQL antigas escrevem <SCRIPT> e <TEXTAREA>, e com a
// flag i a referência \1 casa o fechamento em qualquer caixa.
const TOKEN =
  /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b([^>]*)>([\s\S]*?)(?:<\/\1\s*>|$)|<\/?[a-zA-Z][^>]*>|[^<]+|</gi;

export function tagAttrs(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of inner.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const key = m[1]!.toLowerCase();
    if (!(key in out)) out[key] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Rótulo limpo: sem os dois-pontos e o asterisco de obrigatório no fim. */
export function cleanLabel(text: string): string {
  return oneLine(text)
    .replace(/[\s:*]+$/, '')
    .replace(/^[\s*]+/, '')
    .trim();
}

function hidesContent(attrs: Record<string, string>): boolean {
  if ('hidden' in attrs) return true;
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style ?? '');
}

interface OpenTag {
  hidden: boolean;
  tag: string;
}

/**
 * Os rótulos dados por <label for="id">, quando a página os usa. O texto
 * entre as tags, sem as tags internas.
 */
function labelsFor(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label\s*>/gi)) {
    const target = tagAttrs(m[1] ?? '').for;
    const text = cleanLabel(decodeHtmlEntities((m[2] ?? '').replace(/<[^>]*>/g, ' ')));
    if (target && text) out.set(target, text);
  }
  return out;
}

class Scanner {
  forms: ScannedForm[] = [];
  /** Controles fora de qualquer <form>. */
  loose: ScannedForm = { action: '', fields: [], method: '', name: '', unnamed: 0 };
  title = '';
  private current: ScannedForm | undefined;
  private explicit: Map<string, string>;
  private openOption: ScannedOption | undefined;
  private openSelect: ScannedField | undefined;
  /** Dentro de um <select>, com ou sem name: o texto das opções nunca é rótulo. */
  private inSelect = false;
  /** Rádio ou caixa cujo rótulo é o texto logo depois dela. */
  private pending: ScannedOption | undefined;
  private segments: string[] = [''];
  private stack: OpenTag[] = [];

  constructor(html: string) {
    this.explicit = labelsFor(html);
  }

  get form(): ScannedForm {
    return this.current ?? this.loose;
  }

  get hiddenBlock(): boolean {
    return this.stack.some((t) => t.hidden);
  }

  text(raw: string): void {
    const text = decodeHtmlEntities(raw);
    if (this.openOption) {
      this.openOption.label += text;
      return;
    }
    if (this.inSelect) return;
    this.segments[this.segments.length - 1] += text;
  }

  boundary(): void {
    this.closePending();
    this.segments.push('');
  }

  /** O trecho de texto mais recente com conteúdo: o rótulo do próximo campo. */
  takeLabel(): string {
    return this.takeLabels()[0];
  }

  /** Os dois trechos mais recentes com conteúdo, do mais novo para o mais velho. */
  takeLabels(): [string, string] {
    this.closePending();
    const found = [...this.segments].reverse().map(cleanLabel).filter(Boolean);
    this.segments = [''];
    return [found[0] ?? '', found[1] ?? ''];
  }

  /** O texto colado ao controle (sem quebra de célula ou linha no meio), sem consumir. */
  private adjacentText(): string {
    return cleanLabel(this.segments.at(-1) ?? '');
  }

  closePending(): void {
    if (!this.pending) return;
    this.pending.label = cleanLabel(this.segments.join(' '));
    this.pending = undefined;
    this.segments = [''];
  }

  open(tag: string, attrs: Record<string, string>): void {
    if (BREAKS.has(tag)) this.boundary();
    if (tag === 'form') {
      this.current = {
        action: attrs.action ?? '',
        fields: [],
        method: (attrs.method ?? 'get').toLowerCase(),
        name: attrs.name ?? attrs.id ?? '',
        unnamed: 0,
      };
      this.forms.push(this.current);
      return;
    }
    if (tag === 'input') return this.input(attrs);
    if (tag === 'select') return this.select(attrs);
    if (tag === 'option') return this.option(attrs);
    if (!VOID.has(tag)) this.stack.push({ hidden: hidesContent(attrs), tag });
  }

  close(tag: string): void {
    if (BREAKS.has(tag)) this.boundary();
    if (tag === 'form') {
      this.closePending();
      this.current = undefined;
      return;
    }
    if (tag === 'option') {
      this.endOption();
      return;
    }
    if (tag === 'select') {
      this.endOption();
      this.openSelect = undefined;
      this.inSelect = false;
      return;
    }
    const at = this.stack.map((t) => t.tag).lastIndexOf(tag);
    if (at >= 0) this.stack.length = at;
  }

  textarea(attrs: Record<string, string>, content: string): void {
    this.field(attrs, 'textarea', decodeHtmlEntities(content));
  }

  private endOption(): void {
    if (!this.openOption) return;
    const label = oneLine(this.openOption.label);
    this.openOption.label = label;
    // <option> sem value envia o próprio texto.
    if (this.openOption.value === '\u0000') this.openOption.value = label;
    this.openOption = undefined;
  }

  private option(attrs: Record<string, string>): void {
    this.endOption();
    if (!this.openSelect) return;
    const option: ScannedOption = {
      chosen: 'selected' in attrs,
      label: '',
      value: 'value' in attrs ? attrs.value! : '\u0000',
    };
    this.openSelect.options!.push(option);
    this.openOption = option;
  }

  private select(attrs: Record<string, string>): void {
    const type = 'multiple' in attrs ? 'select-multiple' : 'select-one';
    this.inSelect = true;
    this.openSelect = this.field(attrs, type, '');
    if (this.openSelect) this.openSelect.options = [];
  }

  private input(attrs: Record<string, string>): void {
    const type = (attrs.type ?? 'text').toLowerCase();
    if (BUTTON_TYPES.has(type)) {
      this.takeLabel();
      return;
    }
    if (type === 'hidden') {
      this.field(attrs, type, attrs.value ?? '');
      return;
    }
    if (type !== 'radio' && type !== 'checkbox') {
      this.field(attrs, type, attrs.value ?? '');
      return;
    }
    const name = attrs.name ?? '';
    const group = name
      ? this.form.fields.find((f) => f.name === name && f.type === type)
      : undefined;
    const option: ScannedOption = {
      chosen: 'checked' in attrs,
      label: '',
      value: attrs.value ?? 'on',
    };
    const adjacent = this.adjacentText();
    if (group) {
      option.before = adjacent;
      this.closePending();
      this.segments = [''];
      group.options!.push(option);
    } else {
      const field = this.field(attrs, type, '');
      if (!field) return;
      option.before = adjacent;
      field.options = [option];
    }
    this.pending = option;
  }

  private field(
    attrs: Record<string, string>,
    type: string,
    value: string,
  ): ScannedField | undefined {
    const name = attrs.name ?? '';
    if (!name) {
      this.form.unnamed++;
      if (type !== 'hidden') this.takeLabel();
      return undefined;
    }
    const [near, older] = type === 'hidden' ? ['', ''] : this.takeLabels();
    const max = Number(attrs.maxlength);
    const field: ScannedField = {
      altLabel: older || undefined,
      disabled: 'disabled' in attrs,
      inHiddenBlock: this.hiddenBlock,
      label: (attrs.id && this.explicit.get(attrs.id)) || near,
      maxLength: max > 0 ? max : undefined,
      name,
      readOnly: 'readonly' in attrs,
      type,
      value,
    };
    this.form.fields.push(field);
    return field;
  }
}

/**
 * Rádios e caixas com o texto antes delas ("Sim (o) Não (o)", visto nos
 * projetos e patentes em 15/10/2026): se nem toda opção tem texto depois,
 * mas toda tem texto antes, o rótulo de cada uma é o de antes, e o do campo
 * passa a ser o trecho anterior ao da primeira opção.
 */
export function settleOptionLabels(f: ScannedField): void {
  if ((f.type !== 'radio' && f.type !== 'checkbox') || !f.options?.length) return;
  const opts = f.options;
  const afterAll = opts.every((o) => o.label);
  if (afterAll) return;
  const fieldLabel = f.label;
  if (opts.every((o) => o.before)) {
    for (const o of opts) o.label = o.before!;
    if (fieldLabel === opts[0]!.before) f.label = f.altLabel ?? '';
    return;
  }
  opts.forEach((o, i) => {
    if (!o.label && o.before && (i > 0 || o.before !== fieldLabel)) o.label = o.before;
  });
}

/** Os formulários da página, na ordem do documento, com os controles fora de <form> por último. */
export function scanForms(html: string): { forms: ScannedForm[]; title: string } {
  const s = new Scanner(html);
  for (const m of html.matchAll(TOKEN)) {
    const token = m[0];
    if (token.startsWith('<!--')) continue;
    const raw = m[1]?.toLowerCase();
    if (raw === 'textarea') {
      s.textarea(tagAttrs(m[2] ?? ''), m[3] ?? '');
      continue;
    }
    if (raw === 'title') {
      s.title = oneLine(decodeHtmlEntities(m[3] ?? ''));
      continue;
    }
    if (raw) continue; // script, style
    const tag = /^<(\/?)([a-zA-Z][\w-]*)([\s\S]*?)\/?>$/.exec(token);
    if (!tag) {
      s.text(token);
      continue;
    }
    const name = tag[2]!.toLowerCase();
    if (tag[1]) s.close(name);
    else s.open(name, tagAttrs(tag[3] ?? ''));
  }
  s.closePending();
  const forms = s.loose.fields.length || s.loose.unnamed ? [...s.forms, s.loose] : s.forms;
  for (const form of forms) for (const f of form.fields) settleOptionLabels(f);
  return { forms, title: s.title };
}
