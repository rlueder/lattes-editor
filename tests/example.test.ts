import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SentEntry } from '../src/bridge/sent-log.ts';
import type { WorkingCopy } from '../src/model/store.ts';

const loadWorkingCopy = vi.fn<() => Promise<WorkingCopy | undefined>>();
const replaceWorkingCopy = vi.fn<(copy: WorkingCopy) => Promise<void>>();
const addSent = vi.fn<(entry: SentEntry) => Promise<number | undefined>>();
const listSent = vi.fn<(lattesId: string) => Promise<SentEntry[]>>();
vi.mock('../src/model/store.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/model/store.ts')>()),
  addSent,
  listSent,
  loadWorkingCopy,
  replaceWorkingCopy,
}));

const { DEMO_URL, EXAMPLE_URL, openExampleIfAsked } = await import('../src/dev/example.ts');
const { examplePhotoUrl } = await import('../src/ui/profile.ts');

const fixture = readFileSync(new URL('../fixtures/synthetic_full.xml', import.meta.url));
const demo = readFileSync(new URL('../fixtures/demo.xml', import.meta.url));

beforeEach(() => {
  listSent.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const serve = (status = 200) => {
  const fetch = vi.fn(() => Promise.resolve(new Response(fixture, { status })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('currículo de exemplo', () => {
  it('sem ?exemplo na URL, não faz nada', async () => {
    const fetch = serve();
    expect(await openExampleIfAsked('?outra=1')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(loadWorkingCopy).not.toHaveBeenCalled();
  });

  it('não substitui um currículo já aberto', async () => {
    const fetch = serve();
    loadWorkingCopy.mockResolvedValue({ fileName: 'CV_real.xml' } as WorkingCopy);
    expect(await openExampleIfAsked('?exemplo')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(replaceWorkingCopy).not.toHaveBeenCalled();
  });

  it('sem currículo aberto, carrega a fixture completa como cópia de trabalho', async () => {
    const fetch = serve();
    loadWorkingCopy.mockResolvedValue(undefined);
    expect(await openExampleIfAsked('?exemplo')).toBe(true);
    expect(fetch).toHaveBeenCalledWith(EXAMPLE_URL);
    const copy = replaceWorkingCopy.mock.calls[0]![0];
    expect(copy.id).toBe('current');
    expect(copy.xml).toBe(copy.originalXml);
    expect(copy.xml).toContain('<CURRICULO-VITAE');
    expect(copy.nextSequencia).toBe(copy.loadedMaxSequencia + 1);
    expect(copy.loadedMaxSequencia).toBeGreaterThan(0);
  });

  it('?exemplo=demo carrega o currículo de demonstração, sem envios fictícios', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(demo, { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    loadWorkingCopy.mockResolvedValue(undefined);
    expect(await openExampleIfAsked('?exemplo=demo')).toBe(true);
    expect(fetch).toHaveBeenCalledWith(DEMO_URL);
    const copy = replaceWorkingCopy.mock.calls[0]![0];
    expect(copy.xml).toContain('NOME-COMPLETO="Ana Beatriz Souza Lima"');
    expect(copy.xml).not.toContain('Valor de teste');
    // Os envios fictícios são do currículo sintético, não da demonstração.
    expect(addSent).not.toHaveBeenCalled();
  });

  it('preenche o registro do enviado só no currículo de exemplo e só se estiver vazio', async () => {
    serve();
    loadWorkingCopy.mockResolvedValue(undefined);
    listSent.mockResolvedValue([]);
    addSent.mockResolvedValue(7);
    await openExampleIfAsked('?exemplo');
    const seeded = addSent.mock.calls.map(([e]) => e);
    expect(seeded).toHaveLength(4);
    expect(seeded.every((e) => e.lattesId === '0000000000000001')).toBe(true);
    expect(seeded.at(-1)).toMatchObject({ undoOf: 7 });

    vi.clearAllMocks();
    listSent.mockResolvedValue([seeded[0]!]);
    loadWorkingCopy.mockResolvedValue({ xml: fixture.toString('latin1') } as WorkingCopy);
    await openExampleIfAsked('?exemplo');
    expect(addSent).not.toHaveBeenCalled();

    loadWorkingCopy.mockResolvedValue({
      xml: '<CURRICULO-VITAE NUMERO-IDENTIFICADOR="8895603755739711"/>',
    } as WorkingCopy);
    listSent.mockResolvedValue([]);
    await openExampleIfAsked('?exemplo');
    expect(addSent).not.toHaveBeenCalled();
  });

  it('avisa quando o servidor não entrega a fixture', async () => {
    serve(404);
    loadWorkingCopy.mockResolvedValue(undefined);
    await expect(openExampleIfAsked('?exemplo')).rejects.toThrow('respondeu 404');
    expect(replaceWorkingCopy).not.toHaveBeenCalled();
  });

  it('foto de mentira só para o currículo sintético, e só no dev', () => {
    expect(examplePhotoUrl('0000000000000001')).toBe('https://i.pravatar.cc/300?img=32');
    expect(examplePhotoUrl('1234567890123456')).toBeUndefined();
    expect(examplePhotoUrl(undefined)).toBeUndefined();
    vi.stubEnv('DEV', false);
    expect(examplePhotoUrl('0000000000000001')).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
