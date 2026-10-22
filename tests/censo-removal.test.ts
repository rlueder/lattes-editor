import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  current: '',
  failRead: false,
  rows: [1, 2, 3],
  progress: { removed: [] as string[], results: [], pendingRemovals: [] as string[] },
}));
vi.mock('../extension/src/censo-traffic.ts', () => ({
  censusTraffic: { signal: new AbortController().signal },
}));
vi.mock('../extension/src/censo-test-items.ts', () => ({
  load: () => state.progress,
  save: vi.fn(),
  setLive: vi.fn(),
  pause: async () => undefined,
  openFrame: async (path: string) => {
    state.current = path;
    return { remove: vi.fn() };
  },
  submit: async () => {
    const id = Number(new URL(state.current, 'https://sintetico.invalid/').searchParams.get('id'));
    state.rows = state.rows.filter((n) => n !== id);
    return ['sucesso'];
  },
}));

import { saveBase } from '../extension/src/censo-test-ledger.ts';
import { removeTestItems } from '../extension/src/censo-test-removal.ts';
import { listKey } from '../src/census/test-ledger.ts';
import { TEST_MARK } from '../src/census/test-plan.ts';

const lists = Array.from({ length: 20 }, (_, i) => `pkg_teste.lista${i}`);
const menu = lists.map((url) => `<a onclick="setarUrl('${url}')">Lista</a>`).join('');
beforeEach(() => {
  state.current = '';
  state.failRead = false;
  state.rows = [1, 2, 3];
  state.progress = { removed: [], results: [], pendingRemovals: [] };
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal('document', { documentElement: { outerHTML: menu } });
  saveBase(Object.fromEntries(lists.map((url) => [listKey(url), []])));
});
afterEach(() => vi.unstubAllGlobals());

const get = () =>
  vi.fn(async (path: string) => {
    if (path.startsWith(lists[0]!) && state.failRead && state.current)
      throw new Error('conferência indisponível');
    if (path.startsWith(lists[0]!))
      return {
        html: state.rows
          .map((n) => `<tr onclick="setarUrl('pkg_teste.form?id=${n}')"><td>Teste ${n}</td></tr>`)
          .join(''),
      };
    return { html: path.startsWith('pkg_teste.form') ? TEST_MARK : '' };
  });

it('confere apenas a lista afetada por item e faz duas leituras completas por lote', async () => {
  const read = get();
  const result = await removeTestItems('SINTETICO1', read, { delayMs: [0, 0] });
  expect(result).toMatchObject({ removidos: 3, registrados: 0, falhas: [] });
  expect(state.progress.pendingRemovals).toEqual([]);
  expect(read.mock.calls.filter(([path]) => path.startsWith(lists[0]!))).toHaveLength(5);
  for (const list of lists.slice(1))
    expect(read.mock.calls.filter(([path]) => path.split('?')[0] === list)).toHaveLength(2);
  expect(read).toHaveBeenCalledTimes(47);
});

it('mantém a exclusão incerta quando a releitura da lista afetada falha', async () => {
  state.failRead = true;
  await expect(removeTestItems('SINTETICO1', get())).rejects.toThrow('conferência indisponível');
  expect(state.progress.pendingRemovals).toEqual(['pkg_teste.form?id=1']);
  expect(state.rows).toEqual([2, 3]);
  expect(state.progress.removed).toEqual([]);
});
