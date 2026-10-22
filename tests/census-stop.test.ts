import { expect, it, vi } from 'vitest';

import { inspectPages } from '../src/census/inspect.ts';
import { CensusStopped } from '../src/census/stop.ts';
it('o freio encerra a coleta sem repetir nem abrir o formulário seguinte', async () => {
  const get = vi.fn(async () => {
    throw new CensusStopped('HTTP 429');
  });
  const file = await inspectPages(
    { get, menuHtml: async () => '' },
    'SINTETICO1',
    ['pkg_a.form', 'pkg_b.form'],
    { delayMs: 0 },
  );
  expect(file.interrupted).toBe(true);
  expect(get).toHaveBeenCalledTimes(1);
  expect(file.entries.map((e) => e.status)).toEqual(['nao-lido', 'nao-lido']);
});
