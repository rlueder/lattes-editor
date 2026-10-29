// O pedido de leitura que chega à aba do Lattes (lattes-runner.ts, lerLattes):
// só a forma de um RefreshRequest passa, e só caminhos relativos do Lattes
// viram GET (isSafeGet), nunca um endereço de outro site.

import { describe, expect, it } from 'vitest';

import { isRefreshRequest } from '../src/bridge/refresh/read.ts';
import { isSafeGet } from '../src/census/run.ts';

describe('o pedido de leitura na aba do Lattes', () => {
  it('passa só com o passo conhecido e as listas com textos', () => {
    expect(isRefreshRequest({ step: 'menu' })).toBe(true);
    expect(isRefreshRequest({ step: 'listas' })).toBe(true);
    expect(isRefreshRequest({ queue: ['pkg_x.lista'], step: 'listas' })).toBe(true);
    expect(
      isRefreshRequest({
        reads: [{ forms: ['F'], link: 'pkg_x.form?f_seq=1' }],
        step: 'formularios',
      }),
    ).toBe(true);
    expect(
      isRefreshRequest({
        paths: ['pkg_x.lista', { body: 'f_ctr=', path: 'PKG_FORMACAO_COMPL.FORM2' }],
        step: 'paginas',
      }),
    ).toBe(true);
    for (const bad of [
      null,
      'menu',
      {},
      { step: 'gravar' },
      { queue: [1], step: 'listas' },
      { reads: [{ link: 'x' }], step: 'formularios' },
      { paths: [{ path: 'x' }], step: 'paginas' },
      { paths: 'x', step: 'paginas' },
    ]) {
      expect(isRefreshRequest(bad)).toBe(false);
    }
  });

  it('GET só em caminho relativo do Lattes', () => {
    expect(isSafeGet('pkg_licenca.lista?f_cod=K1')).toBe(true);
    expect(isSafeGet('/cvlattesweb/pkg_licenca.lista?f_cod=K1')).toBe(true);
    expect(isSafeGet('https://exemplo.com/pkg_licenca.lista')).toBe(false);
    expect(isSafeGet('//exemplo.com/x')).toBe(false);
    expect(isSafeGet('../outro/pkg_x.lista')).toBe(false);
  });
});
