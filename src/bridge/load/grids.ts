// As grades de palavras-chave, setores e áreas de uma página de alteração
// (palavraProvider, setorProvider, areaProvider) num item que não é produção
// (a formação, a formação complementar): as mesmas regras da leitura das
// produções (refresh/apply-reading.ts, areas.ts).

import { setKeywords } from '../../model/production.ts';
import type { XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { decodeHtmlEntities } from '../html-text.ts';
import type { AreaNode } from '../lattes-lists.ts';
import type { Grids } from '../production/grids.ts';
import { applySetores } from '../refresh/apply-reading.ts';
import { setItemAreas } from './areas.ts';

/** Grava as três grades que o elemento aceita; devolve os nomes de área fora da árvore. */
export function applyItemGrids(item: XElement, grids: Grids, tree: readonly AreaNode[]): string[] {
  const children = new Set(lattesSchema.elements[item.name]?.children.map((c) => c.name));
  if (children.has('PALAVRAS-CHAVE') && grids.f_plv_l) {
    const words = grids.f_plv_l
      .filter((r) => typeof r.l === 'string' && r.l.trim())
      .map((r) => decodeHtmlEntities(String(r.l)));
    setKeywords(lattesSchema, item, words);
  }
  if (children.has('SETORES-DE-ATIVIDADE') && grids.f_setor_l) applySetores(item, grids.f_setor_l);
  if (children.has('AREAS-DO-CONHECIMENTO') && grids.f_area_l) {
    return setItemAreas(item, grids.f_area_l, tree);
  }
  return [];
}
