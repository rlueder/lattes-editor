// Como achar um item de produção na lista do Lattes, a partir do XML: o
// título e o ano, e o parâmetro da lista quando o tipo tem mais de uma. A
// alteração (plan.ts) e a exclusão (../delete-items.ts) usam o mesmo.

import type { Change } from '../../model/changes.ts';
import { getAttr, walk, type XElement } from '../../model/xml.ts';
import type { ProductionTarget } from './types.ts';

/**
 * Como achar o item na lista do Lattes: o título e o ano (os de antes, quando
 * a própria mudança os troca) e o parâmetro da lista, quando o tipo tem mais
 * de uma. A exclusão (delete-items.ts) usa o mesmo, com o item do original.
 */
export function productionIdentity(
  change: Change,
  item: XElement,
  target: ProductionTarget,
):
  | { listParams?: Record<string, string>; match: { title: string; year: string } }
  | { reason: string } {
  const before = (child: string, attr: string) => {
    const f = change.element === child ? change.fields.find((x) => x.attr === attr) : undefined;
    if (f) return f.before;
    // O filho pode estar mais fundo (o REGISTRO-OU-PATENTE fica dentro do
    // detalhamento do software).
    let part = child === item.name ? item : undefined;
    walk(item, (n) => {
      part ??= n !== item && n.name === child ? n : undefined;
    });
    return (part && getAttr(part, attr)) ?? '';
  };
  const match = {
    title: before(target.title.child, target.title.attr).trim(),
    year: before(target.year.child, target.year.attr).trim(),
  };
  if (!match.title || !match.year) {
    return { reason: 'O item não tem título ou ano para achar a linha no Lattes' };
  }
  const by = target.list.paramsBy;
  if (!by) return { match };
  const byValue = before(by.child, by.attr);
  const listParam = typeof by.values === 'function' ? by.values(byValue) : by.values[byValue];
  if (listParam === undefined) return { reason: 'O item não diz em que lista do Lattes ele está' };
  return { listParams: { [by.param]: listParam }, match };
}
