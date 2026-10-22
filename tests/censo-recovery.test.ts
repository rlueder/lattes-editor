import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { signal } = new AbortController();
vi.mock('../extension/src/censo-traffic.ts', () => ({
  censusTraffic: {
    signal,
    sendResults: async () => {
      throw new Error('receptor indisponível');
    },
    wait: async () => undefined,
  },
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

it('mostra tags e links pendentes e impede apagar o registro incerto', async () => {
  const { testProgress, resetTestItems } = await import('../extension/src/censo-test-items.ts');
  const record = JSON.parse(value!);
  record.pendingRemovals = ['pkg_a.form?f_seq=7'];
  value = JSON.stringify(record);
  expect(testProgress()).toMatchObject({
    incertos: ['teste001'],
    exclusoesIncertas: ['pkg_a.form?f_seq=7'],
  });
  expect(() => resetTestItems()).toThrow('reconcilie');
  expect(JSON.parse(value!).pendingRemovals).toHaveLength(1);
});

it('só apaga um registro corrompido com força explícita e mantém a proteção de incerteza conhecida', async () => {
  const { resetTestItems } = await import('../extension/src/censo-test-items.ts');
  expect(() => resetTestItems({ force: true })).toThrow('reconcilie');
  value = '{json inválido';
  vi.stubGlobal('localStorage', {
    getItem: () => value,
    removeItem: () => {
      value = null;
    },
  });
  expect(() => resetTestItems()).toThrow('force: true');
  resetTestItems({ force: true });
  expect(value).toBeNull();
});
it('falha no receptor opcional preserva a conferência e retorna aviso separado', async () => {
  const { createTestItems } = await import('../extension/src/censo-test-items.ts');
  value = JSON.stringify({ results: [], removed: [] });
  const result = await createTestItems([], 'SINTETICO1', async () => ({ html: marker }), {
    receiver: 'http://localhost:1234/resultados',
  });
  expect(result).toMatchObject({
    lote: [],
    receptorError: expect.stringContaining('receptor local'),
  });
  expect(JSON.parse(value!)).toMatchObject({ added: [], missing: [] });
});
