import { walk, type XElement } from '../model/xml.ts';

/** Conta, dentro de alguns elementos, quantos dos itens pendentes aparecem. */
export function countPendingIn(pending: XElement[]): (els: XElement[]) => number {
  const set = new Set(pending);
  return (els) => {
    let n = 0;
    for (const el of els) walk(el, (node) => void (set.has(node) && n++));
    return n;
  };
}
