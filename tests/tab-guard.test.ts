import { describe, expect, it, vi } from 'vitest';

import {
  type RemovedEvent,
  TAB_CLOSED,
  TAB_SILENT,
  untilTabCloses,
} from '../extension/src/tab-guard.ts';

/** O chrome.tabs.onRemoved de mentira: fecha uma aba e conta os ouvintes. */
function fakeRemoved() {
  const listeners = new Set<(id: number) => void>();
  const event: RemovedEvent = {
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
  };
  return { close: (id: number) => [...listeners].forEach((l) => l(id)), event, listeners };
}

const never = new Promise<never>(() => undefined);

describe('chamada à aba do Lattes que pode não voltar', () => {
  it('a resposta passa, e o ouvinte sai', async () => {
    const tabs = fakeRemoved();
    await expect(untilTabCloses(7, Promise.resolve('ok'), tabs.event, 1000)).resolves.toBe('ok');
    expect(tabs.listeners.size).toBe(0);
  });

  it('o erro da chamada passa como erro', async () => {
    const tabs = fakeRemoved();
    await expect(
      untilTabCloses(7, Promise.reject(new Error('Frame removed')), tabs.event, 1000),
    ).rejects.toThrow('Frame removed');
    expect(tabs.listeners.size).toBe(0);
  });

  it('a aba que fecha encerra a espera; outra aba não', async () => {
    const tabs = fakeRemoved();
    const waiting = untilTabCloses(7, never, tabs.event, 60_000);
    tabs.close(8);
    tabs.close(7);
    await expect(waiting).rejects.toThrow(TAB_CLOSED);
    expect(tabs.listeners.size).toBe(0);
  });

  it('sem resposta nem aba fechada, desiste no prazo', async () => {
    vi.useFakeTimers();
    try {
      const tabs = fakeRemoved();
      const waiting = untilTabCloses(7, never, tabs.event, 5000);
      const check = expect(waiting).rejects.toThrow(TAB_SILENT);
      await vi.advanceTimersByTimeAsync(5000);
      await check;
      expect(tabs.listeners.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
