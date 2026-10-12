import { afterEach, describe, expect, it, vi } from 'vitest';

const open = vi.fn();
const save = vi.fn();
const invoke = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({ open, save }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const { baseName, isDesktop, pickFileNative, saveBytes } = await import('../src/desktop/native.ts');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const inDesktop = () => vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });

describe('app de desktop', () => {
  it('reconhece o app pelo objeto interno do Tauri', () => {
    expect(isDesktop()).toBe(false);
    inDesktop();
    expect(isDesktop()).toBe(true);
  });

  it('tira o nome do arquivo do caminho, com / ou \\\\', () => {
    expect(baseName('/Users/x/CV_1.zip')).toBe('CV_1.zip');
    expect(baseName('C:\\\\Users\\\\x\\\\CV_1.xml')).toBe('CV_1.xml');
  });

  it('abre pelo diálogo nativo e lê os bytes sem mexer neles', async () => {
    open.mockResolvedValue('/tmp/CV_1.xml');
    invoke.mockResolvedValue([60, 233, 62]);
    const file = await pickFileNative();
    expect(file?.name).toBe('CV_1.xml');
    expect([...new Uint8Array(await file!.arrayBuffer())]).toEqual([60, 233, 62]);
    expect(invoke).toHaveBeenCalledWith('read_file', { path: '/tmp/CV_1.xml' });
  });

  it('não abre nada quando a pessoa cancela', async () => {
    open.mockResolvedValue(null);
    expect(await pickFileNative()).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('no desktop, salva pelo diálogo nativo com os bytes exatos', async () => {
    inDesktop();
    save.mockResolvedValue('/tmp/out.xml');
    expect(await saveBytes(new Uint8Array([1, 233]), 'out.xml')).toBe(true);
    expect(save).toHaveBeenCalledWith({
      defaultPath: 'out.xml',
      filters: [{ extensions: ['xml'], name: 'XML' }],
    });
    expect(invoke).toHaveBeenCalledWith('write_file', { bytes: [1, 233], path: '/tmp/out.xml' });
    save.mockResolvedValue(null);
    expect(await saveBytes(new Uint8Array([1]), 'semextensao')).toBe(false);
  });

  it('no navegador, baixa o arquivo como antes', async () => {
    const click = vi.fn();
    const a = { click, download: '', href: '' };
    vi.stubGlobal('document', { createElement: () => a });
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    expect(await saveBytes(new Uint8Array([1]), 'CV.xml')).toBe(true);
    expect(a.download).toBe('CV.xml');
    expect(click).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
