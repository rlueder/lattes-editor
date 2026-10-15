// Filtros de uma lista de itens, tirados dos próprios dados: o tipo do item
// (quando a lista mistura tipos), campos enumerados (natureza, forma de
// participação, nível…) e campos de lugar (país, UF). Um campo só vira filtro
// quando divide a lista de verdade.

import { attributeLabel, elementLabel, enumLabel, fold } from '../labels/labels.ts';
import { MISSING_CHECKS, missingCheck, type OwnerTest } from '../model/missing.ts';
import { childElements, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { flagAsShown } from './field-kind.ts';
import { itemMeta } from './item-meta.ts';
import { effectiveQuery } from './query.ts';
import { inYears } from './year-filter.ts';
import type { YearRange } from './year-range.ts';

export interface FacetOption {
  count: number;
  label: string;
  value: string;
}

export interface Facet {
  id: string;
  label: string;
  /** Faceta em que um item casa com vários valores ("Faltando": sem DOI e sem ISSN). */
  matches?: (el: XElement, value: string) => boolean;
  options: FacetOption[];
  valueOf: (el: XElement) => string | undefined;
}

const MAX_OPTIONS = 12;
const MAX_FACETS = 4;
const PLACE = /^(PAIS|NOME-PAIS|SIGLA-UF|UF)(-|$)/;
/**
 * Texto livre no XSD, mas preenchido pelo Lattes com códigos (FORMA-PARTICIPACAO="OUVINTE").
 */
const CATEGORICAL = new Set(['FORMA-PARTICIPACAO', 'TIPO-PARTICIPACAO', 'NATUREZA', 'TIPO']);
/** Enumerados que não ajudam a filtrar (marcas sim/não, formatos de data). */
const SKIP = /^(FLAG-|FORMATO-|PERMISSAO)/;

/** O item e suas partes (DADOS-BASICOS-*, DETALHAMENTO-*, VINCULOS), onde os valores moram. */
function sources(el: XElement): XElement[] {
  return [
    el,
    ...childElements(el).filter(
      (c) =>
        c.name.startsWith('DADOS-BASICOS') ||
        c.name.startsWith('DETALHAMENTO') ||
        c.name === 'VINCULOS',
    ),
  ];
}

function candidateAttrs(el: XElement): { attr: string; enumerated: boolean; value: string }[] {
  const out: { attr: string; enumerated: boolean; value: string }[] = [];
  for (const src of sources(el)) {
    const spec = lattesSchema.elements[src.name];
    for (const a of src.attrs) {
      // Marcas que a exportação grava ao contrário filtram no sentido da tela.
      const value = flagAsShown(src.name, a.name, a.value.trim());
      if (!value || SKIP.test(a.name)) continue;
      const enumerated =
        Boolean(spec?.attributes.find((s) => s.name === a.name)?.enum) ||
        (CATEGORICAL.has(a.name) && /^[A-Z0-9_]+$/.test(value));
      if (enumerated || PLACE.test(a.name) || CATEGORICAL.has(a.name)) {
        out.push({ attr: a.name, enumerated, value });
      }
    }
  }
  return out;
}

function options(
  items: XElement[],
  valueOf: (el: XElement) => string | undefined,
  label: (v: string) => string,
  pageOrder = false,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const el of items) {
    const v = valueOf(el);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  // Ordem alfabética pelo rótulo, que é o que se lê na lista; a contagem
  // fica entre parênteses e não muda a posição. Na ordem da página, cada
  // valor fica onde aparece primeiro (o Map guarda a ordem de inserção).
  const list = [...counts].map(([value, count]) => ({ count, label: label(value), value }));
  return pageOrder ? list : list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/**
 * Facetas da seção. Com `typesInPageOrder`, o filtro de tipo segue a ordem em
 * que os tipos aparecem na página (Dados gerais, que começa pela
 * identificação); nas outras seções, a ordem é alfabética.
 */
export function buildFacets(
  items: XElement[],
  {
    owner = NO_OWNER,
    typesInPageOrder = false,
  }: { owner?: OwnerTest; typesInPageOrder?: boolean } = {},
): Facet[] {
  const facets: Facet[] = [];

  const kinds = options(items, (el) => el.name, elementLabel, typesInPageOrder);
  if (kinds.length > 1) {
    facets.push({ id: 'tipo', label: 'Tipo', options: kinds, valueOf: (el) => el.name });
  }

  // Atual ou encerrado, quando a lista tem dos dois (atuações, formações).
  const situation = (el: XElement) => {
    const meta = itemMeta(el);
    if (!meta.start) return undefined;
    return meta.current ? 'atual' : 'encerrado';
  };
  const situations = options(items, situation, (v) => (v === 'atual' ? 'Atual' : 'Encerrado'));
  if (situations.length > 1) {
    facets.push({ id: 'situacao', label: 'Situação', options: situations, valueOf: situation });
  }

  // Atributos candidatos: presentes em pelo menos metade dos itens.
  const seen = new Map<string, { enumerated: boolean; n: number }>();
  for (const el of items) {
    const attrs = new Map(candidateAttrs(el).map((c) => [c.attr, c.enumerated]));
    for (const [attr, enumerated] of attrs) {
      const entry = seen.get(attr) ?? { enumerated, n: 0 };
      entry.n++;
      seen.set(attr, entry);
    }
  }
  for (const [attr, { enumerated, n }] of seen) {
    if (n < items.length / 2 || facets.length >= MAX_FACETS) continue;
    const valueOf = (el: XElement) => candidateAttrs(el).find((c) => c.attr === attr)?.value;
    const opts = options(items, valueOf, enumerated ? enumLabel : (v) => v);
    if (opts.length < 2 || opts.length > MAX_OPTIONS) continue;
    facets.push({ id: attr, label: attributeLabel(attr), options: opts, valueOf });
  }
  const missing = missingFacet(items, owner);
  if (missing) facets.push(missing);
  return facets;
}

const NO_OWNER: OwnerTest = () => false;

/**
 * "Faltando": uma opção por campo que existe em algum item da seção (DOI,
 * ISSN, palavras-chave…), com quantos itens estão sem ele. As verificações
 * são as mesmas da Saúde do currículo (src/model/missing.ts).
 */
export function missingFacet(items: XElement[], owner: OwnerTest): Facet | undefined {
  const opts = MISSING_CHECKS.flatMap((c) => {
    const applies = items.filter((el) => c.applies(el, owner));
    if (applies.length === 0) return [];
    const count = applies.filter((el) => c.missing(el, owner)).length;
    return [{ count, label: c.label, value: c.id }];
  });
  if (opts.length === 0) return undefined;
  return {
    id: 'faltando',
    label: 'Faltando',
    matches: (el, value) => {
      const c = missingCheck(value);
      return c !== undefined && c.applies(el, owner) && c.missing(el, owner);
    },
    options: opts,
    valueOf: () => undefined,
  };
}

export interface FilterState {
  query: string;
  /** Faceta → valor escolhido; ausente = todos. */
  selected: Record<string, string>;
  /** Período: só os registros com algum ano dentro dele (year-filter.ts). */
  years?: YearRange;
}

export const NO_FILTER: FilterState = { query: '', selected: {} };

export function isFiltering(state: FilterState): boolean {
  return (
    effectiveQuery(state.query) !== '' ||
    Object.keys(state.selected).length > 0 ||
    state.years !== undefined
  );
}

/**
 * Busca por início de palavra: cada termo digitado precisa começar alguma
 * palavra do texto ("agê" acha "Agência", não "Adage"). Sem acento e sem
 * caixa; a ordem dos termos não importa. Só filtra a partir de 3 caracteres
 * (query.ts).
 */
export function matchesQuery(text: string, query: string): boolean {
  const terms = fold(effectiveQuery(query)).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const words = fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return terms.every((t) => words.some((w) => w.startsWith(t)));
}

/** Itens que passam pela busca (no texto do cartão), pelo período e por todas as facetas escolhidas. */
export function applyFilter(
  items: XElement[],
  facets: Facet[],
  state: FilterState,
  textOf: (el: XElement) => string,
  now = new Date().getFullYear(),
): XElement[] {
  return items.filter((el) => {
    if (!matchesQuery(textOf(el), state.query)) return false;
    if (state.years && !inYears(el, state.years, now)) return false;
    return Object.entries(state.selected).every(([id, value]) => {
      const facet = facets.find((f) => f.id === id);
      if (!facet) return true;
      return facet.matches ? facet.matches(el, value) : facet.valueOf(el) === value;
    });
  });
}

/** Filtro vindo da seção: o mesmo estado e as mesmas facetas para todas as listas dela. */
export interface SectionFilter {
  facets: Facet[];
  state: FilterState;
}

/** Texto que a busca considera num cartão. */
export function cardText(card: { subtitle: string; title: string }): string {
  return `${card.title} ${card.subtitle}`;
}

/** Busca de texto em grupos que não são lista (Identificação, Resumo): valores dos atributos. */
export function elementMatchesText(el: XElement, query: string): boolean {
  if (!effectiveQuery(query)) return true;
  return matchesQuery(elementText(el), query);
}

/** Todos os valores do elemento e dos filhos: um termo pode estar num campo e o outro em outro. */
function elementText(el: XElement): string {
  const values: string[] = [];
  const visit = (node: XElement) => {
    for (const a of node.attrs) values.push(a.value);
    for (const c of node.children) {
      if (c.kind === 'text') values.push(c.value);
      else if (c.kind === 'element') visit(c);
    }
  };
  visit(el);
  return values.join(' ');
}

/**
 * Texto que a busca considera num registro da leitura: o do cartão e todos os
 * valores do item, inclusive os das listas dentro dele (o projeto de uma
 * atividade, a equipe do projeto). A lista fechada que tem o resultado abre
 * (nested-collapse.ts).
 */
export function recordSearchText(card: { subtitle: string; title: string }, el: XElement): string {
  return `${cardText(card)} ${elementText(el)}`;
}
