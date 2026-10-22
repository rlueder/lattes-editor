// Onde publica, sobre o que escreve e o que falta preencher: contagens puras
// sobre o CvData.

import { fold } from '../labels/labels.ts';
import { missingCheck } from '../model/missing.ts';
import { dated, inPeriod, type Period, within } from './aggregate.ts';
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
  // A grade é por ano: produção sem ano não tem onde aparecer.
  const prods = dated(within(cv.productions, p));
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

interface Row {
  group: HealthGroup;
  hint: string;
  /** Id da verificação em src/model/missing.ts. */
  id: string;
  label: string;
  /** Itens entre os quais a verificação procura os que se aplicam. */
  pool: PanoramaItem[];
}

/**
 * As linhas da Saúde do currículo. Quais itens contam e quais faltam vêm das
 * mesmas verificações do filtro "Faltando" das seções, para os números baterem.
 */
export function healthChecks(cv: CvData, p: Period, group?: ProductionGroup): Check[] {
  const prods = within(cv.productions, p).filter((x) => !group || x.group === group);
  const supervisions: Supervision[] = cv.supervisions.filter(
    (s) => s.ongoing || inPeriod(s.year, p),
  );
  const row = (
    group: HealthGroup,
    id: string,
    label: string,
    hint: string,
    pool: PanoramaItem[] = prods,
  ): Row => ({
    group,
    hint,
    id,
    label,
    pool,
  });
  const rows: Row[] = [
    row('Produções', 'doi', 'Artigos com DOI', 'Liga o artigo ao OpenAlex e ao Crossref.'),
    row('Produções', 'issn', 'Artigos com ISSN', 'Usado para achar o estrato Qualis do periódico.'),
    row('Produções', 'volume', 'Artigos com volume e páginas', 'Entram na referência do artigo.'),
    row('Produções', 'isbn', 'Livros e capítulos com ISBN', 'Identifica a obra na referência.'),
    row('Produções', 'palavras-chave', 'Produções com palavras-chave', 'Usadas no gráfico Temas.'),
    row(
      'Produções',
      'titulo-ingles',
      'Produções com título em inglês',
      'Aparece na versão em inglês do currículo.',
    ),
    row(
      'Eventos',
      'doi-eventos',
      'Trabalhos em eventos com DOI',
      'Muitos anais não têm DOI; vale como aviso.',
    ),
    row(
      'Pessoas',
      'id-cnpq',
      'Coautores com ID CNPq',
      'Liga cada coautor ao currículo dele no Lattes.',
    ),
    row(
      'Orientações',
      'agencia',
      'Orientações com agência de fomento',
      'Agência que financiou a bolsa.',
      supervisions,
    ),
  ];
  return rows
    .map(({ group: g, hint, id, label, pool }) => {
      const c = missingCheck(id)!;
      const total = pool.filter((x) => c.applies(x.el, cv.isOwner));
      const missing = total.filter((x) => c.missing(x.el, cv.isOwner));
      return { group: g, hint, id, label, missing, total };
    })
    .filter((c) => c.total.length > 0);
}

export interface Flag {
  hint: string;
  label: string;
  /** Onde conseguir o que falta (a página de cadastro do ORCID); só com o campo vazio. */
  link?: { href: string; label: string };
  ok: boolean;
}

/** A página de cadastro do ORCID, para quem ainda não tem o iD. */
export const ORCID_REGISTER_URL = 'https://orcid.org/register';

export function profileFlags(cv: CvData): Flag[] {
  const hasOrcid = cv.orcid !== '';
  return [
    {
      hint: 'Usado para buscar produções no OpenAlex.',
      label: 'ORCID iD',
      link: hasOrcid ? undefined : { href: ORCID_REGISTER_URL, label: 'Criar um ORCID iD' },
      ok: hasOrcid,
    },
    {
      hint: 'Aparece na versão em inglês do currículo.',
      label: 'Resumo em inglês',
      ok: cv.summaryEn !== '',
    },
  ];
}
