// A troca da natureza no lugar, num elemento do XML que tem mais de uma (as
// outras orientações concluídas: aperfeiçoamento, graduação, iniciação
// científica e outra natureza). Lido no Lattes real em 20/10/2026, na página
// de edição de uma orientação concluída (pkg_orient.form): cada clique na
// natureza chama testa_nivel(), que limpa f_dsc_outra e, com a instituição
// preenchida, limpa também os códigos da instituição e do curso e pede para
// escolher os dois de novo. O nível da lista de cursos sai do retnivel() da
// natureza nova. O envio faz o mesmo: o F_COD_PROD novo, os ocultos limpos e
// a instituição e o curso do item escolhidos de novo pelas buscas
// (lookups.ts), com o nível da natureza nova. Que o Lattes grave a troca
// assim é inferido até o teste num item de teste.

import type { Change } from '../../model/changes.ts';
import { childElements, getAttr, type XElement } from '../../model/xml.ts';
import { lookupAttrs, type ProductionLookups } from './lookups.ts';
import type { ProductionTarget } from './types.ts';

/**
 * Os ajustes da troca da natureza: o que limpar (no set) e as escolhas de
 * novo; undefined quando a mudança não troca a natureza.
 */
export function planNatureSwap(
  target: ProductionTarget,
  change: Change,
  item: XElement,
  set: Record<string, string>,
  expect: Record<string, string>,
  siblings: readonly Change[],
): { lookups?: ProductionLookups } | { reason: string } | undefined {
  const swap = target.natureSwap;
  const field = target.nature?.field;
  if (!swap || !field) return undefined;
  const [child, attr] = swap.key.split('@') as [string, string];
  const f = change.element === child ? change.fields.find((x) => x.attr === attr) : undefined;
  const after = set[field];
  const before = expect[field];
  if (!f || after === undefined || before === undefined || after === before) return undefined;
  const hand = swap.byHand[before] ?? swap.byHand[after];
  if (hand) return { reason: `${f.label}: ${hand}` };
  for (const c of swap.clears) set[c] = '';
  const spec = target.lookups;
  if (!spec) return {};
  // A instituição ou o curso trocados na mesma fila: a página pede os dois de
  // novo, e cada operação conferiria o que a outra mudou.
  const where = change.path.slice(0, -1).join('/');
  const chosen = new Set(lookupAttrs(spec));
  const pending = siblings.some(
    (c) =>
      c !== change &&
      c.element === spec.child &&
      c.path.slice(0, -1).join('/') === where &&
      c.fields.some((x) => chosen.has(x.attr)),
  );
  if (pending) {
    return {
      reason: `${f.label}: troque a natureza num envio e a instituição ou o curso em outro`,
    };
  }
  const detail = childElements(item, spec.child)[0];
  const value = (a: string) => (detail && getAttr(detail, a)) ?? '';
  const institution = value(spec.institution.code);
  if (!institution) {
    return {
      reason: `${f.label}: com a natureza nova, o Lattes pede a instituição de novo, e o item não tem o código dela; troque no Lattes`,
    };
  }
  const lookups: ProductionLookups = {
    institution: {
      before: institution,
      code: institution,
      name: value(spec.institution.name),
    },
    nature: after,
  };
  if (spec.course) {
    const course = value(spec.course.code);
    if (!course && !spec.course.optional?.includes(after)) {
      return {
        reason: `${f.label}: com a natureza nova, o Lattes exige o curso, e o item não tem; troque a natureza no Lattes e escolha o curso pela lista dele`,
      };
    }
    lookups.course = { before: course, code: course };
  }
  return { lookups };
}
