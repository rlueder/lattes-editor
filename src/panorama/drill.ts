// O clique num número ou ponto: que lista do editor abre, e com qual filtro.
// O editor filtra por texto, tipo de item, período e campo que falta; quando
// esses filtros reproduzem exatamente os itens clicados, a seção abre direto.
// Senão, a seleção no painel lista os itens, separados por seção.

import { fold } from '../labels/labels.ts';
import { walk, type XElement } from '../model/xml.ts';
import { applyFilter, buildFacets, type FilterState, recordSearchText } from '../ui/facets.ts';
import { yearView } from '../ui/list-view.ts';
import { groupItemList, type Section } from '../ui/sections.ts';
import type { YearRange } from '../ui/year-range.ts';
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
  /** Verificação de campo que falta (src/model/missing.ts) por trás da seleção. */
  missing?: string;
  /** Seleção de uma pessoa: cada seção abre filtrada pelo nome. */
  person?: string;
  /** Texto que os itens têm em comum (periódico, palavra-chave, país) para a busca da seção. */
  query?: string;
  /** Período por trás da seleção ("artigos de 2019"): a seção abre com ele. */
  years?: YearRange;
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

/** Os registros de uma seção que o filtro dela deixa à mostra, como na página. */
export function sectionResult(section: Section, filter: FilterState, now: number): XElement[] {
  const items = section.groups.flatMap((g) => groupItemList(g)?.items ?? []);
  const facets = buildFacets(items, {
    owner: section.owner,
    typesInPageOrder: section.id === 'dados-gerais',
  });
  return applyFilter(items, facets, filter, (el) => recordSearchText(yearView.card(el), el), now);
}

export interface SelectionGroup {
  /** O filtro da seção mostra exatamente estes itens. */
  exact: boolean;
  items: PanoramaItem[];
  label: string;
  sectionId: string;
  target: OpenTarget;
}

/**
 * A seleção por seção do editor, da que tem mais itens à que tem menos. Em
 * cada uma: o filtro que mais se aproxima (o nome da pessoa; o título de um
 * item só; o tipo, o período e o campo que falta de vários) e se ele mostra
 * exatamente os itens escolhidos.
 */
export function selectionGroups(
  sections: Section[],
  sel: Selection,
  now: number,
): SelectionGroup[] {
  const bySection = new Map<string, { groups: Set<string | undefined>; items: PanoramaItem[] }>();
  for (const item of sel.items) {
    const place = locate(sections, item);
    const entry = bySection.get(place.sectionId) ?? { groups: new Set(), items: [] };
    entry.items.push(item);
    entry.groups.add(place.groupId);
    bySection.set(place.sectionId, entry);
  }
  return [...bySection]
    .sort((a, b) => b[1].items.length - a[1].items.length)
    .map(([sectionId, { groups, items }]) => {
      const section = sections.find((x) => x.id === sectionId);
      const names = new Set(items.map((i) => i.el.name));
      let target: OpenTarget;
      if (sel.person) target = { filter: query(searchTerms(sel.person)), sectionId };
      else if (items.length === 1) target = itemTarget(sections, items[0]!);
      else {
        const selected: Record<string, string> = {};
        if (names.size === 1) selected.tipo = [...names][0]!;
        if (sel.missing) selected.faltando = sel.missing;
        target = {
          anchor: groups.size === 1 ? [...groups][0] : undefined,
          filter: {
            query: sel.query ? searchTerms(sel.query, 12) : '',
            selected,
            years: sel.years,
          },
          sectionId,
        };
      }
      // Filtro de pessoa vale como está: mostra tudo que tem o nome, que é o pedido.
      const shown = section && target.filter ? sectionResult(section, target.filter, now) : [];
      const wanted = new Set(items.map((i) => i.el));
      const exact = shown.length === wanted.size && shown.every((el) => wanted.has(el));
      return { exact, items, label: section?.label ?? sectionId, sectionId, target };
    });
}
