import { describe, expect, it } from 'vitest';

import { sessionTaskRunning, withSessionTask } from '../extension/src/session-task.ts';

describe('exclusão mútua da aba', () => {
  it('recusa concorrência antes de injetar outro núcleo e solta a trava depois', async () => {
    let finish!: () => void;
    const first = withSessionTask(
      1,
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    expect(sessionTaskRunning()).toBe(true);
    let started = false;
    await expect(
      withSessionTask(1, async () => {
        started = true;
      }),
    ).rejects.toThrow('ocupado');
    expect(started).toBe(false);
    await withSessionTask(2, async () => undefined);
    finish();
    await first;
    expect(sessionTaskRunning()).toBe(false);
    await expect(
      withSessionTask(1, async () => {
        throw new Error('falha');
      }),
    ).rejects.toThrow('falha');
    expect(sessionTaskRunning()).toBe(false);
  });
});
