import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LattesState } from '../scripts/lattes-simulado/estado.ts';
import { handle } from '../scripts/lattes-simulado/servidor.ts';
import type { OpResult } from '../src/bridge/apply.ts';
import type { ContractReport } from '../src/bridge/contract.ts';
import type { BridgeOp } from '../src/bridge/plan.ts';
import { LattesTransport } from '../src/bridge/transport.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { readHtmlForm } from './helpers/html-form.ts';

interface Runner {
  apply(op: BridgeOp): Promise<OpResult>;
  exportar(): Promise<unknown>;
  verificar(kinds?: BridgeOp['kind'][]): Promise<ContractReport>;
}
const runner = () => (globalThis as unknown as { __conector: Runner }).__conector;
const summary: BridgeOp = {
  expect: {},
  key: 'resumo',
  kind: 'resumo',
  label: 'Resumo',
  set: { F_TEXTO: 'Texto sintético novo' },
};
let state: LattesState;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(async () => {
  vi.resetModules();
  state = await LattesState.create();
  const menu = await handle(state, {
    body: new Uint8Array(),
    contentType: '',
    method: 'GET',
    path: '/cvlattesweb/PKG_MENU.menu',
  });
  vi.stubGlobal('document', { documentElement: { outerHTML: 'html' in menu ? menu.html : '' } });
  vi.stubGlobal('location', { href: 'https://example.invalid/cvlattesweb/PKG_MENU.menu' });
  vi.stubGlobal(
    'DOMParser',
    class {
      parseFromString(html: string) {
        return {
          querySelector: (selector: string) => {
            const name = /form\[name="(.*)"\]/.exec(selector)?.[1] ?? '';
            const controls = readHtmlForm(html, name);
            return (
              controls && {
                elements: controls.map((c) => ({
                  ...c,
                  tagName: c.type.startsWith('select') ? 'SELECT' : 'INPUT',
                  selectedOptions: c.selected?.map((value) => ({ value })) ?? [],
                })),
              }
            );
          },
        };
      }
    },
  );
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const response = await handle(state, {
      body: encodeLatin1(String(init?.body ?? '')),
      contentType: 'application/x-www-form-urlencoded',
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
    });
    if (!('html' in response)) throw new Error('O teste esperava HTML');
    return new Response(encodeLatin1(response.html) as Uint8Array<ArrayBuffer>, {
      status: response.status ?? 200,
    });
  });
  vi.stubGlobal(
    '__lattesTraffic',
    new LattesTransport({ fetch: fetchMock, perMinute: 1000, spacingMs: 0 }),
  );
  vi.stubGlobal('__lattesScans', undefined);
  vi.stubGlobal('__conector', undefined);
  await import('../extension/src/lattes-runner.ts');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transporte usado pelo núcleo injetado', () => {
  it('o primeiro HTTP 429 para a verificação inteira e bloqueia novas tarefas', async () => {
    fetchMock.mockImplementation(
      async () => new Response('pare', { status: 429, headers: { 'Retry-After': '60' } }),
    );
    await expect(runner().verificar()).rejects.toThrow('HTTP 429');
    await expect(runner().exportar()).rejects.toThrow('pausa');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a pausa antes do POST volta como erro sem fingir uma gravação incerta', async () => {
    fetchMock.mockImplementation(async () => new Response('pare', { status: 429 }));
    expect(await runner().apply(summary)).toMatchObject({ key: 'resumo', status: 'erro' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('um erro no POST fica divergente e não é reenviado nem seguido de outra leitura', async () => {
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) =>
      init?.method === 'POST'
        ? Promise.resolve(new Response('pare', { status: 503 }))
        : normal(input, init),
    );
    expect(await runner().apply(summary)).toMatchObject({ key: 'resumo', status: 'divergente' });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a reinjeção mantém a trava enquanto outra tarefa usa a página', async () => {
    const first = runner().verificar(['resumo']);
    vi.resetModules();
    await import('../extension/src/lattes-runner.ts');
    // A leitura já pode ter acabado durante o import; trava uma leitura explicitamente.
    await first;
    let release!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    const pending = runner().verificar(['resumo']);
    await Promise.resolve();
    await Promise.resolve();
    await expect(runner().exportar()).rejects.toThrow('ocupado');
    release(new Response('<form name="RES"></form>'));
    await pending;
  });
});
