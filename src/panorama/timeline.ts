// A linha do tempo da carreira: cada item numa faixa, com início e fim em
// anos. Orientação concluída e prêmio são pontos (só têm um ano).

import type { CvData, PanoramaItem } from './model.ts';

export const LANES = ['Formação', 'Atuação', 'Projetos', 'Orientações', 'Prêmios'] as const;
export type Lane = (typeof LANES)[number];

export interface TimelineEntry {
  /** Ano de fim; ausente quando ainda está em andamento. */
  end?: number;
  item: PanoramaItem;
  label: string;
  lane: Lane;
  point: boolean;
  start: number;
}

export function timelineEntries(cv: CvData): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const d of cv.degrees)
    if (d.start)
      entries.push({
        end: d.end,
        item: d,
        label: d.typeLabel,
        lane: 'Formação',
        point: false,
        start: d.start,
      });
  for (const p of cv.positions)
    if (p.start)
      entries.push({
        end: p.end,
        item: p,
        label: [p.title, p.inst].filter(Boolean).join(', '),
        lane: 'Atuação',
        point: false,
        start: p.start,
      });
  for (const p of cv.projects)
    if (p.start)
      entries.push({
        end: p.end,
        item: p,
        label: p.title,
        lane: 'Projetos',
        point: false,
        start: p.start,
      });
  for (const s of cv.supervisions)
    if (s.year)
      entries.push({
        end: s.ongoing ? undefined : s.year,
        item: s,
        label: `${s.level}: ${s.student}`,
        lane: 'Orientações',
        point: !s.ongoing,
        start: s.year,
      });
  for (const a of cv.awards)
    if (a.year)
      entries.push({
        end: a.year,
        item: a,
        label: a.title,
        lane: 'Prêmios',
        point: true,
        start: a.year,
      });
  return entries.sort((a, b) => a.start - b.start);
}

/**
 * Distribui itens em linhas para nada se sobrepor: cada um vai para a
 * primeira linha que já terminou antes de ele começar. `extent` diz onde o
 * item termina, na mesma unidade de `begin` (pixels, com o rótulo).
 */
export function pack<T>(
  items: T[],
  begin: (x: T) => number,
  extent: (x: T) => number,
  gap = 4,
): number[] {
  const ends: number[] = [];
  return items.map((x) => {
    const b = begin(x);
    let row = ends.findIndex((e) => e + gap <= b);
    if (row < 0) row = ends.push(-Infinity) - 1;
    ends[row] = extent(x);
    return row;
  });
}
