// As conferências de applyProduction (apply.ts): o antes que não bate, o que a
// releitura não trouxe e o item incluído achado de novo na lista.

import type { LattesPort } from '../apply.ts';
import { areaLabel } from '../areas-atuacao.ts';
import { Stop } from '../create-shared.ts';
import type { Pairs } from '../form.ts';
import { differs } from '../multi-choice.ts';
import { type Grids, keywordLabels, sameWords } from './grids.ts';
import { sameDepositor } from './institution-holder.ts';
import { gridLabels, sameLabels } from './item-lists.ts';
import { locate } from './locate.ts';
import { sameAuthors } from './members.ts';
import { folded, type ProductionOp } from './plan.ts';
import type { ProductionTarget } from './types.ts';

/**
 * O antes que não confere: os campos que a alteração troca e as grades que ela
 * mexe. Só o que tem um antes conferido: o que a página limpa junto (clears) e
 * o texto pedido fora do XML (asks) vão sem.
 */
export function beforeWrong(
  op: ProductionOp,
  pairs: Pairs,
  grids: Grids,
  fields: string[],
  virtualFields: string[],
  virtualNow: Record<string, string>,
): string[] {
  const wrong = fields.filter((f) => f in op.expect && differs(pairs, f, op.expect[f], folded));
  if (op.keywords && !sameWords(keywordLabels(grids.f_plv_l ?? []), op.keywords.before)) {
    wrong.push('f_plv_l');
  }
  if (op.authors && !sameAuthors(grids.f_autores_l ?? [], op.authors.before)) {
    wrong.push('f_autores_l');
  }
  if (op.areas && !sameLabels(gridLabels(grids.f_area_l ?? []), op.areas.before.map(areaLabel))) {
    wrong.push('f_area_l');
  }
  if (op.holders && !sameDepositor(grids, op.holders.before)) wrong.push('f_depositante_pessoa_l');
  if (op.setores && !sameLabels(gridLabels(grids.f_setor_l ?? []), op.setores.before)) {
    wrong.push('f_setor_l');
  }
  // Um virtual que já tem o valor novo também confere: a data da patente vem
  // de duas mudanças (a do registro e a do histórico, patente-historico.ts)
  // para o mesmo campo, e a segunda acha o Lattes como a primeira deixou.
  for (const f of virtualFields) {
    const now = folded(virtualNow[f] ?? '');
    if (f in op.expect && now !== folded(op.set[f]) && now !== folded(op.expect[f])) wrong.push(f);
  }
  return wrong;
}

/** O item incluído, achado na lista de novo; undefined quando não há um só. */
export async function createdPath(
  op: ProductionOp,
  t: ProductionTarget,
  port: LattesPort,
): Promise<string | undefined> {
  try {
    return (await locate(op, t, port, await port.menuHtml())).path;
  } catch (err) {
    if (err instanceof Stop) return undefined;
    throw err;
  }
}

/** Os campos e as grades que a releitura não trouxe como foram enviados. */
export function afterWrong(
  op: ProductionOp,
  afterPairs: Pairs,
  afterGrids: Grids,
  fields: string[],
  virtualFields: string[],
  virtualAfter: Record<string, string> | undefined,
): string[] {
  const notSaved = fields.filter((f) => differs(afterPairs, f, op.set[f], folded));
  if (op.keywords && !sameWords(keywordLabels(afterGrids.f_plv_l ?? []), op.keywords.after)) {
    notSaved.push('f_plv_l');
  }
  if (op.authors && !sameAuthors(afterGrids.f_autores_l ?? [], op.authors.after)) {
    notSaved.push('f_autores_l');
  }
  if (
    op.areas &&
    !sameLabels(gridLabels(afterGrids.f_area_l ?? []), op.areas.after.map(areaLabel))
  ) {
    notSaved.push('f_area_l');
  }
  if (op.setores && !sameLabels(gridLabels(afterGrids.f_setor_l ?? []), op.setores.after)) {
    notSaved.push('f_setor_l');
  }
  if (op.holders && !sameDepositor(afterGrids, op.holders.after)) {
    notSaved.push('f_depositante_pessoa_l');
  }
  // Os virtuais, lidos de novo do vetor da página.
  for (const f of virtualFields) {
    if (folded(virtualAfter?.[f] ?? '') !== folded(op.set[f])) notSaved.push(f);
  }
  return notSaved;
}
