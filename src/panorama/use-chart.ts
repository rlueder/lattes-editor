// O que cada gráfico usa da página: o clique numa marca e a dica do passar do mouse.

import { createContext, type ReactNode, useContext } from 'react';

import type { Selection } from './drill.ts';

export interface TipState {
  content: ReactNode;
  x: number;
  y: number;
}

export interface ChartApi {
  /** O clique num número ou ponto. */
  pick: (s: Selection) => void;
  setTip: (t: null | TipState) => void;
}

export const ChartContext = createContext<ChartApi | null>(null);

export function useChart(): ChartApi {
  const api = useContext(ChartContext);
  if (!api) throw new Error('Gráfico do Panorama fora da página do Panorama.');
  return api;
}
