// Valores que o envio ao Lattes pede e o XML não guarda (o texto do potencial
// de inovação de um projeto), por mudança (Change.key). Ficam na memória do
// editor: depois de recarregar, a mudança volta a pedir o texto, com o motivo
// na lista de alterações.

import { useSyncExternalStore } from 'react';

export type SendExtras = Readonly<Record<string, Readonly<Record<string, string>>>>;

let current: SendExtras = {};
const listeners = new Set<() => void>();

export function setSendExtra(key: string, field: string, value: string): void {
  current = { ...current, [key]: { ...current[key], [field]: value } };
  for (const l of listeners) l();
}

export const sendExtras = (): SendExtras => current;

export function useSendExtras(): SendExtras {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    sendExtras,
    sendExtras,
  );
}
