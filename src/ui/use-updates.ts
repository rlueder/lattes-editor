// Liga a atualização automática no app de desktop: confere ao abrir, a cada
// 15 minutos e ao voltar para a janela, e mostra o aviso de toasts.ts conforme
// o estado. "Verificar atualizações", no menu ⚙, pede a mesma conferência na
// hora. Fora do app (navegador), não faz nada; no `pnpm dev`,
// ?simular-atualizacao simula uma conferência (src/dev/fake-update.ts).

import { createElement, Fragment, useEffect, useSyncExternalStore } from 'react';

import { openExternal } from '../desktop/external-links.ts';
import { isDesktop } from '../desktop/native.ts';
import {
  checkForUpdate,
  checkUpdateNow,
  dueForCheck,
  FIRST_CHECK_DELAY_MS,
  installUpdate,
  manualCheckRunning,
  setUpdateDeps,
  subscribeManualCheck,
  subscribeUpdate,
  tauriDeps,
  updatesEnabled,
  type UpdateState,
  updateState,
} from '../desktop/update.ts';
import { RefreshIcon } from './icons.tsx';
import { APP_DOWNLOAD_URL } from './notifications.ts';
import { toasts } from './toasts.ts';
import { manualCheckText, updateToastKey, updateToastText } from './update-toast.ts';

const TOAST_ID = 'atualizacao';

/** O aviso que a pessoa fechou (updateToastKey): não volta sozinho; o sino guarda a oferta. */
let dismissed: string | undefined;
let shown = false;

function syncToast(): void {
  const s = updateState();
  const text = updateToastText(s);
  const key = updateToastKey(s);
  if (!text || dismissed === key) return;
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
      dismissed = key;
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

/** O aviso da última conferência pedida no menu, trocado pelo da seguinte. */
let manualToast: string | undefined;

function enabled(): boolean {
  return updatesEnabled({
    desktop: isDesktop(),
    dev: import.meta.env.DEV,
    search: location.search,
  });
}

/** Quem confere, posto uma vez só. */
let depsReady: Promise<void> | undefined;

/** Põe quem confere: o plugin no app, o simulado no `pnpm dev`. */
function installDeps(): Promise<void> {
  depsReady ??= (async () => {
    if (!import.meta.env.DEV) {
      setUpdateDeps(tauriDeps);
      return;
    }
    const { fakeUpdateDeps } = await import('../dev/fake-update.ts');
    setUpdateDeps(fakeUpdateDeps(new URLSearchParams(location.search).get('simular-atualizacao')));
  })();
  return depsReady;
}

/**
 * "Verificar atualizações", do menu ⚙. Versão nova traz de volta o aviso de
 * sempre, mesmo que a pessoa o tenha fechado antes; sem ela, um aviso curto
 * confirma a versão em uso ou diz que a conferência falhou.
 */
export async function checkUpdatesNow(): Promise<void> {
  // Um clique antes de quem confere estar posto espera por ele, em vez de
  // virar um "não deu para verificar". Se não der para pôr, aí sim é falha.
  try {
    await installDeps();
  } catch (err) {
    console.warn('Não deu para preparar a conferência de atualização:', err);
  }
  const outcome = await checkUpdateNow();
  if (!outcome) return;
  if (manualToast) toasts.close(manualToast);
  manualToast = undefined;
  const text = manualCheckText(outcome, __APP_VERSION__);
  if (text) {
    manualToast = toasts.add({ description: text.description, title: text.title });
    return;
  }
  dismissed = undefined;
  syncToast();
}

/** O item do menu: se aparece e se a conferência pedida está em andamento. */
export function useManualUpdateCheck(): { available: boolean; checking: boolean } {
  const checking = useSyncExternalStore(subscribeManualCheck, manualCheckRunning);
  return { available: enabled(), checking };
}

/** Liga as conferências e devolve o estado da atualização, para o sino. */
export function useUpdates(): UpdateState {
  useEffect(() => {
    if (!enabled()) return;
    let alive = true;
    const unsubscribe = subscribeUpdate(syncToast);
    let first: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    const onFocus = () => {
      if (dueForCheck()) void checkForUpdate();
    };
    // Quem confere entra já, para o menu ⚙ poder conferir antes da primeira
    // conferência automática; esta espera um pouco e respeita a hora marcada
    // por uma conferência pedida no menu.
    installDeps()
      .then(() => {
        if (!alive) return;
        first = setTimeout(() => {
          onFocus();
          // De minuto em minuto só se olha o relógio; a conferência sai na hora marcada.
          interval = setInterval(onFocus, 60_000);
          window.addEventListener('focus', onFocus);
        }, FIRST_CHECK_DELAY_MS);
      })
      .catch((err: unknown) => {
        console.warn('Não deu para preparar a conferência de atualização:', err);
      });
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
