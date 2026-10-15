// O estado dos filtros do painel à direita. O período vale para todos os
// gráficos que o usam; os outros filtros são de um gráfico só.

import { yearPresets } from '../ui/year-range.ts';
import type { Period } from './aggregate.ts';
import type { FilterKind } from './catalog.ts';
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

/** Atalhos de período: os do seletor de anos, com "Toda a carreira" no lugar de "Todos os anos". */
export function periodPresets(cv: CvData, now: number): Preset[] {
  return yearPresets({ from: cv.careerStart, to: cv.lastYear }, now, 'Toda a carreira').map(
    (p) => ({ id: p.id, label: p.label, period: p.range }),
  );
}

/** O período cobre toda a carreira: a lista do editor não precisa de recorte. */
export function isWhole(cv: CvData, p: Period): boolean {
  return p.from <= cv.careerStart && p.to >= cv.lastYear;
}

/** Quantos filtros do gráfico estão fora do padrão (o período conta como um). */
export function changedCount(f: Filters, d: Filters, kinds: FilterKind[]): number {
  const changed: [FilterKind, boolean][] = [
    ['periodo', f.from !== d.from || f.to !== d.to],
    ['grupo', f.group !== d.group],
    ['janela', f.lastYears !== d.lastYears],
    ['nivel', f.level !== d.level],
    ['laco', f.tie !== d.tie],
    ['repetidos', f.repeated !== d.repeated],
  ];
  return changed.filter(([k, c]) => c && kinds.includes(k)).length;
}
