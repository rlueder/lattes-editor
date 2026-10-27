import { expect, it } from 'vitest';

import { framePost, localFrameReferences } from '../extension/src/censo-frame-protocol.ts';

const base = 'https://sintetico.invalid/cvlattesweb/pkg_teste.form';
it('aceita apenas um POST de campos de texto para a origem atual', () => {
  const result = framePost(
    {
      action: 'pkg_teste.salvar',
      method: 'POST',
      pairs: [
        ['nome', 'ação'],
        ['nome', 'outra'],
      ],
    },
    base,
  );
  expect(result.url.href).toBe('https://sintetico.invalid/cvlattesweb/pkg_teste.salvar');
  expect(result.pairs).toEqual([
    ['nome', 'ação'],
    ['nome', 'outra'],
  ]);
});
it.each([
  null,
  {},
  { method: 'GET', action: 'pkg_teste.salvar', pairs: [] },
  { method: 'POST', action: 'https://outro.invalid/', pairs: [] },
  { method: 'POST', action: 'https://usuario@sintetico.invalid/', pairs: [] },
  { method: 'POST', action: 'javascript:alert(1)', pairs: [] },
  { method: 'POST', action: '', pairs: [['nome', {}]] },
  { method: 'POST', action: '', pairs: [['nome']] },
  { method: 'POST', action: '', pairs: Array.from({ length: 10_001 }, () => ['a', 'b']) },
  { method: 'POST', action: '', pairs: [['nome', 'x'.repeat(2 * 1024 * 1024)]] },
])('recusa mensagem inválida ou destino externo (%#)', (message) => {
  expect(() => framePost(message, base)).toThrow();
});
it('todo acesso ao pai vai às cópias locais, sem referência ao menu real', () => {
  expect(
    localFrameReferences(
      "self.parent.caixaMsg.exibir({}); top.modalCV2.getDocument(); window.parent.autorDP; parent.fetch('/x'); parent.document.body;",
    ),
  ).toBe(
    "__lattesFrameParent.caixaMsg.exibir({}); __lattesFrameParent.modalCV2.getDocument(); __lattesFrameParent.autorDP; __lattesFrameParent.fetch('/x'); __lattesFrameParent.document.body;",
  );
  // A ajuda que quase todo formulário chama na carga e os vetores das sugestões.
  expect(
    localFrameReferences(
      'self.parent.veriHelp("LIVROS"); self.parent.palavraDP; parent.areaDP; top.setorDP; self.parent.titularInstDP; self.parent.parent.modalCV3;',
    ),
  ).toBe(
    '__lattesFrameParent.veriHelp("LIVROS"); __lattesFrameParent.palavraDP; __lattesFrameParent.areaDP; __lattesFrameParent.setorDP; __lattesFrameParent.titularInstDP; __lattesFrameParent.__lattesFrameParent.modalCV3;',
  );
});
