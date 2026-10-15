// Intervalo de anos escolhido em dois cliques na grade de anos: o primeiro
// marca o início, o segundo o fim (trocados se o fim vier antes). Entre os
// dois, o ano sob o ponteiro ou o foco mostra a prévia do intervalo.

export interface YearRange {
  from: number;
  to: number;
}

/** O intervalo em ordem, de um ano a outro em qualquer ordem. */
export function orderedRange(a: number, b: number): YearRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/**
 * Um clique na grade. Sem início marcado, o ano vira o início (`pending`);
 * com início, fecha o intervalo (`done`).
 */
export function pickYear(
  start: number | undefined,
  year: number,
): { done: YearRange } | { pending: number } {
  return start === undefined ? { pending: year } : { done: orderedRange(start, year) };
}

/** O que a grade destaca: a prévia entre o início e o ano apontado, ou o intervalo atual. */
export function shownRange(
  value: YearRange,
  start: number | undefined,
  hover: number | undefined,
): YearRange {
  if (start === undefined) return value;
  return orderedRange(start, hover ?? start);
}

/** Como uma célula aparece: ponta do intervalo, dentro dele ou fora. */
export function cellState(year: number, r: YearRange): 'end' | 'in' | 'out' {
  if (year === r.from || year === r.to) return 'end';
  return year > r.from && year < r.to ? 'in' : 'out';
}

/** "2009 – 2026", ou o ano só quando início e fim coincidem. */
export function formatRange(r: YearRange): string {
  return r.from === r.to ? `${r.from}` : `${r.from} – ${r.to}`;
}
