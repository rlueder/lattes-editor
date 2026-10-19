// O filtro com que uma seção abre depois de um clique no Panorama. Ele vale
// só para a seção pedida e só até a próxima navegação: ir a outra seção pelo
// menu, pelo ⌘K, pelo voltar do navegador ou por um endereço digitado acaba
// com ele, para o recorte não aparecer numa seção que não foi a do clique.

import type { FilterState } from './facets.ts';

export interface SectionFilterRequest {
  filter?: FilterState;
  /** Muda a cada pedido, para a seção remontar com o filtro novo (ou sem filtro). */
  key: number;
  sectionId?: string;
}

export const NO_REQUEST: SectionFilterRequest = { key: 0 };

/** Clique no Panorama: a seção abre com este filtro. */
export function requestFilter(
  prev: SectionFilterRequest,
  sectionId: string,
  filter: FilterState | undefined,
): SectionFilterRequest {
  return { filter, key: prev.key + 1, sectionId };
}

/** Navegação pedida pela pessoa (menu, ⌘K, diagnóstico): a seção abre sem filtro herdado. */
export function clearFilter(prev: SectionFilterRequest): SectionFilterRequest {
  return { key: prev.key + 1 };
}

/** O hash mudou (voltar, avançar, endereço digitado): fora da seção pedida, o pedido acaba. */
export function afterHashChange(
  prev: SectionFilterRequest,
  sectionId: string | undefined,
): SectionFilterRequest {
  return prev.sectionId !== undefined && prev.sectionId !== sectionId ? { key: prev.key } : prev;
}

/** O filtro inicial da seção: o pedido, só se for para ela. */
export function initialFilterFor(
  req: SectionFilterRequest,
  sectionId: string | undefined,
): FilterState | undefined {
  return sectionId !== undefined && req.sectionId === sectionId ? req.filter : undefined;
}
