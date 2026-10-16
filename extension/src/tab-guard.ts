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

/** O evento de aba fechada, como chrome.tabs.onRemoved, para os testes trocarem. */
export interface RemovedEvent {
  addListener(cb: (tabId: number) => void): void;
  removeListener(cb: (tabId: number) => void): void;
}

/**
 * A promessa da chamada, ou um erro quando a aba fecha ou o prazo passa,
 * o que vier primeiro. Quem chama trata o erro como já tratava a falha do
 * executeScript (a escrita vira divergente; a leitura, relatório de erro).
 */
export function untilTabCloses<T>(
  tabId: number,
  work: Promise<T>,
  removed: RemovedEvent,
  ms = TAB_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onRemoved = (id: number) => {
      if (id !== tabId) return;
      done();
      reject(new Error(TAB_CLOSED));
    };
    const timer = setTimeout(() => {
      done();
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
