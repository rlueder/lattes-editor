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
  /** O que o atalho cobre, na dica da opção. */
  hint: string;
  id: string;
  label: string;
  period: Period;
}

/** Atalhos de período: os do seletor de anos, com "Toda a carreira" no lugar de "Todos os anos". */
export function periodPresets(cv: CvData, now: number): Preset[] {
  return yearPresets({ from: cv.careerStart, to: cv.lastYear }, now, 'Toda a carreira').map(
    (p) => ({ hint: p.hint, id: p.id, label: p.label, period: p.range }),
  );
}

/** O período cobre toda a carreira: a lista do editor não precisa de recorte. */
export function isWhole(cv: CvData, p: Period): boolean {
  return p.from <= cv.careerStart && p.to >= cv.lastYear;
}

/** O período dos gráficos, marcado como carreira inteira quando cobre tudo. */
export function chartPeriod(cv: CvData, f: Period): Period {
  const p = { from: f.from, to: f.to };
  return { ...p, all: isWhole(cv, p) };
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

/**
 * "Limpar filtros" de um gráfico: volta ao padrão só os filtros que ele mostra
 * (os que o contador conta). Os dos outros gráficos e a vista Lista ou Rede ficam.
 */
export function resetKinds(f: Filters, d: Filters, kinds: FilterKind[]): Filters {
  const next = { ...f };
  if (kinds.includes('periodo')) Object.assign(next, { from: d.from, to: d.to });
  if (kinds.includes('grupo')) next.group = d.group;
  if (kinds.includes('janela')) next.lastYears = d.lastYears;
  if (kinds.includes('nivel')) next.level = d.level;
  if (kinds.includes('laco')) next.tie = d.tie;
  if (kinds.includes('repetidos')) next.repeated = d.repeated;
  return next;
}
