import { afterEach, describe, expect, it, vi } from 'vitest';

import { reloadLattesTab } from '../extension/src/lattes-tab.ts';

function stubTabs(tabs: { query: () => Promise<{ id?: number }[]>; reload?: () => Promise<void> }) {
  const reload = vi.fn(tabs.reload ?? (() => Promise.resolve()));
  vi.stubGlobal('chrome', { tabs: { query: tabs.query, reload } });
  return reload;
}

describe('recarregar a aba do Lattes (sessão vencida)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recarrega a aba do menu e diz que recarregou', async () => {
    const reload = stubTabs({ query: () => Promise.resolve([{ id: 7 }]) });
    expect(await reloadLattesTab()).toBe(true);
    expect(reload).toHaveBeenCalledWith(7);
  });

  it('sem aba do Lattes, devolve false sem recarregar nada', async () => {
    const reload = stubTabs({ query: () => Promise.resolve([]) });
    expect(await reloadLattesTab()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('aba fechada no meio do caminho: devolve false em vez de rejeitar', async () => {
    stubTabs({
      query: () => Promise.resolve([{ id: 7 }]),
      reload: () => Promise.reject(new Error('No tab with id: 7')),
    });
    expect(await reloadLattesTab()).toBe(false);
    stubTabs({ query: () => Promise.reject(new Error('falhou')) });
    expect(await reloadLattesTab()).toBe(false);
  });
});
