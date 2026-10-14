import { describe, expect, it } from 'vitest';

import {
  initialTab,
  requestTab,
  splitByRoute,
  takeRequestedTab,
  toSendCount,
} from '../src/import-export/send-routes.ts';
import type { Change } from '../src/model/changes.ts';
import type { ChangeGroup } from '../src/ui/changes-view.ts';

const change = (key: string): Change => ({
  element: 'RESUMO-CV',
  fields: [],
  form: 'Resumo',
  key,
  kind: 'alterado',
  path: [key],
});

const group = (label: string, keys: string[]): ChangeGroup => ({
  entries: keys.map((k) => ({ change: change(k), itemTitle: '' })),
  importable: false,
  label,
});

describe('enviar ao Lattes: como cada coisa vai', () => {
  it('separa o que o conector grava do que fica à mão, mantendo grupos e ordem', () => {
    const groups = [group('Dados gerais', ['resumo', 'endereco']), group('Atuação', ['vinculo'])];
    const { conector, mao } = splitByRoute(groups, new Set(['resumo', 'vinculo']));
    expect(conector.map((g) => [g.label, g.entries.map((e) => e.change.key)])).toEqual([
      ['Dados gerais', ['resumo']],
      ['Atuação', ['vinculo']],
    ]);
    expect(mao.map((g) => [g.label, g.entries.map((e) => e.change.key)])).toEqual([
      ['Dados gerais', ['endereco']],
    ]);
  });

  it('sem nada à mão, essa parte fica vazia', () => {
    const { mao } = splitByRoute([group('Dados gerais', ['resumo'])], new Set(['resumo']));
    expect(mao).toEqual([]);
  });

  it('sem conector, tudo fica à mão', () => {
    const { conector, mao } = splitByRoute([group('Atuação', ['a', 'b'])], new Set());
    expect(conector).toEqual([]);
    expect(mao[0]?.entries).toHaveLength(2);
  });

  it('conta itens novos e alterações juntos', () => {
    expect(toSendCount(2, [group('Atuação', ['a', 'b']), group('Formação', ['c'])])).toBe(5);
    expect(toSendCount(0, [])).toBe(0);
  });

  it('abre em "A enviar", ou no registro quando não há nada esperando', () => {
    expect(initialTab(3, 5)).toBe('a-enviar');
    expect(initialTab(0, 5)).toBe('enviado');
    expect(initialTab(0, 0)).toBe('a-enviar');
  });

  it('a aba pedida vale para uma abertura só', () => {
    expect(takeRequestedTab()).toBeUndefined();
    requestTab('enviado');
    expect(takeRequestedTab()).toBe('enviado');
    expect(takeRequestedTab()).toBeUndefined();
  });
});
