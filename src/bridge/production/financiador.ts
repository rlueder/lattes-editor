// A natureza de um financiador do projeto, pela linha dele na grade grid2
// (opaque.ts). A janela PKG_PROJETO.EDITAR_FINANCIAMENTO, onde a página troca
// a natureza, não foi lida; o conector troca só a quarta célula da linha, a
// que o check() manda com a letra da natureza.
//
// Observado: a letra A com Auxílio Financeiro (página de 20/10/2026) e
// NATUREZA="BOLSA" com a letra B (exportação de 27/10/2026, seção 25).
// Inferido, até o teste acompanhado: que o Lattes grave a natureza nova só
// com a letra trocada, sem mexer nas outras células da linha (0000;N; e a
// moeda com o valor). A releitura confere a grade inteira.
//
// A linha se acha pelo código da instituição: a primeira célula traz a letra
// da busca na frente dele (VJMOE00000002), e a exportação, só o código.

import { enumLabel } from '../../labels/labels.ts';
import type { Change } from '../../model/changes.ts';
import { getAttr, type XElement } from '../../model/xml.ts';
import { opaqueCells, serializeCells } from './opaque.ts';
import type { ProductionRow } from './plan.ts';
import type { OpaqueGrid, ProductionTarget } from './types.ts';

export const FUNDER = 'FINANCIADOR-DO-PROJETO';
export const FUNDERS = 'FINANCIADORES-DO-PROJETO';

/** NATUREZA do XML → a letra da quarta célula. Só as vistas no Lattes real. */
const FUNDER_NATURE: Record<string, string> = { AUXILIO_FINANCEIRO: 'A', BOLSA: 'B' };

const NATURE_CELL = 3;

/** A troca da natureza de um financiador: a linha pelo código e a letra antes e depois. */
export interface FunderEdit {
  after: string;
  before: string;
  code: string;
}

/**
 * Trocar a instituição pede a busca de instituições do financiador
 * (pp_lista_inst?f_pgm=INSTFINANC), cuja resposta não foi lida.
 */
const INSTITUTION_BY_HAND =
  'Financiador vai à mão: trocar a instituição pede a busca de instituições do financiador, que não foi lida';

/**
 * A troca e a linha do que muda, ou o motivo de ir à mão; undefined quando a
 * mudança não é num financiador que já está no projeto.
 */
export function planFunder(
  change: Change,
  chain: readonly XElement[],
  target: ProductionTarget,
): { funder: FunderEdit; rows: ProductionRow[] } | { reason: string } | undefined {
  const el = chain.at(-1);
  if (
    !el ||
    change.element !== FUNDER ||
    change.kind !== 'alterado' ||
    chain.at(-2)?.name !== FUNDERS ||
    !target.opaqueGrids?.some((g) => g.element === FUNDERS)
  ) {
    return undefined;
  }
  if (change.fields.some((f) => f.attr !== 'NATUREZA')) return { reason: INSTITUTION_BY_HAND };
  const field = change.fields[0]!;
  const [before, after] = [FUNDER_NATURE[field.before], FUNDER_NATURE[field.after]];
  if (!before || !after) {
    return {
      reason:
        'Natureza do financiador: no Lattes só foram vistas a de Auxílio Financeiro e a de Bolsa; esta vai à mão',
    };
  }
  const code = (getAttr(el, 'CODIGO-INSTITUICAO') ?? '').trim();
  if (!code)
    return { reason: 'Financiador sem o código da instituição para achar a linha no Lattes' };
  return {
    funder: { after, before, code },
    rows: [
      {
        after: enumLabel(field.after),
        before: enumLabel(field.before),
        label: field.label,
        name: 'f_inst_l',
      },
    ],
  };
}

const DIVERGENT = {
  detail: 'O Lattes não está como o editor espera: Financiador',
  status: 'divergente',
} as const;

/**
 * O oculto da grade com a natureza nova, ou o resultado sem envio: conferido
 * quando o Lattes já a tem, divergente quando a linha não está uma vez só ou
 * tem outra letra.
 */
export function funderValue(
  html: string,
  grids: readonly OpaqueGrid[],
  edit: FunderEdit,
): { field: string; value: string } | { detail: string; status: 'conferido' | 'divergente' } {
  const grid = grids.find((g) => g.element === FUNDERS);
  const rows = grid?.serialize ? opaqueCells(html, grid) : undefined;
  if (!rows || !grid?.serialize) return DIVERGENT;
  const hits = rows.filter((r) => r[0] === edit.code || r[0]?.slice(1) === edit.code);
  if (hits.length !== 1) return DIVERGENT;
  const row = hits[0]!;
  if (row[NATURE_CELL] === edit.after) {
    return { detail: 'O Lattes já estava assim; nada foi enviado', status: 'conferido' };
  }
  if (row[NATURE_CELL] !== edit.before) return DIVERGENT;
  const edited = rows.map((r) =>
    r === row ? r.map((v, i) => (i === NATURE_CELL ? edit.after : v)) : r,
  );
  return { field: grid.field, value: serializeCells(edited, grid.serialize) };
}
