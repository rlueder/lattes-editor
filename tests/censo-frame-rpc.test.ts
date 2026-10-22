import { afterEach, expect, it, vi } from 'vitest';

import {
  type FrameQueue,
  postFrameCommand,
  receiveFrameReply,
} from '../extension/src/censo-frame-rpc.ts';

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

it('permite inspecionar e continuar após erro comum de um comando', async () => {
  vi.useFakeTimers();
  const state: FrameQueue = { next: 0, port: { postMessage: vi.fn() }, posted: false };
  const failed = postFrameCommand(state, { type: 'inspect' });
  receiveFrameReply(state, { id: state.next, error: 'Formulário ausente', fatal: false });
  await expect(failed).rejects.toThrow('Formulário ausente');
  expect(state.error).toBeUndefined();
  const retry = postFrameCommand<string>(state, { type: 'inspect' });
  receiveFrameReply(state, { id: state.next, value: 'página atual' });
  await expect(retry).resolves.toBe('página atual');
  expect(vi.getTimerCount()).toBe(0);
});

it('mantém o quadro bloqueado depois de uma violação fatal', async () => {
  vi.useFakeTimers();
  const state: FrameQueue = { next: 0, port: { postMessage: vi.fn() }, posted: false };
  const failed = postFrameCommand(state, { type: 'inspect' });
  receiveFrameReply(state, { id: state.next, error: 'Acesso ao pai recusado', fatal: true });
  await expect(failed).rejects.toThrow('Acesso ao pai');
  await expect(postFrameCommand(state, { type: 'inspect' })).rejects.toThrow('Acesso ao pai');
  expect(state.port.postMessage).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
