// As palavras-chave, áreas e setores de um item novo (formação, registro,
// patente), nas grades f_plv_l, f_area_l e f_setor_l do formulário de
// inclusão. As mesmas grades da alteração (formacao-grids.ts e
// production/item-lists.ts), lidas no Lattes real em 19/10/2026; na inclusão
// elas abrem vazias, então cada linha sai das listas do menu (areaDP e
// setorDP) ou entra como palavra nova (c=-1). Inferido, até o teste
// acompanhado: que o servidor grave as grades na inclusão como na alteração.

import { childElements, getAttr, type XElement } from '../model/xml.ts';
import type { AreaRow } from './areas-atuacao.ts';
import { areaLabel } from './areas-atuacao.ts';
import {
  gridPairs,
  keywordLabels,
  keywordRows,
  MAX_KEYWORDS,
  readGrids,
  sameWords,
} from './production/grids.ts';
import {
  areaGridRows,
  gridLabels,
  itemAreasAndSetores,
  sameLabels,
  setorGridRows,
} from './production/item-lists.ts';

/** As partes do item que viram as três grades. */
export const GRID_PARTS = new Set([
  'PALAVRAS-CHAVE',
  'AREAS-DO-CONHECIMENTO',
  'SETORES-DE-ATIVIDADE',
]);

export interface NewItemGrids {
  areas: AreaRow[];
  keywords: string[];
  setores: string[];
}

const FIELDS = ['f_plv_l', 'f_area_l', 'f_setor_l'] as const;

/** As listas do item novo; undefined quando ele não tem nenhuma; o motivo, quando uma não vai. */
export function newItemGrids(item: XElement): NewItemGrids | { reason: string } | undefined {
  const plv = childElements(item, 'PALAVRAS-CHAVE')[0];
  const keywords = Array.from({ length: MAX_KEYWORDS }, (_, i) =>
    plv ? (getAttr(plv, `PALAVRA-CHAVE-${i + 1}`) ?? '').trim() : '',
  ).filter(Boolean);
  const rest = itemAreasAndSetores(item);
  if ('reason' in rest) return rest;
  const lists = { ...rest, keywords };
  return keywords.length || rest.areas.length || rest.setores.length ? lists : undefined;
}

/** Os ocultos das três grades para o envio; o que não está nas listas do menu, quando há. */
export function newGridPairs(
  lists: NewItemGrids,
  menu: string,
): { set: Record<string, string> } | { detail: string } {
  const areas = areaGridRows([], menu, lists.areas);
  const setores = setorGridRows([], menu, lists.setores);
  const unknown = [
    ...('unknown' in areas ? areas.unknown : []),
    ...('unknown' in setores ? setores.unknown : []),
  ];
  if ('unknown' in areas || 'unknown' in setores) {
    return {
      detail: `Fora da lista do Lattes: ${unknown.join(', ')}. Escolha pela lista do Lattes uma vez`,
    };
  }
  return {
    set: gridPairs(
      { f_area_l: [], f_plv_l: [], f_setor_l: [] },
      { f_area_l: areas.rows, f_plv_l: keywordRows([], lists.keywords), f_setor_l: setores.rows },
    ),
  };
}

/** As grades que não voltaram como foram, na página do item criado. */
export function newGridProblems(html: string, lists: NewItemGrids): string[] {
  const read = readGrids(html, FIELDS);
  if ('missing' in read) return ['palavras-chave, áreas e setores'];
  const out: string[] = [];
  if (!sameWords(keywordLabels(read.f_plv_l ?? []), lists.keywords)) out.push('palavras-chave');
  if (!sameLabels(gridLabels(read.f_area_l ?? []), lists.areas.map(areaLabel))) {
    out.push('áreas do conhecimento');
  }
  if (!sameLabels(gridLabels(read.f_setor_l ?? []), lists.setores))
    out.push('setores de atividade');
  return out;
}
