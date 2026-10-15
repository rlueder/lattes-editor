// O clique num número ou ponto: que lista do editor abre, e com qual filtro.
// O editor filtra por texto e por tipo de item; recorte por ano e uma visão
// da pessoa em todas as seções ainda não existem, e a seleção diz isso.

import { fold } from '../labels/labels.ts';
import { walk, type XElement } from '../model/xml.ts';
import type { FilterState } from '../ui/facets.ts';
import type { Section } from '../ui/sections.ts';
import type { PanoramaItem } from './model.ts';

/** Para onde o editor vai: a seção, o grupo e o filtro que a seção já sabe aplicar. */
export interface OpenTarget {
  anchor?: string;
  filter?: FilterState;
  sectionId: string;
}

export interface Selection {
  items: PanoramaItem[];
  label: string;
  /** Seleção de uma pessoa: o editor filtra pelo nome. */
  person?: string;
  /** O que o editor ainda não sabe filtrar ("Recorte por ano"). */
  soon?: string;
}

type Place = { groupId?: string; sectionId: string };

const placeCache = new WeakMap<Section[], Map<XElement, Place[]>>();

/** Cada elemento das seções, com todos os lugares (seção e grupo) onde aparece. */
function placesOf(sections: Section[]): Map<XElement, Place[]> {
  let map = placeCache.get(sections);
  if (!map) {
    const built = new Map<XElement, Place[]>();
    for (const s of sections)
      for (const g of s.groups)
        for (const el of g.elements)
          walk(el, (node) => {
            const list = built.get(node) ?? [];
            list.push({ groupId: g.id, sectionId: s.id });
            built.set(node, list);
          });
    placeCache.set(sections, built);
    map = built;
  }
  return map;
}

/**
 * A seção e o grupo do editor onde o elemento aparece. Um projeto aparece em
 * Atuação e em Projetos; vale a seção própria do item, se ele estiver lá.
 */
export function locate(sections: Section[], item: PanoramaItem): Place {
  const places = placesOf(sections).get(item.el) ?? [];
  return (
    places.find((p) => p.sectionId === item.sectionId) ?? places[0] ?? { sectionId: item.sectionId }
  );
}

/** Termos de busca a partir de um texto: sem pontuação, só as primeiras palavras. */
export function searchTerms(text: string, words = 8): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, words)
    .join(' ');
}

const query = (q: string): FilterState => ({ query: q, selected: {} });

/** Um item só: a seção dele, filtrada pelo título. */
export function itemTarget(sections: Section[], item: PanoramaItem): OpenTarget {
  const { groupId, sectionId } = locate(sections, item);
  const text = item.title || (item.kind === 'orientacao' ? item.student : '');
  return { anchor: groupId, filter: text ? query(searchTerms(text)) : undefined, sectionId };
}

/**
 * Vários itens: a seção comum, o grupo comum e, quando todos são do mesmo
 * tipo, o filtro de tipo da seção. Itens de seções diferentes não têm uma
 * lista só no editor: o alvo é a seção da maioria.
 */
export function listTarget(sections: Section[], items: PanoramaItem[]): OpenTarget | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return itemTarget(sections, items[0]!);
  const places = items.map((i) => locate(sections, i));
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p.sectionId, (counts.get(p.sectionId) ?? 0) + 1);
  const sectionId = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  const inSection = places.filter((p) => p.sectionId === sectionId);
  const groups = new Set(inSection.map((p) => p.groupId));
  const names = new Set(
    items.filter((_, i) => places[i]!.sectionId === sectionId).map((i) => i.el.name),
  );
  const [name] = [...names];
  return {
    anchor: groups.size === 1 ? [...groups][0] : undefined,
    filter: names.size === 1 && name ? { query: '', selected: { tipo: name } } : undefined,
    sectionId,
  };
}

/** Uma pessoa: a seção onde ela mais aparece, filtrada pelo nome. */
export function personTarget(
  sections: Section[],
  name: string,
  items: PanoramaItem[],
): OpenTarget | undefined {
  const base = listTarget(sections, items);
  return base && { filter: query(searchTerms(name)), sectionId: base.sectionId };
}

/** Os itens caem em mais de uma seção do editor. */
export function spansSections(sections: Section[], items: PanoramaItem[]): boolean {
  return new Set(items.map((i) => locate(sections, i).sectionId)).size > 1;
}
