// Ordem "como na prévia" dos campos de um bloco em edição no modo de leitura
// (⚙ "Ordem dos campos"). Sai da mesma composição que desenha a prévia
// (reading-layout.ts): cada campo vai para onde o valor dele aparece no
// texto. Para um campo vazio ainda não aparecer em lugar nenhum, a ordem é
// tirada de uma cópia do bloco com todos os campos preenchidos: o campo fica
// desde já onde vai aparecer quando for preenchido, e não muda de lugar.

import { cloneElement, setAttr, type XElement } from '../model/xml.ts';
import type { FieldSlot } from './field-kind.ts';
import {
  addressLayout,
  fieldsLayout,
  flatten,
  isUsable,
  type LayoutOptions,
  resumoLayout,
  rowRank,
  type Section,
} from './reading-layout.ts';
import { recordLayout } from './reading-records.ts';
import { citationRank, isCitationAttr } from './reading-reference.ts';

export type PreviewKind = 'academic' | 'address' | 'citation' | 'fields' | 'record' | 'resumo';

/** Grupos que a prévia tem: o texto do item, os valores curtos e a referência. */
export const PREVIEW_MAIN = 'Principal';
export const PREVIEW_DETAILS = 'Detalhes';
export const PREVIEW_REFERENCE = 'Referência';

/** Ordem da prévia: sem modo de privacidade (todo campo tem lugar) e sem códigos. */
const ALL: LayoutOptions = { hideSensitive: false, showCodes: false };

/** Valor provisório dos campos vazios na cópia: não é data, ano nem texto longo. */
const PLACEHOLDER = 'x';

/** Cópia do bloco com todo atributo vazio preenchido pelo valor provisório. */
export function fillEmpty(root: XElement): XElement {
  const copy = cloneElement(root);
  for (const el of flatten(copy)) {
    for (const a of el.attrs) if (a.value.trim() === '') setAttr(el, a.name, PLACEHOLDER);
  }
  return copy;
}

function sectionsOf(kind: PreviewKind, root: XElement): Section[] {
  switch (kind) {
    case 'resumo':
      return resumoLayout(root, ALL);
    case 'address':
      return addressLayout(root, ALL);
    case 'fields':
      return fieldsLayout(root, ALL);
    case 'academic':
    case 'record':
      return [recordLayout(root, kind === 'academic', ALL)];
    case 'citation':
      return [];
  }
}

export type PreviewSlotFn = (el: XElement, attr: string) => FieldSlot | undefined;

/**
 * Onde cada campo do bloco fica na ordem da prévia. Nos registros e blocos
 * de campos: primeiro o texto (período, título, instituição, trabalho,
 * orientação, bolsa), em "Principal"; depois os valores curtos da grade, em
 * "Detalhes". Nas produções, cuja prévia é a referência da NBR 6023: os
 * campos que a referência usa, na ordem da citação (título, onde saiu, lugar,
 * ano, volume, páginas, DOI), em "Referência", e os outros em "Detalhes".
 * Os autores ficam no quadro de autores, como sempre.
 */
export function previewSlots(root: XElement, kind: PreviewKind): PreviewSlotFn {
  const originals = flatten(root);
  const filled = fillEmpty(root);
  const copies = flatten(filled);
  const indexOf = new Map(copies.map((el, i) => [el, i]));
  const slots = new Map<string, FieldSlot>();
  let rank = 0;
  const put = (el: XElement, attr: string, label: string) => {
    const key = `${indexOf.get(el)}:${attr}`;
    if (!slots.has(key)) slots.set(key, { label, rank: rank++ });
  };
  if (kind === 'citation') {
    const parts = copies.flatMap((el) =>
      el.name === 'AUTORES'
        ? []
        : el.attrs.filter((a) => isUsable(el, a.name, ALL)).map((a) => ({ attr: a.name, el })),
    );
    const cited = parts
      .filter((p) => isCitationAttr(p.attr))
      .sort((a, b) => citationRank(a.attr) - citationRank(b.attr));
    const rest = parts
      .filter((p) => !isCitationAttr(p.attr))
      .sort((a, b) => rowRank(a.attr) - rowRank(b.attr));
    for (const p of cited) put(p.el, p.attr, PREVIEW_REFERENCE);
    for (const p of rest) put(p.el, p.attr, PREVIEW_DETAILS);
  } else {
    const walk = (s: Section, main: string) => {
      const lines = [...(s.when ? [s.when] : []), ...s.lines];
      for (const p of lines.flatMap((l) => l.parts)) put(p.el, p.attr, main);
      const rowsLabel =
        main !== PREVIEW_MAIN || !lines.some((l) => l.parts.length > 0) ? main : PREVIEW_DETAILS;
      for (const p of s.rows) put(p.el, p.attr, rowsLabel);
      // Listas de filhos (vínculos, integrantes): o grupo leva o nome da lista.
      for (const g of s.nested) for (const item of g.items) walk(item, g.label);
    };
    for (const s of sectionsOf(kind, filled)) walk(s, PREVIEW_MAIN);
  }
  const originalIndex = new Map(originals.map((el, i) => [el, i]));
  return (el, attr) => {
    const i = originalIndex.get(el);
    return i === undefined ? undefined : slots.get(`${i}:${attr}`);
  };
}
