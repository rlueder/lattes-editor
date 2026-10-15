// O que cada gráfico usa da página: o clique numa marca e a dica do passar do mouse.

import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';

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

/**
 * A dica do passar do mouse fica num estado à parte: mover o ponteiro sobre
 * um gráfico só redesenha a dica, sem refazer as contas da página.
 */
export interface TipStore {
  get: () => null | TipState;
  set: (t: null | TipState) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createTipStore(): TipStore {
  let tip: null | TipState = null;
  const listeners = new Set<() => void>();
  return {
    get: () => tip,
    set: (t) => {
      tip = t;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useTip(store: TipStore): null | TipState {
  return useSyncExternalStore(store.subscribe, store.get);
}
