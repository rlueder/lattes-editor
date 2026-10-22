// A trava da origem vale entre mundos da página e sobrevive ao worker da extensão.
export async function withPageTask<T>(work: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return work();
  if (!navigator.locks) throw new Error('Este navegador não oferece a trava de sessão necessária');
  return navigator.locks.request('lattes-editor-session', { ifAvailable: true }, (lock) => {
    if (!lock) throw new Error('O conector está ocupado com outra tarefa no Lattes');
    return work();
  });
}
