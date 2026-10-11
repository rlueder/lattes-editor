// Índice de referências do documento aberto, disponível para qualquer
// ElementView sem passar a raiz pela árvore inteira.

import { createContext, useContext } from 'react';

import type { ReferenceIndex } from './reference-tables.ts';

const EMPTY: ReferenceIndex = { courses: new Map(), institutions: new Map() };

export const ReferenceContext = createContext<ReferenceIndex>(EMPTY);

export function useReferenceIndex(): ReferenceIndex {
  return useContext(ReferenceContext);
}
