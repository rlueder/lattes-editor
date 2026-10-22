import { afterEach, expect, it, vi } from 'vitest';

import { withTraffic } from '../extension/src/page-traffic.ts';
import { LattesTransport } from '../src/bridge/transport.ts';
afterEach(() => vi.unstubAllGlobals());
it('relê a pausa depois de adquirir a trava e impede rede quando outra aba pediu espera', async () => {
  let locked = false;
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', {
    locks: {
      request: async (_name: string, _options: unknown, work: (lock: unknown) => unknown) => {
        locked = true;
        try {
          return await work({});
        } finally {
          locked = false;
        }
      },
    },
  });
  const sendMessage = vi.fn(async () => {
    expect(locked).toBe(true);
    return { until: 2000 };
  });
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  const traffic = new LattesTransport({ now: () => 1000 });
  vi.stubGlobal('__lattesTraffic', traffic);
  const work = vi.fn(async () => undefined);
  await expect(withTraffic(() => traffic.run(work))).rejects.toThrow('pausa');
  expect(work).not.toHaveBeenCalled();
  expect(sendMessage).toHaveBeenCalledWith({ type: 'traffic-pause-read' });
});
