// Quem quer saber o que se digita num campo antes de ele gravar: a prévia do
// bloco em edição no modo de leitura (reading-preview.ts). Sem provedor, nada.

import { createContext, useContext } from 'react';

import type { XElement } from '../model/xml.ts';

export type DraftFn = (el: XElement, attr: string, value: string) => void;

export const DraftContext = createContext<DraftFn | null>(null);

export function useDraft(): DraftFn | null {
  return useContext(DraftContext);
}
