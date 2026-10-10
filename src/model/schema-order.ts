// Ordem dos filhos segundo o schema. O XSD define sequências, não conjuntos:
// um ARTIGOS-PUBLICADOS antes de TRABALHOS-EM-EVENTOS é inválido, e o Lattes
// descarta itens inválidos sem avisar.

import type { LattesSchema } from '../schema/types.ts';
import type { XElement, XNode } from './xml.ts';

/** Posição de cada filho na sequência do pai; undefined se o pai é desconhecido. */
function sequenceIndex(schema: LattesSchema, parent: string): Map<string, number> | undefined {
  const spec = schema.elements[parent];
  if (!spec) return undefined;
  return new Map(spec.children.map((c, i) => [c.name, i]));
}

/**
 * Insere `child` em `parent` na posição que o schema exige: depois do último
 * irmão cuja posição na sequência é menor ou igual à dele. Filhos desconhecidos
 * ficam onde estavam.
 */
export function insertInSchemaOrder(schema: LattesSchema, parent: XElement, child: XElement): void {
  const index = sequenceIndex(schema, parent.name);
  const target = index?.get(child.name);
  parent.selfClosing = false;
  if (index === undefined || target === undefined) {
    parent.children.push(child);
    return;
  }
  let insertAt = 0;
  parent.children.forEach((node: XNode, i) => {
    if (node.kind !== 'element') return;
    const pos = index.get(node.name);
    if (pos !== undefined && pos <= target) insertAt = i + 1;
  });
  parent.children.splice(insertAt, 0, child);
}

/** Lista violações de ordem e de elementos desconhecidos, para validação e testes. */
export function findOrderViolations(schema: LattesSchema, root: XElement): string[] {
  const problems: string[] = [];
  const visit = (el: XElement, path: string) => {
    const index = sequenceIndex(schema, el.name);
    let last = -1;
    for (const node of el.children) {
      if (node.kind !== 'element') continue;
      const pos = index?.get(node.name);
      if (index && pos === undefined)
        problems.push(`${path}/${node.name}: elemento fora do schema`);
      else if (pos !== undefined) {
        if (pos < last) problems.push(`${path}/${node.name}: fora da ordem do schema`);
        last = Math.max(last, pos);
      }
      visit(node, `${path}/${node.name}`);
    }
  };
  visit(root, root.name);
  return problems;
}
