// Uma chamada à aba do Lattes que pode nunca voltar. Um executeScript cuja
// função devolve uma promessa espera por ela, e se a aba fecha ou navega no
// meio (sessão que cai e leva ao login), a resposta pode não vir nem como
// erro. A fila ficava "gravando" para sempre, e o editor também (teste
// acompanhado de 16/10/2026: a aba fechou durante a inclusão de uma formação).
// Aqui a chamada desiste quando a aba fecha, ou depois de um prazo.

/** Prazo de uma chamada à aba: a operação mais longa abre uma lista e cada formulário dela. */
export const TAB_TIMEOUT_MS = 3 * 60_000;

export const TAB_CLOSED = 'A aba do Lattes fechou';
export const TAB_SILENT = 'A aba do Lattes não respondeu';
export const TAB_BUSY =
  'A aba do Lattes pode ainda estar gravando a operação anterior, que não respondeu a tempo: recarregue a aba do Lattes e confira antes de seguir';

/**
 * Abas com uma chamada que passou do prazo e ainda não terminou. O script
 * segue rodando na aba e a gravação pode acontecer depois; outra chamada na
 * mesma aba, enquanto isso, poderia repetir uma inclusão ou cruzar com ela.
 * A aba sai daqui quando a chamada termina ou a página recarrega.
 */
const unsettled = new Set<number>();

/** Quando cada aba recarregou ou navegou pela última vez (Date.now()). */
const reloads = new Map<number, number>();

/** A página da aba recarregou ou navegou: o script de antes morreu com ela. */
export function tabReloaded(tabId: number, at = Date.now()): void {
  unsettled.delete(tabId);
  reloads.set(tabId, at);
}

/** A aba recarregou ou navegou depois de `since`, no meio de uma chamada. */
export const reloadedSince = (tabId: number, since: number): boolean =>
  (reloads.get(tabId) ?? Number.NEGATIVE_INFINITY) >= since;

/** O evento de aba fechada, como chrome.tabs.onRemoved, para os testes trocarem. */
export interface RemovedEvent {
  addListener(cb: (tabId: number) => void): void;
  removeListener(cb: (tabId: number) => void): void;
}

/**
 * A promessa da chamada, ou um erro quando a aba fecha ou o prazo passa,
 * o que vier primeiro. Com uma chamada de antes ainda pendente na aba, nem
 * começa. Quem chama trata o erro como já tratava a falha do
 * executeScript (a escrita vira divergente; a leitura, relatório de erro).
 */
export function untilTabCloses<T>(
  tabId: number,
  start: () => Promise<T>,
  removed: RemovedEvent,
  ms = TAB_TIMEOUT_MS,
): Promise<T> {
  if (unsettled.has(tabId)) return Promise.reject(new Error(TAB_BUSY));
  const work = start();
  return new Promise<T>((resolve, reject) => {
    const onRemoved = (id: number) => {
      if (id !== tabId) return;
      done();
      reject(new Error(TAB_CLOSED));
    };
    const timer = setTimeout(() => {
      done();
      unsettled.add(tabId);
      void work.then(
        () => unsettled.delete(tabId),
        () => unsettled.delete(tabId),
      );
      reject(new Error(TAB_SILENT));
    }, ms);
    function done() {
      clearTimeout(timer);
      removed.removeListener(onRemoved);
    }
    removed.addListener(onRemoved);
    work.then(
      (value) => {
        done();
        resolve(value);
      },
      (err: unknown) => {
        done();
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/** Espera a aba terminar de carregar, até `ms`, depois de recarregar no meio de uma leitura. */
export async function tabSettled(tabId: number, ms = 30_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (!tab || tab.status === 'complete') return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
