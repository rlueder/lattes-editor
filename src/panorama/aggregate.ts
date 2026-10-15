// Contagens do Panorama: funções puras sobre o CvData, uma por gráfico (as
// de pessoas e temas ficam em people.ts e topics.ts).

import { slugify } from '../labels/labels.ts';
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

/** [2009, 2010, 2011, 2018] → "2009 a 2011 e 2018". */
export function yearRanges(years: number[]): string {
  const runs: [number, number][] = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last && y === last[1] + 1) last[1] = y;
    else runs.push([y, y]);
  }
  const parts = runs.map(([a, b]) =>
    a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a} a ${b}`,
  );
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}` : (parts[0] ?? '');
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
  /**
   * A coluna Total: todos os itens da linha, inclusive os sem ano, para o
   * total bater com a contagem da seção no editor.
   */
  all?: boolean;
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
    { all: true, from: 0, label: 'Total', note: 'com e sem ano', to: 9999 },
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
  w.all ? items : items.filter((i) => i.year !== undefined && i.year >= w.from && i.year <= w.to);

/**
 * O cabeçalho de uma coluna no CSV, que não tem a linha de nota da tela: o
 * quadriênio que ainda não terminou leva "(em curso)", e o Total diz que
 * conta os itens sem ano.
 */
export function csvHeader(w: Window): string {
  if (w.all) return 'Total (com e sem ano)';
  return w.note === 'em curso' ? `${w.label} (em curso)` : w.label;
}

/** Um campo de CSV: entre aspas quando tem separador, aspas ou quebra de linha. */
export function csvField(value: number | string): string {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A tabela de quadriênios em CSV para o Excel em português: UTF-8 com BOM
 * (para os acentos), ";" como separador e CRLF. Uma linha por tipo, as
 * subdivisões com o nome do grupo ("Orientações concluídas: Mestrado").
 */
export function countsCsv(rows: CountRow[], cols: Window[]): string {
  let parent = '';
  const lines = [
    ['Tipo', ...cols.map(csvHeader)],
    ...rows.map((r) => {
      if (!r.sub) parent = r.label;
      const label = r.sub ? `${parent}: ${r.label}` : r.label;
      return [label, ...cols.map((c) => inWindow(r.items, c).length)];
    }),
  ];
  return `\uFEFF${lines.map((l) => l.map(csvField).join(';')).join('\r\n')}\r\n`;
}

/** "quadrienios-ana-lima-2026-10-15.csv"; com a privacidade ligada, o número do currículo no lugar do nome. */
export function csvFileName(cv: CvData, hidden: boolean, today: Date): string {
  const parts = cv.name.split(/\s+/).filter(Boolean);
  const short = parts.length > 1 ? `${parts[0]} ${parts.at(-1)}` : (parts[0] ?? '');
  const who = hidden || !short ? cv.lattesId || 'curriculo' : slugify(short);
  const date = today.toISOString().slice(0, 10);
  return `quadrienios-${who}-${date}.csv`;
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

// ---------- Orientações e bancas (no gráfico Pessoas) ----------

/** Nome de cada nível nas frases e nos selos, com gênero para concordar. */
const LEVEL_WORDS: Record<Level, { badge: string; f: boolean; one: string; many: string }> = {
  Doutorado: { badge: 'doutorado', f: false, many: 'doutorados', one: 'doutorado' },
  Especialização: {
    badge: 'especialização',
    f: true,
    many: 'especializações',
    one: 'especialização',
  },
  'Graduação (TCC)': { badge: 'TCC', f: false, many: 'TCCs', one: 'TCC' },
  'Iniciação científica': {
    badge: 'IC',
    f: true,
    many: 'iniciações científicas',
    one: 'iniciação científica',
  },
  Mestrado: { badge: 'mestrado', f: false, many: 'mestrados', one: 'mestrado' },
  'Outra natureza': {
    badge: 'outra',
    f: true,
    many: 'orientações de outra natureza',
    one: 'orientação de outra natureza',
  },
  'Pós-doutorado': {
    badge: 'pós-doutorado',
    f: false,
    many: 'pós-doutorados',
    one: 'pós-doutorado',
  },
};

export const levelBadge = (l: Level): string => LEVEL_WORDS[l].badge;

/**
 * As orientações em frases curtas, por nível: "2 mestrados concluídos",
 * "1 doutorado em andamento". Concluídas contam no período; em andamento, todas.
 */
export function supervisionFacts(cv: CvData, p: Period, level?: Level): string[] {
  const out: string[] = [];
  for (const l of LEVELS) {
    if (level && l !== level) continue;
    const w = LEVEL_WORDS[l];
    const done = within(cv.supervisions, p).filter((s) => !s.ongoing && s.level === l).length;
    const ongoing = cv.supervisions.filter((s) => s.ongoing && s.level === l).length;
    const noun = (n: number) => (n === 1 ? w.one : w.many);
    if (done)
      out.push(`${done} ${noun(done)} ${w.f ? 'concluída' : 'concluído'}${done > 1 ? 's' : ''}`);
    if (ongoing) out.push(`${ongoing} ${noun(ongoing)} em andamento`);
  }
  return out;
}

/** O tipo da banca em uma palavra, para o selo. */
export function committeeKind(name: string): string {
  if (name.startsWith('BANCA-JULGADORA') || name === 'OUTRAS-BANCAS-JULGADORAS') return 'julgadora';
  if (name.includes('QUALIFICACAO')) return 'qualificação';
  if (name.includes('DOUTORADO')) return 'doutorado';
  if (name.includes('MESTRADO')) return 'mestrado';
  if (name.includes('ESPECIALIZACAO')) return 'especialização';
  if (name.includes('GRADUACAO')) return 'graduação';
  return 'outra';
}

/** Bancas por ano no período, para a faixa do cabeçalho da seção Bancas. */
export function committeesByYear(cv: CvData, p: Period): { items: Committee[]; year: number }[] {
  const years = within(cv.committees, p).map((c) => c.year!);
  if (years.length === 0) return [];
  return range(Math.min(...years), Math.max(...years)).map((year) => ({
    items: cv.committees.filter((c) => c.year === year),
    year,
  }));
}
