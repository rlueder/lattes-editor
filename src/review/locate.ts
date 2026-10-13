// Onde um item aparece na navegação do editor: a seção e o grupo (a âncora
// "producoes/artigos-completos-publicados"), para o diagnóstico levar até ele.

import { getAttr, walk, type XElement } from '../model/xml.ts';
import type { Section } from '../ui/sections.ts';

export interface Place {
  /** Id do grupo, usado como âncora na URL e no DOM. */
  anchor: string;
  groupLabel: string;
  sectionId: string;
  sectionLabel: string;
}

/**
 * Cada elemento do documento, até o mais fundo, ligado à primeira seção de
 * verdade que o mostra. Montado uma vez e consultado por item, em vez de
 * percorrer o documento para cada achado. As seções-filtro (Inovação,
 * Educação) só reúnem itens de outras e ficam de fora.
 */
export function placeIndex(sections: Section[]): Map<XElement, Place> {
  const index = new Map<XElement, Place>();
  for (const s of sections) {
    if (s.importable === 'filtro') continue;
    for (const g of s.groups) {
      const place = { anchor: g.id, groupLabel: g.label, sectionId: s.id, sectionLabel: s.label };
      for (const el of g.elements) {
        walk(el, (node) => {
          if (!index.has(node)) index.set(node, place);
        });
      }
    }
  }
  return index;
}

export function locate(sections: Section[], item: XElement): Place | undefined {
  return placeIndex(sections).get(item);
}

/**
 * O mesmo item no documento aberto, achado pelo tipo e pela
 * SEQUENCIA-PRODUCAO: os itens da exportação original são outros objetos.
 */
export function bySequencia(root: XElement): Map<string, XElement> {
  const map = new Map<string, XElement>();
  walk(root, (el) => {
    const seq = getAttr(el, 'SEQUENCIA-PRODUCAO');
    if (seq !== undefined) map.set(`${el.name}:${seq}`, el);
  });
  return map;
}

export function sequenciaKey(el: XElement): string | undefined {
  const seq = getAttr(el, 'SEQUENCIA-PRODUCAO');
  return seq === undefined ? undefined : `${el.name}:${seq}`;
}
