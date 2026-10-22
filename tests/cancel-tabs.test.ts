import { afterEach, expect, it, vi } from 'vitest';

import { cancelInTab } from '../extension/src/lattes-tab.ts';
afterEach(() => vi.unstubAllGlobals());
it('parar alcança a aba real mesmo quando o simulado é o primeiro resultado', async () => {
  vi.stubGlobal('__CANAL_DEV__', true);
  const executeScript = vi.fn(async (_injection: { target: { tabId: number } }) => []);
  vi.stubGlobal('chrome', {
    tabs: {
      query: async () => [
        { id: 1, url: 'http://localhost/cvlattesweb/PKG_MENU.menu' },
        { id: 2, url: 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu' },
      ],
    },
    scripting: { executeScript },
  });
  await cancelInTab();
  expect(
    executeScript.mock.calls
      .map(([arg]) => (arg as { target: { tabId: number } }).target.tabId)
      .sort(),
  ).toEqual([1, 1, 2, 2]);
});
