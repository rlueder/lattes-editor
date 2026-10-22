import { afterEach, expect, it, vi } from 'vitest';

import { type FrameQueue, postFrameCommand } from '../extension/src/censo-frame-rpc.ts';

afterEach(() => vi.useRealTimers());
it('libera reserva e timer após falha de clonagem e aceita o próximo comando', async () => {
  vi.useFakeTimers();
  const port = {
    postMessage: vi.fn().mockImplementationOnce(() => {
      throw new DOMException('Não pode clonar', 'DataCloneError');
    }),
  };
  const state: FrameQueue = { next: 0, port, posted: false };
  await expect(postFrameCommand(state, { type: 'inspect' })).rejects.toMatchObject({
    name: 'DataCloneError',
  });
  expect(state.pending).toBeUndefined();
  expect(state.error).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
  const retry = postFrameCommand<string>(state, { type: 'inspect' });
  state.pending!.resolve('ok');
  state.pending = undefined;
  await expect(retry).resolves.toBe('ok');
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(30_001);
  expect(state.error).toBeUndefined();
});
