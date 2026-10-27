import { afterEach, expect, it, vi } from 'vitest';

import { withPageTask } from '../src/bridge/page-task.ts';
afterEach(() => vi.unstubAllGlobals());

/** Uma trava como a do navegador: uma tarefa por vez, a fila espera até o sinal abortar. */
function fakeLocks() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request: (_name: string, opts: { signal?: AbortSignal }, work: () => Promise<unknown>) => {
      const turn = tail.then(
        () =>
          new Promise((resolve, reject) => {
            if (opts.signal?.aborted) return reject(opts.signal.reason as Error);
            work().then(resolve, reject);
          }),
      );
      tail = turn.catch(() => undefined);
      return new Promise((resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(opts.signal!.reason as Error));
        turn.then(resolve, reject);
      });
    },
  };
}

it('a tarefa que chega com outra em curso espera a vez, em vez de falhar', async () => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', { locks: fakeLocks() });
  let finish!: () => void;
  const order: string[] = [];
  const first = withPageTask(
    () =>
      new Promise<void>((resolve) => {
        finish = () => {
          order.push('primeira');
          resolve();
        };
      }),
  );
  const second = withPageTask(async () => {
    order.push('segunda');
    return 7;
  });
  // A primeira entra na trava num tique seguinte; a segunda fica na fila.
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(order).toEqual([]);
  finish();
  await first;
  await expect(second).resolves.toBe(7);
  expect(order).toEqual(['primeira', 'segunda']);
});

it('passado o prazo, diz que o conector está ocupado', async () => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', { locks: fakeLocks() });
  const stuck = withPageTask(() => new Promise<void>(() => undefined));
  await expect(withPageTask(async () => undefined, 20)).rejects.toThrow('ocupado');
  void stuck;
});

it('um AbortError da própria tarefa sobe como veio, sem virar "ocupado"', async () => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', { locks: fakeLocks() });
  const aborted = Object.assign(new Error('cancelado'), { name: 'AbortError' });
  await expect(withPageTask(() => Promise.reject(aborted))).rejects.toThrow('cancelado');
});

it('recusa rede no navegador sem a API de trava', async () => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', {});
  await expect(withPageTask(async () => undefined)).rejects.toThrow('trava de sessão');
});
