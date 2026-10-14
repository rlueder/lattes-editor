import { describe, expect, it } from 'vitest';

import { reportText } from '../src/bridge/contract.ts';
import {
  checkLists,
  compareList,
  listText,
  selectOptions,
  type WatchedList,
} from '../src/bridge/list-watch.ts';

const PAGE = `<form name="GN_TEC">
  <select name="f_pais" class="x"><option value="">Selecione</option>
    <option value="ARG">Argentina</option><option value="BRA" selected>Brasil</option>
    <option value="RFA">Alemanha</option><option value="BRA">Brasil</option></select>
  <select name='F_IDIOMA'><option value=''></option><option value='PT'>Portugu&ecirc;s</option></select>
</form>`;

describe('vigia das listas: ler o combo', () => {
  it('o texto das opções, sem a vazia nem repetidas, com entidades', () => {
    expect(selectOptions(PAGE, 'f_pais')).toEqual(['Argentina', 'Brasil', 'Alemanha']);
    expect(selectOptions(PAGE, 'F_IDIOMA')).toEqual(['Português']);
    expect(selectOptions(PAGE, 'f_uf')).toBeUndefined();
  });

  it('compara sem acento e caixa, e diz o que entrou e o que saiu', () => {
    expect(compareList(['Brasil', 'Coréia do Sul'], ['brasil', 'Coreia Do Sul'])).toEqual({
      added: [],
      removed: [],
    });
    expect(compareList(['Brasil', 'Iugoslávia'], ['Brasil', 'Sérvia'])).toEqual({
      added: ['Sérvia'],
      removed: ['Iugoslávia'],
    });
  });
});

describe('vigia das listas: conferência', () => {
  const watched: WatchedList[] = [
    {
      control: 'f_pais',
      expected: ['Argentina', 'Brasil'],
      label: 'Países',
      path: (c) => `a?${c}`,
    },
    { control: 'F_IDIOMA', expected: ['Português'], label: 'Idiomas', path: (c) => `a?${c}` },
    { control: 'f_x', expected: ['X'], label: 'Outra', path: (c) => `b?${c}` },
  ];

  it('lê cada formulário uma vez e marca o que mudou ou sumiu', async () => {
    const gets: string[] = [];
    const checks = await checkLists(
      {
        get: async (path) => {
          gets.push(path);
          return path.startsWith('a') ? PAGE : '<p>nada</p>';
        },
      },
      'K1',
      watched,
    );
    expect(gets).toEqual(['a?K1', 'b?K1']);
    expect(checks.map((c) => [c.label, c.status])).toEqual([
      ['Países', 'mudou'],
      ['Idiomas', 'ok'],
      ['Outra', 'nao-encontrado'],
    ]);
    expect(checks[0]).toMatchObject({ added: ['Alemanha'], removed: [] });
  });

  it('o texto do relatório resume listas longas', () => {
    const many = Array.from({ length: 8 }, (_, i) => `P${i}`);
    expect(
      listText({
        added: many,
        control: 'f_pais',
        label: 'Países',
        removed: ['Q'],
        status: 'mudou',
      }),
    ).toBe('Países: novas: P0, P1, P2, P3, P4 e mais 3; saíram: Q');
    expect(
      listText({
        added: [],
        control: 'f_x',
        label: 'Outra',
        removed: [],
        status: 'nao-encontrado',
      }),
    ).toBe('Outra: combo f_x sumiu');
  });

  it('as listas entram no relatório para a issue', () => {
    const text = reportText(
      {
        checkedAt: '2026-10-14T10:00:00.000Z',
        forms: [],
        lists: [
          { added: [], control: 'F_IDIOMA', label: 'Idiomas', removed: [], status: 'ok' },
          { added: ['Sérvia'], control: 'f_pais', label: 'Países', removed: [], status: 'mudou' },
        ],
        menu: [],
        status: 'mudou',
      },
      '0.23.0',
    );
    expect(text).toContain('Listas dos campos tipados:\n- Idiomas: ok\n- Países: novas: Sérvia');
  });
});
