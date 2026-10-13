// Se o aviso do armazenamento (StorageNotice) está aberto, fora do componente.

import { useSyncExternalStore } from 'react';

import type { StorageStatus } from '../model/store.ts';

/**
 * Aberto ou fechado fica fora do componente: o App o monta em lugares
 * diferentes com e sem currículo aberto, e o estado local voltaria a
 * "aberto" a cada troca. A notificação do sino reabre.
 */
let noticeOpen: boolean | undefined;
const listeners = new Set<() => void>();

export function setNoticeOpen(open: boolean): void {
  noticeOpen = open;
  for (const listener of listeners) listener();
}

export function useNoticeOpen(status: StorageStatus): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => noticeOpen ?? status !== 'cifrado',
  );
}

/**
 * Reabre o aviso depois de fechado; quem chama é a notificação do sino
 * (NotificationsMenu), que continua lá enquanto nada é guardado.
 */
export function openStorageNotice(): void {
  setNoticeOpen(true);
}
