import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { signal } = new AbortController();
vi.mock('../extension/src/censo-traffic.ts', () => ({
  censusTraffic: { signal, wait: async () => undefined },
}));
vi.mock('../extension/src/censo-test-donors.ts', () => ({
  context: {},
  ensureContext: async () => undefined,
  projectFields: async () => undefined,
}));
vi.mock('../extension/src/censo-test-ledger.ts', () => ({
  loadBase: () => ({ at: 'hoje' }),
  ledgerNow: async () => ({ added: [], missing: [] }),
  clearBase: () => undefined,
}));
let value: string | null;
const marker = 'Este arquivo não foi gerado a partir do Currículo Lattes validado';
beforeEach(() => {
  value = JSON.stringify({
    removed: [],
    results: [
      {
        id: 'artigo',
        tag: 'teste001',
        variant: 0,
        ok: false,
        uncertain: true,
        msgs: ['incerto'],
        values: {},
      },
    ],
  });
  vi.stubGlobal('localStorage', {
    getItem: () => value,
    setItem: (_key: string, v: string) => {
      value = v;
    },
  });
  vi.stubGlobal('document', { documentElement: { outerHTML: 'menu' } });
});
afterEach(() => vi.unstubAllGlobals());
it('não inicia outro lote enquanto um envio anterior estiver incerto', async () => {
  const { createTestItems } = await import('../extension/src/censo-test-items.ts');
  const get = vi.fn(async () => ({ html: marker }));
  await expect(createTestItems([], 'SINTETICO1', get)).rejects.toThrow('incertos');
  expect(get).not.toHaveBeenCalled();
});
it('retryFailed não libera um envio incerto sem conferência humana e leitura atual', async () => {
  const { createTestItems } = await import('../extension/src/censo-test-items.ts');
  const get = vi.fn(async () => ({ html: marker }));
  await expect(createTestItems([], 'SINTETICO1', get, { retryFailed: true })).rejects.toThrow(
    'incertos',
  );
  await createTestItems([], 'SINTETICO1', get, {
    retryFailed: true,
    confirmedAbsent: ['teste001'],
  });
  expect(JSON.parse(value!).results[0].uncertain).toBe(false);
});
it('a confirmação de ausência não repete um item que já aparece no Lattes', async () => {
  const { createTestItems } = await import('../extension/src/censo-test-items.ts');
  const get = vi.fn(async () => ({ html: `${marker} teste001` }));
  await expect(
    createTestItems([], 'SINTETICO1', get, { retryFailed: true, confirmedAbsent: ['teste001'] }),
  ).rejects.toThrow('já aparece');
  await createTestItems([], 'SINTETICO1', get, {
    retryFailed: true,
    confirmedPresent: ['teste001'],
  });
  expect(JSON.parse(value!).results[0]).toMatchObject({ uncertain: false, ok: true });
});
it('recusa reconciliação com HTML de erro e não perde o registro em falha de armazenamento', async () => {
  const { createTestItems, save } = await import('../extension/src/censo-test-items.ts');
  await expect(
    createTestItems([], 'SINTETICO1', async () => ({ html: 'erro' }), {
      retryFailed: true,
      confirmedAbsent: ['teste001'],
    }),
  ).rejects.toThrow('conferir');
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw Error('quota');
    },
  });
  expect(() => save({ removed: [], results: [] })).toThrow('salvo');
});
