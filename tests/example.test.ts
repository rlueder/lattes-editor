import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkingCopy } from '../src/model/store.ts';

const loadWorkingCopy = vi.fn<() => Promise<WorkingCopy | undefined>>();
const replaceWorkingCopy = vi.fn<(copy: WorkingCopy) => Promise<void>>();
vi.mock('../src/model/store.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/model/store.ts')>()),
  loadWorkingCopy,
  replaceWorkingCopy,
}));

const { EXAMPLE_URL, openExampleIfAsked } = await import('../src/dev/example.ts');
const { examplePhotoUrl } = await import('../src/ui/profile.ts');

const fixture = readFileSync(new URL('../fixtures/synthetic_full.xml', import.meta.url));

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
