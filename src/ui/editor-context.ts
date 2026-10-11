// Estado do editor que componentes fundos na árvore precisam: que itens são
// novos (sequência acima da exportação carregada) e como abrir um no formulário.

import { createContext, useContext } from 'react';

export interface EditorContextValue {
  loadedMax: number;
  openItem: (sequencia: number) => void;
}

export const EditorContext = createContext<EditorContextValue>({
  loadedMax: Number.POSITIVE_INFINITY,
  openItem: () => {},
});

export function useEditor(): EditorContextValue {
  return useContext(EditorContext);
}
