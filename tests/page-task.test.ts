import { afterEach, expect, it, vi } from 'vitest';

import { withPageTask } from '../src/bridge/page-task.ts';
afterEach(() => vi.unstubAllGlobals());
it('a trava da origem recusa outra tarefa mesmo em outro mundo da página', async () => {
  vi.stubGlobal('window', {});
  let held = false;
  vi.stubGlobal('navigator', {
    locks: {
      request: async (_name: string, _opts: unknown, work: (lock: unknown) => unknown) => {
        if (held) return work(null);
        held = true;
        try {
          return await work({ name: 'lattes-editor-session' });
        } finally {
          held = false;
        }
      },
    },
  });
  let finish!: () => void;
  const first = withPageTask(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await expect(withPageTask(async () => undefined)).rejects.toThrow('ocupado');
  finish();
  await first;
  await expect(withPageTask(async () => 7)).resolves.toBe(7);
});
it('recusa rede no navegador sem a API de trava', async () => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', {});
  await expect(withPageTask(async () => undefined)).rejects.toThrow('trava de sessão');
});
