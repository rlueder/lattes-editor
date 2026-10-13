import { afterEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn(() => Promise.resolve());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const { externalLinkOf, isExternalHref, openExternalLinksNatively } =
  await import('../src/desktop/external-links.ts');

const ORIGIN = 'http://tauri.localhost';

/** Um clique num elemento dentro de um link (ou fora de qualquer link). */
const click = (href?: string, extra: { button?: number; defaultPrevented?: boolean } = {}) => ({
  button: extra.button ?? 0,
  defaultPrevented: extra.defaultPrevented ?? false,
  target: { closest: () => (href === undefined ? null : { href }) } as unknown as EventTarget,
});

afterEach(() => {
  vi.unstubAllGlobals();
  invoke.mockClear();
});

describe('links externos no app de desktop', () => {
  it('sai do editor: outro site, e-mail, telefone', () => {
    expect(isExternalHref('https://github.com/rlueder/lattes-editor/releases/latest', ORIGIN)).toBe(
      true,
    );
    expect(isExternalHref('mailto:alguem@exemplo.org', ORIGIN)).toBe(true);
    expect(isExternalHref('tel:+555100000000', ORIGIN)).toBe(true);
  });

  it('fica no editor: âncora, mesma origem, esquema que o plugin não abre', () => {
    expect(isExternalHref('#formacao', ORIGIN)).toBe(false);
    expect(isExternalHref(`${ORIGIN}/outra`, ORIGIN)).toBe(false);
    expect(isExternalHref('javascript:void(0)', ORIGIN)).toBe(false);
    expect(isExternalHref('file:///etc/hosts', ORIGIN)).toBe(false);
    expect(isExternalHref('http://[', ORIGIN)).toBe(false);
  });

  it('só o clique principal num link para fora', () => {
    const url = 'https://lattes.cnpq.br/0000000000000001';
    expect(externalLinkOf(click(url), ORIGIN)).toBe(url);
    expect(externalLinkOf(click(url, { button: 1 }), ORIGIN)).toBeUndefined();
    expect(externalLinkOf(click(url, { defaultPrevented: true }), ORIGIN)).toBeUndefined();
    expect(externalLinkOf(click(), ORIGIN)).toBeUndefined();
    expect(externalLinkOf(click('#resumo'), ORIGIN)).toBeUndefined();
    expect(externalLinkOf({ button: 0, defaultPrevented: false, target: null }, ORIGIN)).toBe(
      undefined,
    );
  });

  it('abre pelo plugin opener e impede a janela de navegar', async () => {
    let handler: ((e: MouseEvent) => void) | undefined;
    const remove = vi.fn();
    vi.stubGlobal('location', { origin: ORIGIN });
    vi.stubGlobal('document', {
      addEventListener: (_: string, h: (e: MouseEvent) => void) => (handler = h),
      removeEventListener: remove,
    });
    const off = openExternalLinksNatively();

    const url = 'https://github.com/rlueder/lattes-editor/releases/latest';
    const preventDefault = vi.fn();
    handler!({ ...click(url), preventDefault } as unknown as MouseEvent);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('plugin:opener|open_url', { url }));
    expect(preventDefault).toHaveBeenCalled();

    const inside = vi.fn();
    handler!({ ...click('#formacao'), preventDefault: inside } as unknown as MouseEvent);
    expect(inside).not.toHaveBeenCalled();

    off();
    expect(remove).toHaveBeenCalledWith('click', handler);
  });

  it('falha do plugin vai para o console, sem quebrar o clique', async () => {
    let handler: ((e: MouseEvent) => void) | undefined;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    invoke.mockImplementationOnce(() => Promise.reject(new Error('sem permissão')));
    vi.stubGlobal('location', { origin: ORIGIN });
    vi.stubGlobal('document', {
      addEventListener: (_: string, h: (e: MouseEvent) => void) => (handler = h),
      removeEventListener: () => undefined,
    });
    openExternalLinksNatively();
    handler!({
      ...click('https://exemplo.org'),
      preventDefault: () => undefined,
    } as unknown as MouseEvent);
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith('Link externo não abriu:', expect.any(Error)),
    );
    error.mockRestore();
  });
});
