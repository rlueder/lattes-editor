import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const { initStorage } = await import('../src/desktop/storage-key.ts');
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

  it('no pnpm dev usa a chave de desenvolvimento; fora do app e do dev, nenhuma', async () => {
    expect(await initStorage({ desktop: false, dev: true })).not.toBe('sem-chave');
    expect(await initStorage({ desktop: false, dev: false })).toBe('sem-chave');
    expect(invoke).not.toHaveBeenCalled();
  });
});
