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

it('limita a pausa persistida e permite consultá-la somente pela aba do Lattes', async () => {
  const now = Date.now();
  let stored: Record<string, unknown> = { 'traffic-pause-until': now + 1e12 };
  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: async () => stored,
        set: async (v: Record<string, unknown>) => {
          stored = v;
        },
      },
    },
  });
  const sender = { tab: { url: 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu' } };
  const read = await new Promise<{ until: number }>((resolve) => {
    handleTrafficPause({ type: 'traffic-pause-read' }, sender, (v) =>
      resolve(v as { until: number }),
    );
  });
  expect(read.until).toBeLessThanOrEqual(Date.now() + 3600000);
  await new Promise<void>((resolve) => {
    handleTrafficPause({ type: 'traffic-pause', until: now + 1e12 }, sender, () => resolve());
  });
  expect(stored['traffic-pause-until']).toBeLessThanOrEqual(Date.now() + 3600000);
  expect(
    handleTrafficPause(
      { type: 'traffic-pause-read' },
      { tab: { url: 'https://example.org' } },
      () => undefined,
    ),
  ).toBe(false);
});

it('normaliza um valor antigo uma vez, sem adiar o fim da pausa a cada leitura', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    let stored: Record<string, unknown> = { 'traffic-pause-until': 1e12 };
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: async () => stored,
          set: async (v: Record<string, unknown>) => {
            stored = v;
          },
        },
      },
    });
    expect(await readTrafficPause()).toBe(3601000);
    clock.mockReturnValue(3602000);
    expect(await readTrafficPause()).toBe(3601000);
  } finally {
    clock.mockRestore();
  }
});
