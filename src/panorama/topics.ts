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

export interface Check {
  hint: string;
  id: string;
  label: string;
  /** Os que faltam completar. */
  missing: PanoramaItem[];
  /** Itens a que a pergunta se aplica. */
  total: PanoramaItem[];
}

function check<T extends PanoramaItem>(
  id: string,
  label: string,
  items: T[],
  ok: (x: T) => boolean,
  hint = '',
): Check {
  return { hint, id, label, missing: items.filter((x) => !ok(x)), total: items };
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
    check(
      'doi',
      'Artigos com DOI',
      articles,
      (x) => x.doi !== '',
      'Sem DOI, o artigo não se liga ao OpenAlex nem ao Crossref.',
    ),
    check(
      'issn',
      'Artigos com ISSN',
      articles,
      (x) => x.issn !== '',
      'O ISSN é a chave para o Qualis.',
    ),
    check(
      'volume',
      'Artigos com volume e páginas',
      articles,
      (x) => x.volume !== '' && x.pages !== '',
    ),
    check(
      'doi-eventos',
      'Trabalhos em eventos com DOI',
      events,
      (x) => x.doi !== '',
      'Nem todo anais tem DOI; aqui é aviso, não erro.',
    ),
    check('isbn', 'Livros e capítulos com ISBN', books, (x) => x.isbn !== ''),
    check(
      'palavras-chave',
      'Produções com palavras-chave',
      prods,
      (x) => x.keywords.length > 0,
      'Alimenta o gráfico de temas.',
    ),
    check(
      'titulo-ingles',
      'Produções com título em inglês',
      prods,
      (x) => x.titleEn !== '',
      'Usado quando o currículo é lido em inglês.',
    ),
    check('agencia', 'Orientações com agência de fomento', supervisions, (x) => x.agency !== ''),
    check(
      'id-cnpq',
      'Coautorias com ID CNPq em todos os coautores',
      coauthored,
      (x) => x.authors.every((a) => a.self || a.cnpq !== ''),
      'Liga o coautor ao currículo dele e separa homônimos.',
    ),
  ].filter((c) => c.total.length > 0);
}

export interface Flag {
  hint: string;
  label: string;
  ok: boolean;
}

export function profileFlags(cv: CvData): Flag[] {
  return [
    {
      hint: 'Necessário para buscar produções no OpenAlex.',
      label: 'ORCID iD',
      ok: cv.orcid !== '',
    },
    { hint: '', label: 'Resumo em inglês', ok: cv.summaryEn !== '' },
  ];
}
