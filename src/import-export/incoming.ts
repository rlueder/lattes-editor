// Itens de outro XML (LAT-45): o XML de outro programa (o do Auto Lattes,
// por exemplo) ou uma exportação antiga, de onde a pessoa traz produções para
// o currículo aberto. Os itens passam pelo pré-diff (src/review/dedup.ts)
// antes de entrar, e só entram os que a pessoa escolhe, como itens novos:
// número novo de SEQUENCIA-PRODUCAO e o caminho de sempre até o Lattes, pelo
// Importar.

import { addProduction, nextSequencia, productionType, SEQ_ATTR } from '../model/production.ts';
import { setAttr, type XDocument, type XElement } from '../model/xml.ts';
import { productionItems } from '../review/consistency.ts';
import type { IncomingItem } from '../review/dedup.ts';
import type { LattesSchema } from '../schema/types.ts';

/** As produções de outro currículo que o Importar do Lattes lê (as que o editor sabe criar). */
export function incomingItems(schema: LattesSchema, root: XElement): XElement[] {
  return productionItems(root).filter((el) => productionType(schema, el.name) !== undefined);
}

/**
 * Inclui no documento os itens escolhidos, cada um com o próximo número livre
 * (acima do maior do documento e do contador da sessão, sem reaproveitar
 * lacuna). Devolve o próximo número livre depois deles.
 */
export function addIncoming(
  schema: LattesSchema,
  doc: XDocument,
  items: XElement[],
  counter: number,
): number {
  let next = nextSequencia(doc, counter);
  for (const original of items) {
    const type = productionType(schema, original.name);
    if (!type) continue;
    const item = structuredClone(original);
    setAttr(item, SEQ_ATTR, String(next));
    addProduction(schema, doc, type, item);
    next += 1;
  }
  return next;
}

/** O que entra marcado na revisão: só o que não se parece com nada do currículo. */
export function initialChoice(diff: IncomingItem[]): boolean[] {
  return diff.map((d) => d.status === 'novo');
}

/** "12 itens: 9 novos, 2 parecem duplicatas, 1 parecido" */
export function diffSummary(diff: IncomingItem[]): string {
  const count = (s: IncomingItem['status']) => diff.filter((d) => d.status === s).length;
  const novos = count('novo');
  const dup = count('duplicata');
  const par = count('parecido');
  const parts = [
    novos === 1 ? '1 novo' : `${novos} novos`,
    ...(dup ? [dup === 1 ? '1 parece duplicata' : `${dup} parecem duplicatas`] : []),
    ...(par ? [par === 1 ? '1 parecido com outro' : `${par} parecidos com outros`] : []),
  ];
  return `${diff.length === 1 ? '1 item' : `${diff.length} itens`}: ${parts.join(', ')}`;
}
