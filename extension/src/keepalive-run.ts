// A sessão do Lattes viva enquanto o app está aberto (src/bridge/keepalive.ts):
// o alarme de cada minuto confere se já é hora de um pedido pequeno à sessão.

import { KEEPALIVE_KEY, keepaliveDue, type KeepaliveState } from '../../src/bridge/keepalive.ts';
import { hasConsent } from './consent.ts';
import { guarded, injectRunner, lattesTab } from './lattes-tab.ts';
import { sessionTaskRunning, withSessionTask } from './session-task.ts';
import { readState } from './state.ts';

/** Menu carregado é sessão nova (ou a mesma, viva): o próximo pedido conta daqui. */
export const sessionLoaded = () =>
  chrome.storage.session.set({ [KEEPALIVE_KEY]: { at: Date.now() } }).catch(() => undefined);

/**
 * Um pedido pequeno à sessão da aba: true se ela continua viva, false se
 * caiu, undefined se a aba não respondeu ou estava ocupada (nunca espera outra
 * tarefa da aba).
 */
async function keepSessionAlive(tabId: number): Promise<boolean | undefined> {
  return withSessionTask(tabId, async () => {
    await injectRunner(tabId);
    const [res] = await guarded(tabId, () =>
      chrome.scripting.executeScript({
        func: () =>
          (
            globalThis as unknown as { __conector: { manter(): Promise<{ viva: boolean }> } }
          ).__conector.manter(),
        target: { tabId },
      }),
    );
    return (res?.result as { viva: boolean } | undefined)?.viva;
  }).catch(() => undefined);
}

export async function keepAlive(deps: {
  /** O que só o service worker sabe: a fila, a verificação e a aba em uso. */
  busy: () => boolean;
  connected: () => boolean;
  /** A sessão caiu: o app relê a sessão e mostra o motivo. */
  dropped: () => Promise<void>;
}): Promise<void> {
  const state = ((await chrome.storage.session.get(KEEPALIVE_KEY))[KEEPALIVE_KEY] ??
    {}) as KeepaliveState;
  const tabId = await lattesTab();
  const ready = {
    appConnected: deps.connected(),
    busy: (await readState()).running || sessionTaskRunning() || deps.busy(),
    consent: await hasConsent(),
    tab: tabId !== undefined,
  };
  if (!keepaliveDue(state, Date.now(), ready) || tabId === undefined) return;
  const alive = await keepSessionAlive(tabId);
  // A aba não respondeu: tenta de novo no próximo minuto.
  if (alive === undefined) return;
  await chrome.storage.session.set({ [KEEPALIVE_KEY]: { at: Date.now(), dead: !alive } });
  if (!alive) await deps.dropped();
}
