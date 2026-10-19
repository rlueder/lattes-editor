// O campo que o formulário do Lattes não tem, num item que já está lá
// (src/bridge/form-lacks.ts), para o AttributeField mostrar sem edição. Sem
// provedor (a tela inicial, os testes), nenhum campo trava.

import { createContext, useContext } from 'react';

import type { XElement } from '../model/xml.ts';

export interface FormLacks {
  /** Uma parte nova do item (as palavras-chave). */
  child: (item: XElement, name: string) => string | undefined;
  /** Um campo do elemento. */
  field: (el: XElement, attr: string) => string | undefined;
  /** A chave da mudança do elemento (Change.key), para o que o envio pede fora do XML. */
  keyOf?: (el: XElement) => string | undefined;
  /** O valor do campo na exportação carregada; undefined num elemento novo. */
  original?: (el: XElement, attr: string) => string | undefined;
}

export const FormLacksContext = createContext<FormLacks | undefined>(undefined);

export function useFormLacks(): FormLacks | undefined {
  return useContext(FormLacksContext);
}
