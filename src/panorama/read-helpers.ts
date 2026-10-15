// Leitura de atributos e elementos para o Panorama: ano, título, nome de
// pessoa, descendentes.

import { fold } from '../labels/labels.ts';
import { childElements, getAttr, walk, type XElement } from '../model/xml.ts';

export const attr = (el: XElement | undefined, name: string): string =>
  (el && getAttr(el, name)) ?? '';

export const childStarting = (el: XElement, prefix: string): XElement | undefined =>
  childElements(el).find((c) => c.name.startsWith(prefix));

export const yearNum = (value: string): number | undefined =>
  /^\d{4}$/.test(value) ? Number(value) : undefined;

/** Primeiro ANO* de quatro dígitos do elemento (ANO, ANO-DO-ARTIGO, ANO-DO-TRABALHO…). */
export function yearOf(el: XElement | undefined): number | undefined {
  if (!el) return undefined;
  for (const a of el.attrs) {
    if (/^ANO(-|$)/.test(a.name)) {
      const y = yearNum(a.value);
      if (y) return y;
    }
  }
  return undefined;
}

/** Primeiro TITULO* preenchido que não seja a versão em inglês. */
export function titleOf(el: XElement | undefined, english = false): string {
  if (!el) return '';
  const found = el.attrs.find(
    (a) => a.name.startsWith('TITULO') && a.name.endsWith('INGLES') === english && a.value,
  );
  return found?.value ?? '';
}

/** Chave de uma pessoa: nome sem acento, caixa ou pontuação. */
export function personKey(name: string): string {
  return fold(name).replace(/[.,;]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function descendants(root: XElement, test: (el: XElement) => boolean): XElement[] {
  const found: XElement[] = [];
  walk(root, (el) => {
    if (test(el)) found.push(el);
  });
  return found;
}
