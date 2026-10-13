import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const { initStorage, KEYCHAIN_TIMEOUT_MS } = await import('../src/desktop/storage-key.ts');
const { storageStatus } = await import('../src/model/store.ts');

afterEach(() => {
  vi.clearAllMocks();
});

describe('chave dos dados locais', () => {
  it('no primeiro uso do app, gera a chave e pede para guardar no chaveiro', async () => {
    invoke.mockResolvedValueOnce(null).mockResolvedValueOnce(undefined);
    expect(await initStorage({ desktop: true, dev: false })).toBe('cifrado');
    expect(invoke.mock.calls[0]).toEqual(['storage_key_get']);
    const [cmd, args] = invoke.mock.calls[1]!;
    expect(cmd).toBe('storage_key_set');
    expect((args as { key: string }).key).toHaveLength(44);
  });

  it('com a chave já no chaveiro, só lê', async () => {
    invoke.mockResolvedValueOnce('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    await initStorage({ desktop: true, dev: false });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('chaveiro que não responde deixa o editor sem gravar, com o motivo', async () => {
    invoke.mockRejectedValueOnce(new Error('sem Secret Service'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await initStorage({ desktop: true, dev: false })).toBe('sem-chave');
    expect(storageStatus().reason).toBe('sem Secret Service');
  });

  it('chaveiro que não responde a tempo abre o editor sem gravar', async () => {
    vi.useFakeTimers();
    invoke.mockReturnValueOnce(new Promise(() => {}));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending = initStorage({ desktop: true, dev: false });
    await vi.advanceTimersByTimeAsync(KEYCHAIN_TIMEOUT_MS);
    expect(await pending).toBe('sem-chave');
    expect(storageStatus().reason).toMatch(/não respondeu a tempo/);
    vi.useRealTimers();
  });

  it('no pnpm dev usa a chave de desenvolvimento; fora do app e do dev, nenhuma', async () => {
    expect(await initStorage({ desktop: false, dev: true })).not.toBe('sem-chave');
    // O app de desktop em desenvolvimento também: não toca o chaveiro.
    invoke.mockClear();
    expect(await initStorage({ desktop: true, dev: true })).not.toBe('sem-chave');
    expect(invoke).not.toHaveBeenCalled();
    expect(await initStorage({ desktop: false, dev: false })).toBe('sem-chave');
    expect(invoke).not.toHaveBeenCalled();
  });
});
