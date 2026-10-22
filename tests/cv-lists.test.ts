import { describe, expect, it } from 'vitest';

import { snapshotCvLists } from '../src/bridge/cv-lists.ts';

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

  it('uma lista que falha fica de fora sem levar as outras', async () => {
    const menu = `<a onclick="setarUrl('pkg_premio.lista')">P</a>
      <a onclick="setarUrl('pkg_idioma.lista')">I</a>`;
    const lists = await snapshotCvLists(menu, 'K1', async (path) => {
      if (path.startsWith('pkg_premio')) throw new Error('rede');
      return row('x', 'Inglês');
    });
    expect(Object.keys(lists)).toEqual(['pkg_idioma.lista?']);
  });
});
