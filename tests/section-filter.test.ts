import { describe, expect, it } from 'vitest';

import {
  afterHashChange,
  clearFilter,
  initialFilterFor,
  NO_REQUEST,
  requestFilter,
} from '../src/ui/section-filter.ts';

const artigos = {
  query: '',
  selected: { tipo: 'ARTIGO-PUBLICADO' },
  years: { from: 2021, to: 2024 },
};

describe('filtro com que a seção abre depois do Panorama', () => {
  it('vale só para a seção do clique', () => {
    const req = requestFilter(NO_REQUEST, 'producoes', artigos);
    expect(req.key).toBe(1);
    expect(initialFilterFor(req, 'producoes')).toBe(artigos);
    expect(initialFilterFor(req, 'orientacoes')).toBeUndefined();
    expect(initialFilterFor(req, undefined)).toBeUndefined();
  });

  it('acaba ao voltar ou avançar para outra seção ou para o Panorama', () => {
    const req = requestFilter(NO_REQUEST, 'producoes', artigos);
    // Voltar duas vezes: Panorama, depois Orientações. Nada do filtro sobra.
    const back = afterHashChange(req, 'panorama');
    expect(initialFilterFor(back, 'producoes')).toBeUndefined();
    expect(initialFilterFor(afterHashChange(back, 'orientacoes'), 'orientacoes')).toBeUndefined();
    // Um hash da própria seção (um grupo dela) mantém o filtro.
    expect(afterHashChange(req, 'producoes')).toBe(req);
    expect(afterHashChange(NO_REQUEST, 'bancas')).toBe(NO_REQUEST);
  });

  it('some na navegação pelo menu ou pelo ⌘K, com a seção remontada', () => {
    const req = requestFilter(NO_REQUEST, 'producoes', artigos);
    const cleared = clearFilter(req);
    expect(cleared).toEqual({ key: 2 });
    expect(initialFilterFor(cleared, 'producoes')).toBeUndefined();
  });
});
