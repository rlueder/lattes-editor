import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hostPermissions,
  isLattesMenu,
  LATTES_MENU,
  lattesMenus,
  SIMULATED_MENUS,
} from '../extension/src/lattes-hosts.ts';
import { lattesTab, reloadLattesTab } from '../extension/src/lattes-tab.ts';

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

describe('onde a extensão procura o Lattes', () => {
  it('a publicada só conhece wwws.cnpq.br, no manifest e nas abas', () => {
    expect(hostPermissions(false)).toEqual(['https://wwws.cnpq.br/*']);
    expect(lattesMenus(false)).toEqual([LATTES_MENU]);
    expect(isLattesMenu('https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu?f_cod=x', false)).toBe(
      true,
    );
    expect(isLattesMenu('http://127.0.0.1:5197/cvlattesweb/PKG_MENU.menu', false)).toBe(false);
    expect(isLattesMenu(undefined, false)).toBe(false);
  });

  it('a do canal Dev acha também o Lattes simulado em localhost', () => {
    expect(hostPermissions(true)).toEqual([
      'https://wwws.cnpq.br/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
    expect(lattesMenus(true)).toEqual([LATTES_MENU, ...SIMULATED_MENUS]);
    expect(isLattesMenu('http://127.0.0.1:5197/cvlattesweb/PKG_MENU.menu', true)).toBe(true);
    expect(isLattesMenu('http://localhost/cvlattesweb/PKG_MENU.menu?x=1', true)).toBe(true);
    expect(isLattesMenu('http://localhost:5173/', true)).toBe(false);
    expect(isLattesMenu('https://exemplo.com/cvlattesweb/PKG_MENU.menu', true)).toBe(false);
  });

  it('a busca da aba usa a lista do canal', async () => {
    const query = vi.fn(() => Promise.resolve([{ id: 3 }]));
    vi.stubGlobal('chrome', { tabs: { query } });
    expect(await lattesTab()).toBe(3);
    expect(query).toHaveBeenCalledWith({ url: [LATTES_MENU] });
    vi.unstubAllGlobals();
  });
});
