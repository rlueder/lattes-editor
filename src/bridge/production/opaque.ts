// As grades de uma página que o conector não sabe montar (ProductionTarget.
// opaqueGrids): os financiadores, as produções e as orientações ligadas a um
// projeto. Na página de alteração do projeto (lida em 18/10/2026) elas são
// tabelas que o servidor já escreve com as linhas (grid2, grid3 e grid4, de
// criarGrid), e o check() as serializa nos ocultos antes do envio; um envio
// com o oculto vazio apagaria o que elas têm. Por isso o envio só vai quando
// a página traz a tabela de cada uma, sem linha; então o oculto vai vazio,
// como o check() o deixaria.

import type { OpaqueGrid } from './types.ts';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** As linhas do corpo da tabela `id`, ou undefined sem a tabela. */
export function tableRows(html: string, id: string): number | undefined {
  const table = new RegExp(
    `<table\\b[^>]*\\bid\\s*=\\s*["']?${escape(id)}["'\\s>][\\s\\S]*?</table>`,
    'i',
  ).exec(html);
  if (!table) return undefined;
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table[0]);
  return [...(body?.[1] ?? '').matchAll(/<tr\b/gi)].length;
}

/** As grades lidas: a que falta na página, ou as que têm linhas. */
export function readOpaque(
  html: string,
  grids: readonly OpaqueGrid[],
): { filled: OpaqueGrid[] } | { missing: string } {
  const filled: OpaqueGrid[] = [];
  for (const g of grids) {
    const rows = tableRows(html, g.table);
    if (rows === undefined) return { missing: g.table };
    if (rows > 0) filled.push(g);
  }
  return { filled };
}

/** Os ocultos das grades, vazios. */
export const opaquePairs = (grids: readonly OpaqueGrid[]): Record<string, string> =>
  Object.fromEntries(grids.map((g) => [g.field, '']));
