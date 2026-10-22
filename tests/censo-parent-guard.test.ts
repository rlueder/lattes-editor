import { afterEach, expect, it, vi } from 'vitest';

import { protectParent } from '../extension/src/censo-parent-guard.ts';
afterEach(() => vi.unstubAllGlobals());
it('bloqueia fetch, XHR e janelas no pai e restaura as funções depois da tarefa', async () => {
  const nativeFetch = vi.fn(async () => new Response('ok'));
  const nativeOpen = vi.fn(() => null);
  const NativeXHR = class {};
  const page = { fetch: nativeFetch, open: nativeOpen, XMLHttpRequest: NativeXHR };
  vi.stubGlobal('window', page);
  const stop = vi.fn();
  const restore = protectParent(stop);
  try {
    await expect(page.fetch()).rejects.toThrow('fora da ponte');
    expect(() => new page.XMLHttpRequest()).toThrow('fora da ponte');
    expect(() => page.open()).toThrow('fora da ponte');
    expect(stop).toHaveBeenCalledTimes(3);
    expect(nativeFetch).not.toHaveBeenCalled();
    expect(nativeOpen).not.toHaveBeenCalled();
  } finally {
    restore();
  }
  expect(page.fetch).toBe(nativeFetch);
  expect(page.open).toBe(nativeOpen);
  expect(page.XMLHttpRequest).toBe(NativeXHR);
});
