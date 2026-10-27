// As grades de uma página que o conector não sabe montar (ProductionTarget.
// opaqueGrids): os financiadores, as produções e as orientações ligadas a um
// projeto. Na página de alteração do projeto (lida em 18/10/2026) elas são
// tabelas que o servidor já escreve com as linhas (grid2, grid3 e grid4, de
// criarGrid), e o check() as serializa nos ocultos antes do envio; um envio
// com o oculto vazio apagaria o que elas têm.
//
// Com a serialização da grade (OpaqueGrid.serialize, lida em 20/10/2026 num
// projeto de teste com um financiador e duas produções ligadas), o conector
// refaz o oculto como o check() o faria: o associarValores() da página toma,
// em cada linha e em cada célula com tagValor, o innerHTML do primeiro
// elemento com essa tag. Uma grade sem serialização, ou uma linha que não se
// lê assim, só deixa o envio ir vazia.

import { type Change, resolvePath } from '../../model/changes.ts';
import { childElements, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { decodeHtmlEntities } from '../html-text.ts';
import type { OpaqueGrid } from './types.ts';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** O corpo da tabela `id`, ou undefined sem a tabela. */
function tableBody(html: string, id: string): string | undefined {
  const table = new RegExp(
    `<table\\b[^>]*\\bid\\s*=\\s*["']?${escape(id)}["'\\s>][\\s\\S]*?</table>`,
    'i',
  ).exec(html);
  if (!table) return undefined;
  return /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table[0])?.[1] ?? '';
}

/** As linhas do corpo da tabela `id`, ou undefined sem a tabela. */
export function tableRows(html: string, id: string): number | undefined {
  const body = tableBody(html, id);
  return body === undefined ? undefined : [...body.matchAll(/<tr\b/gi)].length;
}

/**
 * O texto do <span> como o innerHTML o devolve: o parser decodifica as
 * entidades e junta \r\n em \n, e a serialização volta a escrever &, <, > e o
 * espaço sem quebra como entidades. Com outra marcação dentro, undefined.
 */
function innerHtml(raw: string): string | undefined {
  if (raw.includes('<')) return undefined;
  return decodeHtmlEntities(raw.replace(/\r\n?/g, '\n'))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u00a0/g, '&nbsp;');
}

/** Os valores de uma linha como o check() os toma, ou undefined se ela não se lê assim. */
function rowCells(row: string, spec: NonNullable<OpaqueGrid['serialize']>): string[] | undefined {
  const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1] ?? '');
  if (cells.length < spec.cells) return undefined;
  const values: string[] = [];
  for (const cell of cells.slice(0, spec.cells)) {
    const span = /<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(cell);
    if (!span) return undefined;
    const value = innerHtml(span[1] ?? '');
    if (value === undefined) return undefined;
    values.push(value);
  }
  return values;
}

/**
 * Os valores de cada linha da tabela: [] sem linha, undefined sem a tabela,
 * sem a serialização, ou com uma linha que não se lê.
 */
export function opaqueCells(html: string, grid: OpaqueGrid): string[][] | undefined {
  const body = tableBody(html, grid.table);
  if (body === undefined) return undefined;
  if (!/<tr\b/i.test(body)) return [];
  if (!grid.serialize) return undefined;
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  // Uma linha sem o fecho não se separa das outras com segurança.
  if (rows.length !== [...body.matchAll(/<tr\b/gi)].length) return undefined;
  const out: string[][] = [];
  for (const row of rows) {
    const values = rowCells(row[1] ?? '', grid.serialize);
    if (values === undefined) return undefined;
    out.push(values);
  }
  return out;
}

/** As linhas como o check() as junta no oculto. */
export const serializeCells = (
  rows: readonly string[][],
  spec: NonNullable<OpaqueGrid['serialize']>,
): string => rows.map((r) => r.join('|') + spec.end).join('');

/**
 * O oculto da grade como o check() o montaria das linhas da tabela: '' sem
 * linha, undefined sem a tabela, sem a serialização, ou com uma linha que não
 * se lê.
 */
export function opaqueValue(html: string, grid: OpaqueGrid): string | undefined {
  const rows = opaqueCells(html, grid);
  if (!rows) return undefined;
  return rows.length === 0 || !grid.serialize ? '' : serializeCells(rows, grid.serialize);
}

/**
 * As grades lidas: a que falta na página, ou o oculto refeito de cada uma e
 * as que têm linhas que o conector não sabe reenviar.
 */
export function readOpaque(
  html: string,
  grids: readonly OpaqueGrid[],
): { missing: string } | { unsendable: OpaqueGrid[]; values: Record<string, string> } {
  const unsendable: OpaqueGrid[] = [];
  const values: Record<string, string> = {};
  for (const g of grids) {
    if (tableRows(html, g.table) === undefined) return { missing: g.table };
    const value = opaqueValue(html, g);
    if (value === undefined) unsendable.push(g);
    else values[g.field] = value;
  }
  return { unsendable, values };
}

/**
 * O motivo de o item ficar à mão no plano: uma grade com conteúdo no editor
 * (então o Lattes também tem) que o conector não sabe reenviar.
 */
export function opaqueByHand(
  hasContent: (grid: OpaqueGrid) => boolean,
  grids: readonly OpaqueGrid[],
): string | undefined {
  const filled = grids.filter((g) => !g.serialize && hasContent(g));
  if (filled.length === 0) return undefined;
  return `O item tem ${filled.map((g) => g.label).join(', ')}, que o conector não sabe reenviar ao Lattes; alterar este item vai à mão`;
}

/**
 * As mudanças numa linha das grades que não pesam nas outras do item: a
 * natureza do financiador vai sozinha (financiador.ts), e o título e o tipo
 * de uma produção ligada são do Lattes. Nenhuma das duas fica para trás
 * quando outra mudança leva a grade como o Lattes a tem.
 */
const OWN_EDITS = new Set([
  'alterado:FINANCIADOR-DO-PROJETO',
  'alterado:PRODUCAO-CT-DO-PROJETO',
  // Incluir e tirar ligações: as mudanças da fila viram uma operação só (project-links.ts).
  'novo:PRODUCAO-CT-DO-PROJETO',
  'removido:PRODUCAO-CT-DO-PROJETO',
  'novo:PRODUCOES-CT-DO-PROJETO',
]);

/**
 * Por que a mudança `change` no item fica à mão por causa das grades, ou
 * undefined. Além da grade que o conector não sabe reenviar: uma mudança da
 * fila numa dessas grades vai à mão (byHand do alvo), e o envio deste item
 * levaria de volta a grade como o Lattes a tem, deixando a mudança à mão
 * para trás com o item conferido. Então o item inteiro vai à mão.
 */
export function opaqueReason(
  grids: readonly OpaqueGrid[],
  item: XElement,
  change: Change,
  siblings: readonly Change[],
  root: XElement | undefined,
): string | undefined {
  const byHand = opaqueByHand(
    (g) =>
      childElements(item, g.element).some((c) => childElements(c).length > 0 || c.attrs.length > 0),
    grids,
  );
  if (byHand) return byHand;
  const pending = grids.filter((g) => {
    const names = new Set([
      g.element,
      ...(lattesSchema.elements[g.element]?.children.map((c) => c.name) ?? []),
    ]);
    return siblings.some(
      (c) =>
        c.key !== change.key &&
        names.has(c.element) &&
        !OWN_EDITS.has(`${c.kind}:${c.element}`) &&
        !!root &&
        resolvePath(root, c.path).includes(item),
    );
  });
  if (pending.length === 0) return undefined;
  return `O item tem mudança em ${pending.map((g) => g.label).join(', ')}, que vai à mão, e o envio levaria de volta as do Lattes; alterar este item vai à mão junto`;
}
