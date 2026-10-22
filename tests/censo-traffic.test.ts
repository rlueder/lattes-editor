import { afterEach, expect, it, vi } from 'vitest';

import { CensusTraffic } from '../extension/src/censo-traffic.ts';
let host: MessagePort | undefined;
afterEach(() => {
  host?.close();
  vi.unstubAllGlobals();
});
function server() {
  vi.stubGlobal('location', { origin: 'https://example.invalid' });
  vi.stubGlobal('window', {
    postMessage: (_name: string, _origin: string, ports: MessagePort[]) => {
      host = ports[0];
      host!.addEventListener('message', (e: MessageEvent) => {
        if (e.data.type === 'end') host!.postMessage({ id: -1, value: true });
      });
      host!.start();
      host!.postMessage({ id: 0, value: true });
    },
  });
}
it('encaminha pedidos pelo canal e recusa chamadas fora de uma tarefa ou concorrentes', async () => {
  server();
  const traffic = new CensusTraffic();
  await expect(traffic.request('/a')).rejects.toThrow('fora de uma tarefa');
  const result = await traffic.run(async () => {
    await expect(traffic.run(async () => undefined)).rejects.toThrow('ocupado');
    host!.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'request')
        host!.postMessage({
          id: e.data.id,
          value: { bytes: new Uint8Array([65]), status: 200, url: e.data.url, headers: [] },
        });
    };
    return traffic.request('https://example.invalid/cvlattesweb/a');
  });
  expect(result.bytes).toEqual(new Uint8Array([65]));
});
it('erro do transporte interrompe a tarefa e impede um segundo pedido', async () => {
  server();
  const traffic = new CensusTraffic();
  await expect(
    traffic.run(async () => {
      host!.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'request') host!.postMessage({ id: e.data.id, error: 'HTTP 429' });
      };
      await expect(traffic.request('/a')).rejects.toThrow('HTTP 429');
      await expect(traffic.request('/b')).rejects.toThrow('HTTP 429');
    }),
  ).rejects.toThrow('HTTP 429');
});
it('parar rejeita o pedido e uma espera em andamento', async () => {
  server();
  const traffic = new CensusTraffic();
  await expect(
    traffic.run(async () => {
      const waiting = expect(traffic.wait(10000)).rejects.toThrow('interrompido');
      const pending = expect(traffic.request('/a')).rejects.toThrow('interrompido');
      traffic.cancel();
      await Promise.all([waiting, pending]);
    }),
  ).rejects.toThrow('interrompido');
});
