// Onde um item aparece na navegação do editor: a seção e o grupo (a âncora
// "producoes/artigos-completos-publicados"), para o diagnóstico levar até ele.

import { walk, type XElement } from '../model/xml.ts';
import type { Section } from '../ui/sections.ts';

export interface Place {
  /** Id do grupo, usado como âncora na URL e no DOM. */
  anchor: string;
  groupLabel: string;
  sectionId: string;
  sectionLabel: string;
}

function contains(root: XElement, target: XElement): boolean {
  let hit = false;
  walk(root, (el) => {
    if (el === target) hit = true;
  });
  return hit;
}

/**
 * A primeira seção de verdade que mostra o item. As seções-filtro (Inovação,
 * Educação) só reúnem itens de outras e ficam de fora.
 */
export function locate(sections: Section[], item: XElement): Place | undefined {
  for (const s of sections) {
    if (s.importable === 'filtro') continue;
    for (const g of s.groups) {
      if (g.elements.some((el) => contains(el, item))) {
        return { anchor: g.id, groupLabel: g.label, sectionId: s.id, sectionLabel: s.label };
      }
    }
  }
  return undefined;
}
