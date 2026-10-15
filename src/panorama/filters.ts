// O estado dos filtros do painel à direita. O período vale para todos os
// gráficos que o usam; os outros filtros são de um gráfico só.

import { type Period, range } from './aggregate.ts';
import type { CvData, Level, ProductionGroup } from './model.ts';
import type { Tie } from './people.ts';

export interface Filters extends Period {
  group: '' | ProductionGroup;
  lastYears: number;
  level: '' | Level;
  repeated: boolean;
  tie: '' | Tie;
  view: 'lista' | 'rede';
}

export function defaultFilters(cv: CvData): Filters {
  return {
    from: cv.careerStart,
    group: '',
    lastYears: 5,
    level: '',
    repeated: false,
    tie: '',
    to: cv.lastYear,
    view: 'lista',
  };
}

export interface Preset {
  id: string;
  label: string;
  period: Period;
}

/** Atalhos de período: tudo, últimos 5 anos e os dois últimos quadriênios fechados da CAPES. */
export function periodPresets(cv: CvData, now: number): Preset[] {
  const lastClosed = 2013 + Math.floor((now - 2013) / 4) * 4 - 1;
  const quads = [lastClosed - 3, lastClosed - 7]
    .filter((a) => a + 3 >= cv.careerStart)
    .map((a) => ({
      id: `q${a}`,
      label: `Quadriênio ${a}–${a + 3}`,
      period: { from: a, to: a + 3 },
    }));
  return [
    { id: 'tudo', label: 'Toda a carreira', period: { from: cv.careerStart, to: cv.lastYear } },
    { id: 'ultimos-5', label: 'Últimos 5 anos', period: { from: now - 4, to: now } },
    ...quads,
  ];
}

export function presetOf(presets: Preset[], p: Period): string {
  return presets.find((x) => x.period.from === p.from && x.period.to === p.to)?.id ?? '';
}

/** Anos que o seletor de período oferece. */
export function yearOptions(cv: CvData): number[] {
  return range(cv.careerStart, cv.lastYear);
}

/** O período cobre toda a carreira: a lista do editor não precisa de recorte. */
export function isWhole(cv: CvData, p: Period): boolean {
  return p.from <= cv.careerStart && p.to >= cv.lastYear;
}

/** Ajusta um lado do período sem deixar o início passar do fim. */
export function setBound(f: Filters, side: 'from' | 'to', year: number): Filters {
  if (side === 'from') return { ...f, from: year, to: Math.max(year, f.to) };
  return { ...f, from: Math.min(year, f.from), to: year };
}
