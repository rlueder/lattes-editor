// Contagens do Panorama: funções puras sobre o CvData, uma por gráfico (as
// de pessoas e temas ficam em people.ts e topics.ts).

import {
  type Committee,
  type CvData,
  type Degree,
  type Level,
  LEVELS,
  type PanoramaItem,
  type Position,
  type Production,
  PRODUCTION_GROUPS,
  type ProductionGroup,
  selfIndex,
  type Supervision,
} from './model.ts';

export interface Period {
  from: number;
  to: number;
}

export const inPeriod = (year: number | undefined, p: Period): year is number =>
  year !== undefined && year >= p.from && year <= p.to;

export const range = (a: number, b: number): number[] =>
  Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/** Itens com ano dentro do período. */
export function within<T extends { year?: number }>(items: T[], p: Period): T[] {
  return items.filter((i) => inPeriod(i.year, p));
}

// ---------- Em resumo ----------

export interface Tile {
  items: PanoramaItem[];
  key: string;
  label: string;
}

export function summaryTiles(cv: CvData, p: Period): Tile[] {
  const prods = within(cv.productions, p);
  const byGroup = (g: ProductionGroup) => prods.filter((x) => x.group === g);
  return [
    { items: byGroup('artigos'), key: 'artigos', label: 'Artigos' },
    { items: byGroup('livros'), key: 'livros', label: 'Livros e capítulos' },
    { items: byGroup('eventos'), key: 'eventos', label: 'Trabalhos em eventos' },
    {
      items: within(cv.supervisions, p).filter((s) => !s.ongoing),
      key: 'orientacoes-concluidas',
      label: 'Orientações concluídas',
    },
    {
      // Em andamento conta todas: o ano delas é o de início.
      items: cv.supervisions.filter((s) => s.ongoing),
      key: 'orientacoes-andamento',
      label: 'Orientações em andamento',
    },
    { items: within(cv.committees, p), key: 'bancas', label: 'Bancas' },
    { items: within(cv.events, p), key: 'eventos-participacao', label: 'Eventos' },
    {
      items: cv.projects.filter((x) => (x.start ?? p.to) <= p.to && (x.end ?? p.to) >= p.from),
      key: 'projetos',
      label: 'Projetos',
    },
    { items: within(cv.awards, p), key: 'premios', label: 'Prêmios e títulos' },
  ];
}

/** O vínculo atual (sem ano de fim) e o ano do doutorado, para a linha de apresentação. */
export function currentRole(cv: CvData): { doctorate?: number; position?: Position } {
  const position = cv.positions.find((x) => x.start && !x.end);
  const doctorate = cv.degrees.find((d) => d.level === 'DOUTORADO' && d.end)?.end;
  return { doctorate, position };
}

// ---------- Produções por ano ----------

export interface YearBar {
  byGroup: Record<ProductionGroup, Production[]>;
  total: number;
  year: number;
}

export interface ProductionsByYear {
  bars: YearBar[];
  /** Anos sem nenhuma produção (o ano corrente não conta, ainda está em curso). */
  gaps: number[];
  max: number;
}

export function productionsByYear(
  cv: CvData,
  p: Period,
  now: number,
  groups: ProductionGroup[] = PRODUCTION_GROUPS.map((g) => g.key),
): ProductionsByYear {
  const from = Math.max(p.from, cv.careerStart);
  const prods = cv.productions.filter((x) => groups.includes(x.group));
  const bars = range(from, p.to).map((year) => {
    const ofYear = prods.filter((x) => x.year === year);
    const byGroup = Object.fromEntries(
      PRODUCTION_GROUPS.map((g) => [g.key, ofYear.filter((x) => x.group === g.key)]),
    ) as Record<ProductionGroup, Production[]>;
    return { byGroup, total: ofYear.length, year };
  });
  return {
    bars,
    gaps: bars.filter((b) => b.total === 0 && b.year < now).map((b) => b.year),
    max: Math.max(0, ...bars.map((b) => b.total)),
  };
}

export interface Band {
  end: number;
  item: Degree | Position;
  label: string;
  row: number;
  start: number;
}

/**
 * Faixas de contexto sob as barras: pós-graduação numa camada, vínculos na
 * outra, cada camada com quantas linhas forem precisas para nada se cruzar.
 */
export function careerBands(cv: CvData, p: Period): { bands: Band[]; rows: number } {
  const from = Math.max(p.from, cv.careerStart);
  const layers: (Degree | Position)[][] = [
    cv.degrees.filter((d) => /MESTRADO|DOUTORADO/.test(d.level)),
    cv.positions,
  ];
  const bands: Band[] = [];
  let base = 0;
  for (const layer of layers) {
    const tracks: number[] = [];
    const sorted = layer.filter((x) => x.start).sort((a, b) => a.start! - b.start!);
    for (const item of sorted) {
      const start = Math.max(item.start!, from);
      const end = Math.min(item.end ?? p.to, p.to);
      if (end < from || start > p.to) continue;
      let t = tracks.findIndex((last) => last < start);
      if (t < 0) t = tracks.push(0) - 1;
      tracks[t] = end;
      const label = item.kind === 'formacao' ? item.typeLabel : item.title;
      bands.push({ end, item, label, row: base + t, start });
    }
    base += Math.max(1, tracks.length);
  }
  return { bands, rows: base };
}

// ---------- Quadriênios ----------

export interface Window {
  from: number;
  label: string;
  note: string;
  to: number;
}

export interface CountRow {
  items: PanoramaItem[];
  label: string;
  sub?: boolean;
}

/** Os quadriênios da avaliação da CAPES que tocam a carreira, mais os últimos N anos e o total. */
export function windows(cv: CvData, now: number, lastYears: number): Window[] {
  const quads: Window[] = [];
  for (let a = 2013; a <= now; a += 4) {
    if (a + 3 < cv.careerStart) continue;
    quads.push({
      from: a,
      label: `${a}–${a + 3}`,
      note: a + 3 > now ? 'em curso' : 'quadriênio',
      to: a + 3,
    });
  }
  return [
    ...quads,
    {
      from: now - lastYears + 1,
      label: `${now - lastYears + 1}–${now}`,
      note: `últimos ${lastYears} anos`,
      to: now,
    },
    { from: 0, label: 'Total', note: 'todos os anos', to: 9999 },
  ];
}

export function countRows(cv: CvData): CountRow[] {
  const prod = (test: (x: Production) => boolean) => cv.productions.filter(test);
  const done = cv.supervisions.filter((s) => !s.ongoing);
  return [
    { items: prod((x) => x.el.name === 'ARTIGO-PUBLICADO'), label: 'Artigos em periódicos' },
    { items: prod((x) => x.el.name === 'LIVRO-PUBLICADO-OU-ORGANIZADO'), label: 'Livros' },
    {
      items: prod((x) => x.el.name === 'CAPITULO-DE-LIVRO-PUBLICADO'),
      label: 'Capítulos de livros',
    },
    { items: prod((x) => x.group === 'eventos'), label: 'Trabalhos em eventos' },
    { items: prod((x) => x.group === 'outros'), label: 'Demais produções' },
    { items: done, label: 'Orientações concluídas' },
    ...LEVELS.map((l) => ({
      items: done.filter((s) => s.level === l),
      label: l,
      sub: true,
    })).filter((r) => r.items.length > 0),
    {
      items: cv.supervisions.filter((s) => s.ongoing),
      label: 'Orientações iniciadas (em andamento)',
    },
    { items: cv.committees, label: 'Bancas' },
    { items: cv.events, label: 'Participação em eventos' },
    { items: cv.projects, label: 'Projetos iniciados' },
    { items: cv.awards, label: 'Prêmios e títulos' },
  ];
}

export const inWindow = (items: PanoramaItem[], w: Window): PanoramaItem[] =>
  items.filter((i) => i.year !== undefined && i.year >= w.from && i.year <= w.to);

/** A tabela em texto separado por tabulação, para colar numa planilha. */
export function countsTsv(rows: CountRow[], cols: Window[]): string {
  return [
    ['Tipo', ...cols.map((c) => c.label)].join('\t'),
    ...rows.map((r) => [r.label, ...cols.map((c) => inWindow(r.items, c).length)].join('\t')),
  ].join('\n');
}

// ---------- Posição de autoria ----------

export const POSITIONS = ['Autoria única', 'Primeira', 'Intermediária', 'Última'] as const;

export interface AuthorshipPoint {
  item: Production;
  /** Índice em POSITIONS. */
  position: number;
}

export function authorship(cv: CvData, p: Period, groups?: ProductionGroup[]): AuthorshipPoint[] {
  return within(cv.productions, p).flatMap((item) => {
    if (groups && !groups.includes(item.group)) return [];
    const i = selfIndex(item);
    const n = item.authors.length;
    if (i < 0) return [];
    const position = n === 1 ? 0 : i === 0 ? 1 : i === n - 1 ? 3 : 2;
    return [{ item, position }];
  });
}

// ---------- Orientações e bancas ----------

export interface LevelRow {
  done: Supervision[];
  level: Level;
  ongoing: Supervision[];
}

export function supervisionRows(cv: CvData, p: Period, level?: Level): LevelRow[] {
  return LEVELS.filter((l) => !level || l === level)
    .map((l) => ({
      done: within(cv.supervisions, p).filter((s) => !s.ongoing && s.level === l),
      level: l,
      ongoing: cv.supervisions.filter((s) => s.ongoing && s.level === l),
    }))
    .filter((r) => r.done.length + r.ongoing.length > 0);
}

export function committeesByYear(
  cv: CvData,
  years: number[],
): { items: Committee[]; year: number }[] {
  return years.map((year) => ({ items: cv.committees.filter((c) => c.year === year), year }));
}
