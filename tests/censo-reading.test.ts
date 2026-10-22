import { afterEach, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../extension/src/censo-traffic.ts', () => ({
  censusTraffic: { request, signal: new AbortController().signal },
}));
import { censusGet, clearCensusCache, withCensusCache } from '../extension/src/censo-reading.ts';

afterEach(() => {
  clearCensusCache();
  request.mockReset();
});

it('deduplica na mesma tarefa e lê novamente após uma edição entre tarefas', async () => {
  const url = new URL('https://sintetico.invalid/lista');
  const response = (text: string) => ({ bytes: new TextEncoder().encode(text), status: 200 });
  request.mockResolvedValueOnce(response('antes')).mockResolvedValueOnce(response('depois'));
  await withCensusCache(async () => {
    expect(await censusGet(url)).toEqual(response('antes'));
    expect(await censusGet(url)).toEqual(response('antes'));
    expect(request).toHaveBeenCalledTimes(1);
  });
  await withCensusCache(async () => {
    expect(await censusGet(url)).toEqual(response('depois'));
  });
  expect(request).toHaveBeenCalledTimes(2);
});

it('libera páginas após erro e descarta cópias anteriores ao iniciar', async () => {
  const url = new URL('https://sintetico.invalid/lista');
  request.mockResolvedValue({ bytes: new Uint8Array([1]), status: 200 });
  await censusGet(url);
  await expect(
    withCensusCache(async () => {
      await censusGet(url);
      throw new Error('cancelado');
    }),
  ).rejects.toThrow('cancelado');
  await censusGet(url);
  expect(request).toHaveBeenCalledTimes(3);
});
