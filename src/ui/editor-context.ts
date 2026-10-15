// Estado do editor que componentes fundos na árvore precisam: que itens são
// novos (sequência acima da exportação carregada) e como abrir um no formulário.

import { createContext, useContext } from 'react';

import type { XElement } from '../model/xml.ts';

export interface EditorContextValue {
  loadedMax: number;
  openItem: (sequencia: number) => void;
  /** A raiz da cópia de trabalho: decide se um evento novo vai pelo conector ou pelo Importar. */
  root?: XElement;
}

export const EditorContext = createContext<EditorContextValue>({
  loadedMax: Number.POSITIVE_INFINITY,
  openItem: () => {},
});

export function useEditor(): EditorContextValue {
  return useContext(EditorContext);
}
