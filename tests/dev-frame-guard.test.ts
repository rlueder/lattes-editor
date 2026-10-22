import { afterEach, expect, it, vi } from 'vitest';

import { handleDevFrameGuard } from '../extension/src/dev-frame-guard.ts';
afterEach(() => vi.unstubAllGlobals());
it('a proteção é só Dev, valida a aba e bloqueia navegação de quadros sem afetar o fetch', async () => {
  vi.stubGlobal('__CANAL_DEV__', true);
  const updateSessionRules = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', { declarativeNetRequest: { updateSessionRules } });
  const respond = vi.fn();
  const sender = { tab: { id: 23, url: 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu' } };
  expect(
    handleDevFrameGuard(
      { type: 'dev-frame-guard', active: true },
      { tab: { id: 5, url: 'https://example.org' } },
      respond,
    ),
  ).toBe(false);
  expect(handleDevFrameGuard({ type: 'dev-frame-guard', active: true }, sender, respond)).toBe(
    true,
  );
  await Promise.resolve();
  expect(updateSessionRules).toHaveBeenLastCalledWith({
    removeRuleIds: [1000023],
    addRules: [
      {
        id: 1000023,
        priority: 1,
        action: { type: 'block' },
        condition: { tabIds: [23], resourceTypes: ['sub_frame'], urlFilter: '|http' },
      },
    ],
  });
  expect(respond).toHaveBeenCalledWith({ ok: true });
  handleDevFrameGuard({ type: 'dev-frame-guard', active: false }, sender, respond);
  expect(updateSessionRules).toHaveBeenLastCalledWith({ removeRuleIds: [1000023], addRules: [] });
  vi.stubGlobal('__CANAL_DEV__', false);
  expect(handleDevFrameGuard({ type: 'dev-frame-guard', active: true }, sender, respond)).toBe(
    false,
  );
});
