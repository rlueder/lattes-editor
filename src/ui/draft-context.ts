// Quem quer saber o que se digita num campo antes de ele gravar: a prévia do
// bloco em edição no modo de leitura (reading-preview.ts). Sem provedor, nada.

import { createContext, useContext } from 'react';

import type { XElement } from '../model/xml.ts';

export type DraftFn = (el: XElement, attr: string, value: string) => void;

export const DraftContext = createContext<DraftFn | null>(null);

export function useDraft(): DraftFn | null {
  return useContext(DraftContext);
}

/**
 * A chave que a prévia dá ao valor de um campo (reading-layout.ts), para o
 * campo em foco acender o trecho dele na prévia. Sem provedor, nada.
 */
export type PartKeyFn = (el: XElement, attr: string) => string | undefined;

export const PartKeyContext = createContext<PartKeyFn | null>(null);

export function usePartKey(): PartKeyFn | null {
  return useContext(PartKeyContext);
}

/**
 * Lugar de cada campo na ordem da prévia (preview-order.ts), quando o ⚙ pede
 * "Ordem dos campos: como na prévia". Sem provedor, a ordem do Lattes.
 */
export type FieldSlotFn = (
  el: XElement,
  attr: string,
) => { label: string; rank: number } | undefined;

export const FieldSlotContext = createContext<FieldSlotFn | null>(null);

export function useFieldSlot(): FieldSlotFn | null {
  return useContext(FieldSlotContext);
}
