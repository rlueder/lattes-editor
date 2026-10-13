// Liga a atualização automática no app de desktop: confere ao abrir, de hora
// em hora e ao voltar para a janela, e mostra o aviso de toasts.ts conforme o
// estado. Fora do app (navegador), não faz nada; no `pnpm dev`,
// ?simular-atualizacao simula uma versão nova (src/dev/fake-update.ts).

import { createElement, Fragment, useEffect, useSyncExternalStore } from 'react';

import { openExternal } from '../desktop/external-links.ts';
import { isDesktop } from '../desktop/native.ts';
import {
  checkForUpdate,
  dueForCheck,
  FIRST_CHECK_DELAY_MS,
  installUpdate,
  setUpdateDeps,
  subscribeUpdate,
  tauriDeps,
  type UpdateState,
  updateState,
} from '../desktop/update.ts';
import { RefreshIcon } from './icons.tsx';
import { APP_DOWNLOAD_URL } from './notifications.ts';
import { toasts } from './toasts.ts';
import { updateToastText } from './update-toast.ts';

const TOAST_ID = 'atualizacao';

/** Versão cujo aviso de "disponível" a pessoa fechou: não volta sozinho (o sino guarda). */
let dismissed: string | undefined;
let shown = false;

function syncToast(): void {
  const s = updateState();
  const text = updateToastText(s);
  if (!text || (s.status === 'disponivel' && dismissed === s.version)) return;
  const actionProps =
    text.action === 'atualizar'
      ? {
          children: createElement(Fragment, null, createElement(RefreshIcon), 'Atualizar'),
          onClick: () => void installUpdate(),
        }
      : text.action === 'baixar'
        ? { children: 'Baixar', onClick: () => openExternal(APP_DOWNLOAD_URL) }
        : undefined;
  const options = {
    actionProps,
    description: text.description,
    onClose: () => {
      shown = false;
      if (s.status === 'disponivel') dismissed = s.version;
    },
    timeout: 0,
    title: text.title,
  };
  if (shown) toasts.update(TOAST_ID, options);
  else {
    toasts.add({ ...options, id: TOAST_ID });
    shown = true;
  }
}

async function simulated(search: string): Promise<boolean> {
  if (!import.meta.env.DEV || !new URLSearchParams(search).has('simular-atualizacao')) return false;
  const { fakeUpdateDeps } = await import('../dev/fake-update.ts');
  setUpdateDeps(fakeUpdateDeps);
  return true;
}

/** Liga as conferências e devolve o estado da atualização, para o sino. */
export function useUpdates(): UpdateState {
  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeUpdate(syncToast);
    let interval: ReturnType<typeof setInterval> | undefined;
    const onFocus = () => {
      if (dueForCheck()) void checkForUpdate();
    };
    const first = setTimeout(() => {
      void (async () => {
        const fake = await simulated(location.search);
        if (!alive || (!fake && (!isDesktop() || import.meta.env.DEV))) return;
        if (!fake) setUpdateDeps(tauriDeps);
        void checkForUpdate();
        interval = setInterval(onFocus, 5 * 60_000);
        window.addEventListener('focus', onFocus);
      })();
    }, FIRST_CHECK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, []);
  return useSyncExternalStore(subscribeUpdate, updateState);
}
