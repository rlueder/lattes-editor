// Onde publica, sobre o que escreve e o que falta preencher: contagens puras
// sobre o CvData.

import { fold } from '../labels/labels.ts';
import { type Period, within } from './aggregate.ts';
import type {
  CvData,
  EventParticipation,
  PanoramaItem,
  Production,
  ProductionGroup,
  Supervision,
} from './model.ts';

export interface Bucket<T = PanoramaItem> {
  items: T[];
  label: string;
  /** Detalhe ao lado do nome (ISSN, anos e cidades). */
  note?: string;
}

const byCount = <T>(a: Bucket<T>, b: Bucket<T>) =>
  b.items.length - a.items.length || a.label.localeCompare(b.label, 'pt-BR');

function bucket<T>(items: T[], keyOf: (x: T) => string, labelOf: (x: T) => string): Bucket<T>[] {
  const map = new Map<string, Bucket<T>>();
  for (const x of items) {
    const key = keyOf(x);
    if (!key) continue;
    const b = map.get(key) ?? { items: [], label: labelOf(x) };
    b.items.push(x);
    map.set(key, b);
  }
  return [...map.values()].sort(byCount);
}

/** "68º Congresso Brasileiro de Genética" e "69º Congresso…" são a mesma série. */
export function eventSeries(name: string): string {
  return name
    .replace(/^\s*\d+\s*[ºª°o]?\s*/i, '')
    .replace(/\s+\d{4}\s*$/, '')
    .trim();
}

export interface Venues {
  countries: Bucket<Production>[];
  events: Bucket<EventParticipation | Production>[];
  international: number;
  journals: Bucket<Production>[];
  languages: Bucket<Production>[];
  national: number;
}

export function venues(cv: CvData, p: Period): Venues {
  const prods = within(cv.productions, p);
  const articles = prods.filter((x) => x.group === 'artigos');
  const journals = bucket(
    articles,
    (x) => fold(x.venue),
    (x) => x.venue,
  ).map((b) => ({ ...b, note: b.items[0]?.issn ? `ISSN ${b.items[0].issn}` : 'sem ISSN' }));
  const eventWorks = prods.filter((x) => x.group === 'eventos');
  const eventItems: (EventParticipation | Production)[] = [...eventWorks, ...within(cv.events, p)];
  const nameOf = (x: EventParticipation | Production) => (x.kind === 'evento' ? x.event : x.venue);
  const events = bucket(
    eventItems,
    (x) => fold(eventSeries(nameOf(x))),
    (x) => eventSeries(nameOf(x)),
  ).map((b) => {
    const years = [...new Set(b.items.map((x) => x.year).filter(Boolean))].sort();
    const cities = [...new Set(b.items.map((x) => x.city).filter(Boolean))];
    return { ...b, note: [years.join(', '), cities.join(', ')].filter(Boolean).join(' · ') };
  });
  return {
    countries: bucket(
      prods,
      (x) => x.country,
      (x) => x.country,
    ),
    events,
    international: eventWorks.filter((x) => x.eventClass === 'INTERNACIONAL').length,
    journals,
    languages: bucket(
      prods,
      (x) => x.lang || 'Não informado',
      (x) => x.lang || 'Não informado',
    ),
    national: eventWorks.filter((x) => x.eventClass === 'NACIONAL').length,
  };
}

export interface Topic {
  items: Production[];
  label: string;
  /** Aparece em mais de uma produção. */
  repeated: boolean;
}

export interface Topics {
  topics: Topic[];
  total: number;
  withKeywords: number;
}

export function topics(cv: CvData, p: Period, onlyRepeated = false, limit = 24): Topics {
  const prods = within(cv.productions, p);
  const withKeywords = prods.filter((x) => x.keywords.length > 0);
  const map = new Map<string, Topic>();
  for (const prod of withKeywords) {
    for (const k of prod.keywords) {
      const key = fold(k);
      const t = map.get(key) ?? { items: [], label: k, repeated: false };
      if (!t.items.includes(prod)) t.items.push(prod);
      map.set(key, t);
    }
  }
  const firstYear = (t: Topic) => Math.min(...t.items.map((x) => x.year ?? 9999));
  const list = [...map.values()]
    .map((t) => ({ ...t, repeated: t.items.length > 1 }))
    .filter((t) => !onlyRepeated || t.repeated)
    .sort((a, b) => Number(b.repeated) - Number(a.repeated) || firstYear(a) - firstYear(b))
    .slice(0, limit);
  return { topics: list, total: prods.length, withKeywords: withKeywords.length };
}

// ---------- Saúde do currículo ----------

/** Grupos da lista, na ordem em que aparecem. */
export const HEALTH_GROUPS = ['Produções', 'Eventos', 'Pessoas', 'Orientações', 'Perfil'] as const;
export type HealthGroup = (typeof HEALTH_GROUPS)[number];

export interface Check {
  group: HealthGroup;
  hint: string;
  id: string;
  label: string;
  /** Os que faltam completar. */
  missing: PanoramaItem[];
  /** Itens a que a pergunta se aplica. */
  total: PanoramaItem[];
}

interface CheckSpec<T extends PanoramaItem> {
  group: HealthGroup;
  hint: string;
  id: string;
  items: T[];
  label: string;
  ok: (x: T) => boolean;
}

function check<T extends PanoramaItem>(spec: CheckSpec<T>): Check {
  const { group, hint, id, items, label, ok } = spec;
  return { group, hint, id, label, missing: items.filter((x) => !ok(x)), total: items };
}

export function healthChecks(cv: CvData, p: Period, group?: ProductionGroup): Check[] {
  const prods = within(cv.productions, p).filter((x) => !group || x.group === group);
  const articles = prods.filter((x) => x.group === 'artigos');
  const events = prods.filter((x) => x.group === 'eventos');
  const books = prods.filter((x) => x.group === 'livros');
  const supervisions: Supervision[] = cv.supervisions.filter(
    (s) => s.ongoing || (s.year !== undefined && s.year >= p.from && s.year <= p.to),
  );
  const coauthored = prods.filter((x) => x.authors.some((a) => !a.self));
  return [
    check({
      group: 'Produções',
      hint: 'Liga o artigo ao OpenAlex e ao Crossref.',
      id: 'doi',
      items: articles,
      label: 'Artigos com DOI',
      ok: (x) => x.doi !== '',
    }),
    check({
      group: 'Produções',
      hint: 'Usado para achar o estrato Qualis do periódico.',
      id: 'issn',
      items: articles,
      label: 'Artigos com ISSN',
      ok: (x) => x.issn !== '',
    }),
    check({
      group: 'Produções',
      hint: 'Entram na referência do artigo.',
      id: 'volume',
      items: articles,
      label: 'Artigos com volume e páginas',
      ok: (x) => x.volume !== '' && x.pages !== '',
    }),
    check({
      group: 'Produções',
      hint: 'Identifica a obra na referência.',
      id: 'isbn',
      items: books,
      label: 'Livros e capítulos com ISBN',
      ok: (x) => x.isbn !== '',
    }),
    check({
      group: 'Produções',
      hint: 'Usadas no gráfico Temas.',
      id: 'palavras-chave',
      items: prods,
      label: 'Produções com palavras-chave',
      ok: (x) => x.keywords.length > 0,
    }),
    check({
      group: 'Produções',
      hint: 'Aparece na versão em inglês do currículo.',
      id: 'titulo-ingles',
      items: prods,
      label: 'Produções com título em inglês',
      ok: (x) => x.titleEn !== '',
    }),
    check({
      group: 'Eventos',
      hint: 'Muitos anais não têm DOI; vale como aviso.',
      id: 'doi-eventos',
      items: events,
      label: 'Trabalhos em eventos com DOI',
      ok: (x) => x.doi !== '',
    }),
    check({
      group: 'Pessoas',
      hint: 'Liga cada coautor ao currículo dele no Lattes.',
      id: 'id-cnpq',
      items: coauthored,
      label: 'Coautores com ID CNPq',
      ok: (x) => x.authors.every((a) => a.self || a.cnpq !== ''),
    }),
    check({
      group: 'Orientações',
      hint: 'Agência que financiou a bolsa.',
      id: 'agencia',
      items: supervisions,
      label: 'Orientações com agência de fomento',
      ok: (x) => x.agency !== '',
    }),
  ].filter((c) => c.total.length > 0);
}

export interface Flag {
  hint: string;
  label: string;
  ok: boolean;
}

export function profileFlags(cv: CvData): Flag[] {
  return [
    { hint: 'Usado para buscar produções no OpenAlex.', label: 'ORCID iD', ok: cv.orcid !== '' },
    {
      hint: 'Aparece na versão em inglês do currículo.',
      label: 'Resumo em inglês',
      ok: cv.summaryEn !== '',
    },
  ];
}
