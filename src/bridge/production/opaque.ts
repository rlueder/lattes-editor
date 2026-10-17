// As grades de uma página que o conector não sabe montar (ProductionTarget.
// opaqueGrids): os financiadores, as produções e as orientações ligadas a um
// projeto. O check() as serializa nos ocultos antes do envio, e um envio com
// o oculto vazio apagaria o que elas têm. Por isso o envio só vai quando a
// página traz o vetor de cada uma, e vazio; então o oculto vai vazio, como o
// check() o deixaria.

import { readProvider } from './grids.ts';
import type { OpaqueGrid } from './types.ts';

/** As grades lidas: a que falta na página, ou as que têm linhas. */
export function readOpaque(
  html: string,
  grids: readonly OpaqueGrid[],
): { filled: OpaqueGrid[] } | { missing: string } {
  const filled: OpaqueGrid[] = [];
  for (const g of grids) {
    const rows = readProvider(html, g.provider);
    if (!rows) return { missing: g.provider };
    // O vetor termina com um objeto vazio, a linha em branco da grade.
    if (rows.some((r) => Object.keys(r).length > 0)) filled.push(g);
  }
  return { filled };
}

/** Os ocultos das grades, vazios. */
export const opaquePairs = (grids: readonly OpaqueGrid[]): Record<string, string> =>
  Object.fromEntries(grids.map((g) => [g.field, '']));
