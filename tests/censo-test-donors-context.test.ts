// O contexto dos itens de teste (extension/src/censo-test-donors.ts): uma
// captura nova o invalida, para um lote inteiro não usar o de alguns tipos.

import { describe, expect, it, vi } from 'vitest';

import { ensureContext, forgetContext } from '../extension/src/censo-test-donors.ts';

const get = async () => ({ html: '' });
// O menu da aba, vazio: sem listas, a leitura não acha doadores.
vi.stubGlobal('document', { documentElement: { outerHTML: '' } });

describe('contexto dos itens de teste', () => {
  it('o lote sem want reaproveita o lido; depois de forgetContext, lê de novo', async () => {
    forgetContext();
    const want = { packages: new Set(['producao']) } as unknown as Parameters<
      typeof ensureContext
    >[2];
    expect(await ensureContext('CV', get, want)).toBe(true);
    // O lote da mesma captura usa o contexto lido.
    expect(await ensureContext('CV', get)).toBe(false);
    // Uma captura nova (inteira) não aproveita o de alguns tipos.
    forgetContext();
    expect(await ensureContext('CV', get)).toBe(true);
    expect(await ensureContext('CV', get)).toBe(false);
  });
});
