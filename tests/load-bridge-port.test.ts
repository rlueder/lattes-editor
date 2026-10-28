// A porta de "Carregar do Lattes" sobre a ponte (src/bridge/load/bridge-port.ts)
// e os passos 'menu' e 'paginas' da leitura na aba (refresh/read.ts).

import { describe, expect, it } from 'vitest';

import { bridgeLoadPort } from '../src/bridge/load/bridge-port.ts';
import { loadCvFromLattes } from '../src/bridge/load/loader.ts';
import { readPages } from '../src/bridge/load/pages.ts';
import { readRefreshPart, type RefreshRequest } from '../src/bridge/refresh/read.ts';

const port = { get: async (path: string) => `<p>${path}</p>`, readForm: () => undefined };

describe('a aba lê o menu e páginas para "Carregar do Lattes"', () => {
  it('devolve o menu como está', async () => {
    expect(await readRefreshPart(port, '<html>menu</html>', 'K1', { step: 'menu' })).toEqual({
      html: '<html>menu</html>',
      step: 'menu',
    });
  });

  it('busca as páginas pedidas e recusa endereço que grava', async () => {
    const part = await readRefreshPart(port, '', 'K1', {
      paths: ['pkg_idioma.lista?f_cod=K1', 'pkg_idioma.form?f_ctr=E&f_seq=1'],
      step: 'paginas',
    });
    expect(part).toMatchObject({
      pages: [
        { html: '<p>pkg_idioma.lista?f_cod=K1</p>', path: 'pkg_idioma.lista?f_cod=K1' },
        { error: 'inseguro', path: 'pkg_idioma.form?f_ctr=E&f_seq=1' },
      ],
      rest: [],
      step: 'paginas',
    });
  });
});

describe('bridgeLoadPort', () => {
  it('pede o menu e as páginas pela ponte', async () => {
    const asked: RefreshRequest[] = [];
    const p = bridgeLoadPort(async (request) => {
      asked.push(request);
      return request.step === 'menu'
        ? { part: { html: 'menu', step: 'menu' } }
        : { part: { pages: [], rest: [], step: 'paginas' } };
    });
    expect(await p.menu()).toBe('menu');
    expect(await p.pages(['a'])).toEqual({ pages: [], rest: [], step: 'paginas' });
    expect(asked).toEqual([{ step: 'menu' }, { paths: ['a'], step: 'paginas' }]);
  });

  it('sem resposta da aba, a leitura para com o motivo', async () => {
    const p = bridgeLoadPort(async () => ({ reason: 'sem-aba' }));
    expect(await p.pages(['a', 'b'])).toEqual({
      error: 'A aba do Lattes não respondeu.',
      pages: [],
      reason: 'erro',
      rest: ['a', 'b'],
    });
    expect(await loadCvFromLattes(p)).toEqual({
      gaps: [],
      pages: 0,
      stopped: { error: 'A aba do Lattes não mandou o menu.', reason: 'erro' },
    });
  });
});

describe('readPages em paralelo', () => {
  it('devolve na ordem pedida, e o que faltou quando a aba falha', async () => {
    const delays: Record<string, number> = {
      'pkg_a.lista': 30,
      'pkg_b.lista': 5,
      'pkg_c.lista': 15,
    };
    const get = async (path: string) => {
      await new Promise((r) => setTimeout(r, delays[path] ?? 1));
      if (path === 'pkg_d.lista') throw new Error('caiu');
      return `<p>${path}</p>`;
    };
    const ok = await readPages(get, ['pkg_a.lista', 'pkg_b.lista', 'pkg_c.lista'], 3);
    expect(ok.pages.map((p) => p.path)).toEqual(['pkg_a.lista', 'pkg_b.lista', 'pkg_c.lista']);
    const failed = await readPages(get, ['pkg_a.lista', 'pkg_d.lista', 'pkg_e.lista'], 2);
    expect(failed.reason).toBe('erro');
    expect(failed.rest).toContain('pkg_d.lista');
    expect(failed.pages.every((p) => p.path !== 'pkg_d.lista')).toBe(true);
  });
});
