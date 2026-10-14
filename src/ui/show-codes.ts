// "Mostrar códigos do Lattes" (Exibição, no menu de configurações): os campos
// que o próprio Lattes gera (códigos de instituição e curso, identificadores,
// formatos, data de atualização) ficam escondidos por padrão, porque ninguém os
// preenche nem edita. Servem para casar um item do editor com o do Lattes,
// quando algo dá errado. A escolha fica neste navegador.

import { useSyncExternalStore } from 'react';

const KEY = 'mostrar-codigos-do-lattes';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Armazenamento bloqueado (janela privada, prévia): fica o padrão.
    return false;
  }
}

let showCodes = read();

export function setShowCodes(next: boolean): void {
  showCodes = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // Sem armazenamento, vale só nesta sessão.
  }
  for (const listener of listeners) listener();
}

export function useShowCodes(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => showCodes,
  );
}
