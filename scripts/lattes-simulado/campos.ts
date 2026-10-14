// A ligação entre um campo de formulário do Lattes e o XML do currículo: como
// desenhar o campo com o valor atual e como gravar o que o POST trouxe. Cada
// tela do simulado é uma lista dessas ligações; desenhar e gravar saem da
// mesma lista, então o que o formulário mostra é o que o POST grava.

import { getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';

export interface Binding {
  disabled?: boolean;
  kind: 'checkbox' | 'hidden' | 'radio' | 'select' | 'text' | 'textarea';
  maxLength?: number;
  name: string;
  /** Opções [valor, rótulo] de rádio e lista. */
  options?: [string, string][];
  /** Valor atual no formulário; na caixa, o valor dela quando marcada, ou vazio. */
  read(el: XElement): string;
  /** Valor da caixa marcada. */
  value?: string;
  /** Grava o valor que veio no POST (vazio para caixa desmarcada e rádio sem marca). */
  write?(el: XElement, value: string): void;
}

/** Ligação direta a um atributo. */
export function attr(
  name: string,
  attrName: string,
  kind: Binding['kind'] = 'text',
  extra: Partial<Binding> = {},
): Binding {
  return {
    kind,
    name,
    read: (el) => getAttr(el, attrName) ?? '',
    write: (el, value) => setAttr(el, attrName, value),
    ...extra,
  };
}

/** Ligação a um atributo com tradução nos dois sentidos (SIM ↔ S, POUCO ↔ P). */
export function mapped(
  name: string,
  attrName: string,
  kind: Binding['kind'],
  toForm: Record<string, string>,
  extra: Partial<Binding> = {},
): Binding {
  const toXml = Object.fromEntries(Object.entries(toForm).map(([x, f]) => [f, x]));
  return {
    kind,
    name,
    read: (el) => toForm[getAttr(el, attrName) ?? ''] ?? '',
    write: (el, value) => setAttr(el, attrName, toXml[value] ?? ''),
    ...extra,
  };
}

/** Campo oculto de valor fixo, que o POST não grava. */
export function fixed(name: string, value: string): Binding {
  return { kind: 'hidden', name, read: () => value };
}

/** Desenha os campos, na ordem da lista. */
export function renderFields(bindings: Binding[], el: XElement | undefined): string {
  return bindings
    .map((b) => {
      // Sem elemento (formulário de inclusão), só os ocultos fixos têm valor.
      const value = el ? b.read(el) : b.kind === 'hidden' && !b.write ? b.read(el!) : '';
      const o = { disabled: b.disabled, maxLength: b.maxLength };
      switch (b.kind) {
        case 'checkbox':
          return h.checkbox(b.name, b.value ?? 'on', value !== '');
        case 'hidden':
          return h.hidden(b.name, value);
        case 'radio':
          return `<p>${h.radios(b.name, b.options ?? [], value)}</p>`;
        case 'select':
          return `<p>${h.select(b.name, b.options ?? [], value, o)}</p>`;
        case 'textarea':
          return `<p>${h.textarea(b.name, value, o)}</p>`;
        default:
          return `<p>${h.text(b.name, value, o)}</p>`;
      }
    })
    .join('\n');
}

/**
 * Grava no elemento o que o POST trouxe. Caixa e rádio que não vieram ficam
 * vazios (o navegador não manda caixa desmarcada); campo de texto que não
 * veio fica como estava (desabilitado, ou um envio montado fora da página).
 */
export function applyFields(bindings: Binding[], el: XElement, req: SimRequest): void {
  for (const b of bindings) {
    if (!b.write || b.disabled) continue;
    const value = req.get(b.name);
    if (value === undefined && b.kind !== 'checkbox' && b.kind !== 'radio') continue;
    b.write(el, value ?? '');
  }
}
