// "Ordem dos campos" (⚙, com ?leitura): os campos do bloco em edição na
// ordem da prévia, como se leem acima deles ("Padrão LattesEditor"), ou na
// ordem do formulário do Lattes (form-order.ts). A escolha fica neste navegador, como as outras do ⚙.

import { useSyncExternalStore } from 'react';

export type FieldOrder = 'previa' | 'lattes';

export const FIELD_ORDERS: { label: string; value: FieldOrder }[] = [
  { label: 'Padrão LattesEditor', value: 'previa' },
  { label: 'Como no Lattes', value: 'lattes' },
];

const KEY = 'lattes-editor:ordem-dos-campos';
const listeners = new Set<() => void>();

/** O valor guardado; qualquer outra coisa (ou nada) é a ordem da prévia. */
export function parseFieldOrder(stored: string | null | undefined): FieldOrder {
  return stored === 'lattes' ? 'lattes' : 'previa';
}

function read(): FieldOrder {
  try {
    return parseFieldOrder(localStorage.getItem(KEY));
  } catch {
    // Armazenamento bloqueado (janela privada, prévia, testes): fica o padrão.
    return 'previa';
  }
}

let current = read();

export function getFieldOrder(): FieldOrder {
  return current;
}

export function setFieldOrder(next: FieldOrder): void {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Sem armazenamento, vale só nesta sessão.
  }
  for (const listener of listeners) listener();
}

export function useFieldOrder(): FieldOrder {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getFieldOrder,
    getFieldOrder,
  );
}
