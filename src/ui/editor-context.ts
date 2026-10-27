// Estado do editor que componentes fundos na árvore precisam: que itens são
// novos (sequência acima da exportação carregada) e como abrir um no formulário.

import { createContext, useContext } from 'react';

import type { FormReadMark } from '../model/form-read.ts';
import type { Loaded } from '../model/production.ts';
import type { XElement } from '../model/xml.ts';

export interface EditorContextValue {
  /** Os itens lidos dos formulários do Lattes, pelo SEQUENCIA-PRODUCAO (form-read.ts). */
  formRead?: ReadonlyMap<string, FormReadMark>;
  loadedMax: Loaded;
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
