// As áreas do conhecimento lidas da grade da página (areaProvider: o nome do
// nível mais fundo em l e o código do nó em c) de volta para as quatro partes
// do XML, pela árvore de áreas do menu (areaDP). É o caminho contrário de
// areaGridRows (production/item-lists.ts), que sai do XML para a grade.

import { emptyAttrs } from '../../model/production.ts';
import { insertInSchemaOrder } from '../../model/schema-order.ts';
import { element, setAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { type AreaRow, bigKey } from '../areas-atuacao.ts';
import type { AreaNode } from '../lattes-lists.ts';
import type { GridRow } from '../production/grids.ts';

const SLOTS = ['AREA-DO-CONHECIMENTO-1', 'AREA-DO-CONHECIMENTO-2', 'AREA-DO-CONHECIMENTO-3'];

export const AREA_ATTRS: Record<keyof AreaRow, string> = {
  area: 'NOME-DA-AREA-DO-CONHECIMENTO',
  bigArea: 'NOME-GRANDE-AREA-DO-CONHECIMENTO',
  specialty: 'NOME-DA-ESPECIALIDADE',
  subArea: 'NOME-DA-SUB-AREA-DO-CONHECIMENTO',
};

/** O caminho do nó com esse código na árvore: a grande área e os nomes abaixo dela. */
export function areaPath(tree: readonly AreaNode[], code: string): AreaRow | undefined {
  const want = code.trim();
  for (const big of tree) {
    const walk = (nodes: readonly AreaNode[], names: string[]): string[] | undefined => {
      for (const n of nodes) {
        if (n.c.trim() === want) return [...names, n.l];
        const below = walk(n.b ?? [], [...names, n.l]);
        if (below) return below;
      }
      return undefined;
    };
    const names = walk(big.b ?? [], []);
    if (names) {
      return {
        area: names[0] ?? '',
        bigArea: bigKey(big.l),
        specialty: names[2] ?? '',
        subArea: names[1] ?? '',
      };
    }
  }
  return undefined;
}

const labeled = (rows: readonly GridRow[]) =>
  rows.filter((r) => typeof r.l === 'string' && r.l.trim() !== '');

/**
 * As áreas da grade como AREAS-DO-CONHECIMENTO do item, nas posições 1 a 3.
 * Devolve os nomes das linhas cujo código não está na árvore: essas ficam fora.
 */
export function setItemAreas(
  item: XElement,
  rows: readonly GridRow[],
  tree: readonly AreaNode[],
): string[] {
  item.children = item.children.filter(
    (c) => c.kind !== 'element' || c.name !== 'AREAS-DO-CONHECIMENTO',
  );
  const unknown: string[] = [];
  const paths: AreaRow[] = [];
  for (const row of labeled(rows)) {
    const path = areaPath(tree, String(row.c ?? ''));
    if (path) paths.push(path);
    else unknown.push(String(row.l));
  }
  if (paths.length === 0) return unknown;
  const container = element('AREAS-DO-CONHECIMENTO', []);
  SLOTS.forEach((slot, i) => {
    const path = paths[i];
    if (!path) return;
    const el = element(slot, emptyAttrs(lattesSchema, slot));
    for (const [key, attr] of Object.entries(AREA_ATTRS) as [keyof AreaRow, string][]) {
      setAttr(el, attr, path[key]);
    }
    insertInSchemaOrder(lattesSchema, container, el);
  });
  insertInSchemaOrder(lattesSchema, item, container);
  return [...unknown, ...paths.slice(SLOTS.length).map((p) => p.specialty || p.subArea || p.area)];
}
