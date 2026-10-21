import { describe, expect, it } from 'vitest';

import {
  diffSnapshots,
  listKey,
  listUrls,
  markedBatch,
  nestedUrls,
  removalOrder,
  rowLabel,
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

  describe('o lote da remoção pela marca na página', () => {
    const MARK = 'TESTE EDITOR APAGAR';
    const rows = [
      { link: 'teste-1', list: 'pkg_demais.lista?', text: 'Item de teste' },
      { link: 'seu', list: 'pkg_demais.lista?', text: 'Item incluído depois da base' },
      { link: 'teste-2', list: 'pkg_demais.lista?', text: 'Outro item de teste' },
    ];
    const pages: Record<string, string> = {
      seu: '<input value="Um item de verdade">',
      'teste-1': `<input value="${MARK} demais-v0">`,
      'teste-2': `<input value="${MARK} demais-v1">`,
    };
    const html = (link: string) => Promise.resolve(pages[link] ?? '');

    it('sem a marca na página a linha fica, e volta para conferir', async () => {
      const { noMark, plan } = await markedBatch(rows, html, { batch: 10, mark: MARK });
      expect(plan.map((r) => r.link)).toEqual(['teste-1', 'teste-2']);
      expect(noMark.map((r) => r.link)).toEqual(['seu']);
    });

    it('a sem marca só sai se a pessoa a conferiu, e aí não volta como sem marca', async () => {
      const allowed = [rows[1]!.link];
      const r = await markedBatch(rows, html, { allowed, batch: 10, mark: MARK });
      expect(r.plan.map((x) => x.link)).toEqual(['teste-1', 'seu', 'teste-2']);
      expect(r.noMark).toEqual([]);
      const other = await markedBatch(rows, html, {
        allowed: ['outro-link'],
        batch: 10,
        mark: MARK,
      });
      expect(other.plan.map((x) => x.link)).toEqual(['teste-1', 'teste-2']);
    });

    it('o lote para no tamanho pedido, e espera entre uma leitura e outra', async () => {
      let waits = 0;
      const between = async () => void waits++;
      const one = await markedBatch(rows, html, { batch: 1, between, mark: MARK });
      expect(one.plan.map((r) => r.link)).toEqual(['teste-1']);
      expect(one.noMark).toEqual([]);
      expect(waits).toBe(0);
      await markedBatch(rows, html, { batch: 10, between, mark: MARK });
      expect(waits).toBe(2);
    });

    it('a página que não se lê fica à parte, não sai nem conferida, e o resto segue', async () => {
      const failing = (link: string) =>
        link === 'seu' ? Promise.reject(new Error('sessão caiu')) : html(link);
      const r = await markedBatch(rows, failing, { allowed: ['seu'], batch: 10, mark: MARK });
      expect(r.plan.map((x) => x.link)).toEqual(['teste-1', 'teste-2']);
      expect(r.noMark).toEqual([]);
      expect(r.unreadable.map((x) => x.link)).toEqual(['seu']);
    });

    it('duas linhas iguais na tela: a conferência vale só para o link conferido', async () => {
      const twins = [
        { link: 'seu-a', list: 'pkg_demais.lista?', text: 'Mesmo texto' },
        { link: 'seu-b', list: 'pkg_demais.lista?', text: 'Mesmo texto' },
      ];
      expect(rowLabel(twins[0]!)).toBe(rowLabel(twins[1]!));
      const r = await markedBatch(twins, () => Promise.resolve(''), {
        allowed: ['seu-a'],
        batch: 10,
        mark: MARK,
      });
      expect(r.plan.map((x) => x.link)).toEqual(['seu-a']);
      expect(r.noMark.map((x) => x.link)).toEqual(['seu-b']);
    });

    it('conta as páginas lidas', async () => {
      const seen: number[] = [];
      await markedBatch(rows, html, { batch: 10, mark: MARK, onRead: (n) => seen.push(n) });
      expect(seen).toEqual([1, 2, 3]);
    });
  });
});
