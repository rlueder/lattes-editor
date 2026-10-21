// A trava fica no worker durante a chamada inteira, incluindo a injeção.
// A aba tem outra trava, que sobrevive à reinjeção e ao reinício do worker.

const tasks = new Set<number>();
export const sessionTaskRunning = () => tasks.size > 0;

export async function withSessionTask<T>(tabId: number, work: () => Promise<T>): Promise<T> {
  if (tasks.has(tabId))
    throw new Error('O conector está ocupado com outra leitura ou gravação no Lattes');
  tasks.add(tabId);
  try {
    return await work();
  } finally {
    tasks.delete(tabId);
  }
}
