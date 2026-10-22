// A trava fica no worker durante a chamada inteira, incluindo a injeção.
// A aba tem outra trava, que sobrevive à reinjeção e ao reinício do worker.

const tasks = new Map<number, Promise<void>>();
export const sessionTaskRunning = () => tasks.size > 0;

export async function withSessionTask<T>(
  tabId: number,
  work: () => Promise<T>,
  wait = false,
): Promise<T> {
  const previous = tasks.get(tabId);
  if (previous && !wait)
    throw new Error('O conector está ocupado com outra leitura ou gravação no Lattes');
  let release!: () => void;
  const reservation = new Promise<void>((resolve) => {
    release = resolve;
  });
  tasks.set(tabId, reservation);
  try {
    if (previous) await previous;
    return await work();
  } finally {
    if (tasks.get(tabId) === reservation) tasks.delete(tabId);
    release();
  }
}
