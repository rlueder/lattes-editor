import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, readTheme } from '../src/ui/theme.ts';

describe('tema', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lê a preferência salva e cai para "sistema" sem armazenamento', () => {
    expect(readTheme()).toBe('sistema');
    vi.stubGlobal('localStorage', { getItem: () => 'escuro' });
    expect(readTheme()).toBe('escuro');
    vi.stubGlobal('localStorage', { getItem: () => 'roxo' });
    expect(readTheme()).toBe('sistema');
  });

  it('data-theme força claro ou escuro; "sistema" remove', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyTheme('claro', root);
    expect(root.dataset.theme).toBe('light');
    applyTheme('escuro', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('sistema', root);
    expect(root.dataset.theme).toBeUndefined();
  });
});
