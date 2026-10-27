import { describe, expect, it } from 'vitest';

import { cvListQueue, readListsPart, snapshotCvLists } from '../src/bridge/cv-lists.ts';

const row = (link: string, text: string) =>
  `<tr onclick="self.parent.modalCV2.setarUrl('${link}',true);"><td>${text}</td></tr>`;

describe('listas do currículo no Lattes, só por GET', () => {
  it('lê as listas do menu e as de dentro delas, com o código do currículo, e pula a que não abre', async () => {
    const menu = `<a onclick="setarUrl('pkg_ativ.lista')">Atuação</a>
      <a onclick="setarUrl('pkg_premio.lista?f_cod=K1')">Prêmios</a>
      <a onclick="setarUrl('pkg_sumiu.lista')">Some</a>
      <a onclick="setarUrl('pkg_ativ.lista?f_ctr=E2')">ação</a>`;
    const pages: Record<string, string> = {
      'PKG_ATIV.cargos_vinculos?f_seq_ativ=24&f_cod=K1': row('x', '01/2011 12/2012 Designer'),
      'pkg_ativ.lista?f_cod=K1': row(
        'PKG_ATIV.cargos_vinculos?f_seq_ativ=24',
        'Empresa Exemplo De 2011 até 2012',
      ),
      'pkg_premio.lista?f_cod=K1': row('pkg_premio.form?f_seq=1', 'Prêmio 2015'),
      'pkg_sumiu.lista?f_cod=K1': '<h1>404 Not Found</h1>',
    };
    const asked: string[] = [];
    const lists = await snapshotCvLists(menu, 'K1', async (path) => {
      asked.push(path);
      return pages[path] ?? '';
    });
    expect(asked.some((p) => /f_ctr/i.test(p))).toBe(false);
    expect(asked.every((p) => p.includes('f_cod=K1'))).toBe(true);
    expect(Object.keys(lists).sort()).toEqual([
      'pkg_ativ.cargos_vinculos?f_seq_ativ=24',
      'pkg_ativ.lista?',
      'pkg_premio.lista?',
    ]);
    expect(lists['pkg_ativ.cargos_vinculos?f_seq_ativ=24']?.[0]?.text).toBe(
      '01/2011 12/2012 Designer',
    );
  });

  it('em partes: lê até o máximo, devolve a fila, e a que falha fica como não lida', async () => {
    const menu = `<a onclick="setarUrl('pkg_premio.lista')">P</a>
      <a onclick="setarUrl('pkg_idioma.lista')">I</a>
      <a onclick="setarUrl('pkg_texto.lista')">T</a>`;
    const get = async (path: string) => {
      if (path.startsWith('pkg_premio')) throw new Error('rede');
      return row('x', 'Linha');
    };
    const first = await readListsPart(cvListQueue(menu), 'K1', get, { max: 2, skipFailed: true });
    expect(first).toMatchObject({
      lists: { 'pkg_idioma.lista?': [{ text: 'Linha' }] },
      queue: ['pkg_texto.lista'],
      unread: ['pkg_premio.lista?'],
    });
    const rest = await readListsPart(first.queue, 'K1', get, { max: 2, skipFailed: true });
    expect(rest).toMatchObject({ lists: { 'pkg_texto.lista?': [{ text: 'Linha' }] }, queue: [] });
  });

  it('com filtro, só as listas pedidas e as de dentro delas', async () => {
    const menu = `<a onclick="setarUrl('pkg_ativ.lista')">A</a>
      <a onclick="setarUrl('pkg_premio.lista')">P</a>`;
    const asked: string[] = [];
    const lists = await snapshotCvLists(
      menu,
      'K1',
      async (path) => {
        asked.push(path);
        return path.startsWith('pkg_ativ.lista')
          ? row('PKG_ATIV.cargos_vinculos?f_seq_ativ=24', 'Empresa')
          : row('x', 'Linha');
      },
      (url) => url.startsWith('pkg_ativ'),
    );
    expect(asked.some((p) => p.startsWith('pkg_premio'))).toBe(false);
    expect(Object.keys(lists).sort()).toEqual([
      'pkg_ativ.cargos_vinculos?f_seq_ativ=24',
      'pkg_ativ.lista?',
    ]);
  });

  it('de uma vez, um erro de leitura sobe: a base dos itens de teste não grava lista faltando', async () => {
    const menu = `<a onclick="setarUrl('pkg_premio.lista')">P</a>`;
    await expect(
      snapshotCvLists(menu, 'K1', async () => {
        throw new Error('rede');
      }),
    ).rejects.toThrow('rede');
  });
});
