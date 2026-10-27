/** Quanto uma tarefa espera a anterior soltar a trava antes de desistir. */
export const PAGE_TASK_WAIT_MS = 30_000;

export const PAGE_TASK_BUSY = 'O conector está ocupado com outra tarefa no Lattes';

// A trava da origem vale entre mundos da página e sobrevive ao worker da extensão.
// Uma tarefa que chega com outra em curso (a conferência que roda quando o
// menu carrega, a releitura do menu, o pedido que mantém a sessão) espera a
// vez, até o prazo, em vez de falhar na hora: na abertura do editor, elas
// chegam juntas (observado em 27/10/2026).
export async function withPageTask<T>(
  work: () => Promise<T>,
  waitMs = PAGE_TASK_WAIT_MS,
): Promise<T> {
  if (typeof window === 'undefined') return work();
  if (!navigator.locks) throw new Error('Este navegador não oferece a trava de sessão necessária');
  // Só o prazo da espera vira "ocupado"; um AbortError da própria tarefa (um
  // pedido cancelado por traffic.cancel(), por exemplo) sobe como veio.
  let started = false;
  try {
    return await navigator.locks.request(
      'lattes-editor-session',
      { signal: AbortSignal.timeout(waitMs) },
      () => {
        started = true;
        return work();
      },
    );
  } catch (err) {
    const name = (err as { name?: string } | undefined)?.name;
    if (!started && (name === 'TimeoutError' || name === 'AbortError')) {
      throw new Error(PAGE_TASK_BUSY);
    }
    throw err;
  }
}
