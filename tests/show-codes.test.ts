import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('mostrar códigos do Lattes', () => {
  it('fica desligado por padrão e guarda a escolha neste navegador', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const { setShowCodes } = await import('../src/ui/show-codes.ts');
    setShowCodes(true);
    expect(store.get('mostrar-codigos-do-lattes')).toBe('1');
    vi.resetModules();
    const again = await import('../src/ui/show-codes.ts');
    // Lido de novo ao carregar: a escolha volta.
    again.setShowCodes(false);
    expect(store.get('mostrar-codigos-do-lattes')).toBe('0');
  });

  it('sem armazenamento (janela privada), vale só na sessão', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    const { setShowCodes } = await import('../src/ui/show-codes.ts');
    expect(() => setShowCodes(true)).not.toThrow();
  });
});
