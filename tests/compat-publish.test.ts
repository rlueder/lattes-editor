import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../src/bridge/publish.ts');
  vi.resetModules();
});

describe('capacidade de publicação separada da leitura', () => {
  it.each([false, true])('anuncia escrita somente com a chave ligada: %s', async (enabled) => {
    vi.doMock('../src/bridge/publish.ts', () => ({ PUBLISH_ENABLED: enabled }));
    const { BRIDGE_FEATURES } = await import('../src/bridge/compat.ts');
    expect(BRIDGE_FEATURES).toContain('enviar-cnpq');
    if (enabled) expect(BRIDGE_FEATURES).toContain('publicar-cnpq');
    else expect(BRIDGE_FEATURES).not.toContain('publicar-cnpq');
  });
});
