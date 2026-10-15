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

export interface YearPreset {
  id: string;
  label: string;
  range: YearRange;
}

/**
 * Atalhos do seletor: todos os anos, os últimos 5 e cada quadriênio da CAPES
 * (2013–2016, 2017–2020…) que toca o intervalo, do mais recente ao mais antigo.
 */
export function yearPresets(all: YearRange, now: number, allLabel = 'Todos os anos'): YearPreset[] {
  const quads: YearPreset[] = [];
  for (let a = 2013; a <= now; a += 4)
    if (a + 3 >= all.from && a <= all.to)
      quads.unshift({ id: `q${a}`, label: `${a}–${a + 3}`, range: { from: a, to: a + 3 } });
  return [
    { id: 'tudo', label: allLabel, range: all },
    { id: 'ultimos-5', label: 'Últimos 5 anos', range: { from: now - 4, to: now } },
    ...quads,
  ];
}
