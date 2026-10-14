import { describe, expect, it } from 'vitest';

import { reportText } from '../src/bridge/contract.ts';
import {
  checkLists,
  compareList,
  type ListCheck,
  listText,
  selectOptions,
  unreadLists,
  WATCHED_LISTS,
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

  it('leitura que falha marca só as listas daquele formulário', async () => {
    let gets = 0;
    const checks = await checkLists(
      {
        get: async (path) => {
          gets++;
          if (path.startsWith('a')) throw new Error('rede caiu');
          return '<p>nada</p>';
        },
      },
      'K1',
      watched,
    );
    // A página que falhou é lida uma vez só, mesmo com duas listas nela.
    expect(gets).toBe(2);
    expect(checks.map((c) => [c.label, c.status, c.detail])).toEqual([
      ['Países', 'erro', 'rede caiu'],
      ['Idiomas', 'erro', 'rede caiu'],
      ['Outra', 'nao-encontrado', undefined],
    ]);
  });

  it('o código do currículo não vai para o detalhe', async () => {
    const checks = await checkLists(
      {
        get: async (path) => {
          throw new Error(`falha ao ler ${path}`);
        },
      },
      'K1',
      watched.slice(2),
    );
    expect(checks[0]?.detail).toBe('falha ao ler b?[código]');
  });

  it('falha que não é Error vira um detalhe genérico', async () => {
    const checks = await checkLists(
      {
        get: async () => {
          const notAnError: unknown = 'x';
          throw notAnError;
        },
      },
      'K1',
      watched.slice(2),
    );
    expect(checks[0]).toMatchObject({ detail: 'Falha inesperada', status: 'erro' });
  });

  it('o erro fatal (sessão caída) interrompe a conferência', async () => {
    const fatal = new Error('sessão');
    await expect(
      checkLists(
        {
          get: async () => {
            throw fatal;
          },
          isFatal: (err) => err === fatal,
        },
        'K1',
        watched,
      ),
    ).rejects.toBe(fatal);
  });

  it('sem código do currículo, todas as listas ficam como não lidas', () => {
    const checks = unreadLists('sem código');
    expect(checks.map((c) => c.label)).toEqual(WATCHED_LISTS.map((l) => l.label));
    expect(checks.every((c) => c.status === 'erro' && c.detail === 'sem código')).toBe(true);
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
    const failed: ListCheck = {
      added: [],
      control: 'f_x',
      label: 'Outra',
      removed: [],
      status: 'erro',
    };
    expect(listText({ ...failed, detail: 'rede caiu' })).toBe(
      'Outra: não deu para ler (rede caiu)',
    );
    expect(listText(failed)).toBe('Outra: não deu para ler');
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
