import { describe, expect, it } from 'vitest';

import {
  diffSnapshots,
  listKey,
  listUrls,
  nestedUrls,
  removalOrder,
  rowsOf,
} from '../src/census/test-ledger.ts';

const row = (link: string, ...cells: string[]) =>
  `<tr class="even" onclick="self.parent.modalCV2.setarUrl('${link}',true);">${cells
    .map((c) => `<td>${c}</td>`)
    .join('')}</tr>`;

describe('itens de teste: base e registro (Fase 0)', () => {
  it('acha toda lista do menu, também a que vem dentro de &quot;, sem as ações', () => {
    const menu = `
      <a onclick="setarUrl('pkg_premio.lista?f_cod=K1')">Prêmios</a>
      <div data-x="setarUrl(&quot;pkg_demais.lista?f_cod=K1&quot;)"></div>
      <a onclick="setarUrl('prc_bib_demais_lista?f_cod_tipo=1Z&amp;f_cod=K1')">Outra</a>
      <a onclick="setarUrl('pkg_premio.lista?f_cod=K1')">de novo</a>
      <a onclick="setarUrl('pkg_ativ.lista?f_cod=K1&amp;f_ctr=E2')">ação</a>`;
    expect(listUrls(menu).map(listKey)).toEqual([
      'pkg_premio.lista?',
      'pkg_demais.lista?',
      'prc_bib_demais_lista?f_cod_tipo=1Z',
    ]);
  });

  it('a chave da lista ignora o código do currículo e a ordem dos parâmetros', () => {
    expect(listKey('PKG_X.lista?f_cod=K1&b=2&a=1')).toBe(listKey('pkg_x.lista?a=1&b=2&f_cod=K9'));
  });

  it('lê as linhas sem o número da posição, com o link da edição', () => {
    const html = `<table>${row('pkg_formacao.form?f_cod=K1&amp;f_seq=3', '2', '2007... 2007', 'Ensino Médio (2o grau)', 'Unisinos')}</table>`;
    expect(rowsOf(html)).toEqual([
      {
        link: 'pkg_formacao.form?f_cod=K1&f_seq=3',
        text: '2007... 2007 Ensino Médio (2o grau) Unisinos',
      },
    ]);
  });

  it('acha as listas de dentro (atuação, periódico do revisor), sem as ações', () => {
    const html = `${row('PKG_ATIV.cargos_vinculos?f_cod=K1&amp;f_seq_ativ=6', 'A')}
      ${row('PKG_REVISOR.lista_periodico?f_cod=K1&amp;f_natur=MB', 'B')}
      ${row('pkg_ativ.form?f_seq_ativ=5&amp;f_ctr=E2', 'C')}`;
    expect(nestedUrls(html)).toEqual([
      'PKG_ATIV.cargos_vinculos?f_cod=K1&f_seq_ativ=6',
      'PKG_REVISOR.lista_periodico?f_cod=K1&f_natur=MB',
    ]);
  });

  it('o que apareceu e o que sumiu, contando linhas repetidas', () => {
    const base = {
      'a?': [
        { link: 'x1', text: 'Mestrado PUCRS' },
        { link: 'x2', text: 'Graduação UFPel' },
      ],
    };
    const now = {
      'a?': [
        { link: 'y1', text: 'Graduação UFPel' },
        { link: 'y2', text: 'Ensino Médio Unisinos' },
        { link: 'y3', text: 'Ensino Médio Unisinos' },
      ],
      'b?': [{ link: 'z', text: 'Pós-doutorado' }],
    };
    const { added, missing } = diffSnapshots(base, now);
    expect(added.map((r) => `${r.list} ${r.text}`)).toEqual([
      'a? Ensino Médio Unisinos',
      'a? Ensino Médio Unisinos',
      'b? Pós-doutorado',
    ]);
    // Uma linha da base que sumiu é o que não podia acontecer: aparece à parte.
    expect(missing.map((r) => r.text)).toEqual(['Mestrado PUCRS']);
  });

  it('remove o que está dentro de uma atuação antes da atuação', () => {
    const rows = [
      { link: 'a', list: 'pkg_ativ.lista?', text: 'Atuação de teste' },
      { link: 'b', list: 'pkg_ativ.cargos_vinculos?f_seq_ativ=22', text: 'Vínculo de teste' },
    ];
    expect(removalOrder(rows).map((r) => r.link)).toEqual(['b', 'a']);
  });
});
