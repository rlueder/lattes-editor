// Prévia do bloco em edição no modo de leitura: a mesma composição da
// leitura, no topo, com o que se está digitando nos campos abaixo dela. Os
// campos gravam ao sair (AttributeField); os rascunhos só valem para a prévia.

import { cloneElement, getAttr, setAttr, type XElement } from '../model/xml.ts';
import { flatten } from './reading-layout.ts';

/** Rascunhos por elemento: atributo e texto digitado, ainda não gravado. */
export type Drafts = ReadonlyMap<XElement, Readonly<Record<string, string>>>;

/** Um rascunho a mais (ou trocado), num mapa novo. */
export function addDraft(drafts: Drafts, el: XElement, attr: string, value: string): Drafts {
  const next = new Map(drafts);
  next.set(el, { ...drafts.get(el), [attr]: value });
  return next;
}

/**
 * O bloco como ficaria com os rascunhos: uma cópia com os textos digitados
 * aplicados, para a prévia. O original não muda; sem rascunho, é ele mesmo.
 */
export function withDrafts(root: XElement, drafts: Drafts): XElement {
  const changed = flatten(root).some((el) => {
    const d = drafts.get(el);
    return d && Object.entries(d).some(([attr, v]) => (getAttr(el, attr) ?? '') !== v);
  });
  if (!changed) return root;
  const originals = flatten(root);
  const copies = flatten(cloneElement(root));
  originals.forEach((el, i) => {
    for (const [attr, v] of Object.entries(drafts.get(el) ?? {})) {
      if (getAttr(el, attr) !== undefined) setAttr(copies[i]!, attr, v);
    }
  });
  return copies[0]!;
}
