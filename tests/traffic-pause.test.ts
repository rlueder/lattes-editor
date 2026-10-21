import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleTrafficPause, readTrafficPause } from '../extension/src/traffic-pause.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pausa persistida na extensão', () => {
  it('só aceita a aba do Lattes e preserva a maior pausa entre mensagens concorrentes', async () => {
    let stored: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: async () => stored,
          set: async (values: Record<string, unknown>) => {
            stored = { ...stored, ...values };
          },
        },
      },
    });
    const send = (until: number, url = 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu') =>
      new Promise<boolean>((resolve) => {
        const handled = handleTrafficPause({ type: 'traffic-pause', until }, { tab: { url } }, () =>
          resolve(true),
        );
        if (!handled) resolve(false);
      });
    expect(await send(9999, 'https://example.invalid/')).toBe(false);
    expect(handleTrafficPause(null, {}, () => undefined)).toBe(false);
    expect(handleTrafficPause({ type: 'traffic-pause', until: 'erro' }, {}, () => undefined)).toBe(
      false,
    );
    await Promise.all([send(5000), send(1000)]);
    expect(await readTrafficPause()).toBe(5000);
  });
});
