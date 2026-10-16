import { describe, expect, it } from 'vitest';

import {
  lattesLacks,
  requestTab,
  splitByRoute,
  splitPending,
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
  label,
});

describe('enviar ao Lattes: como cada coisa vai', () => {
  it('separa o que o conector grava do que ainda não vai, mantendo grupos e ordem', () => {
    const groups = [group('Dados gerais', ['resumo', 'endereco']), group('Atuação', ['vinculo'])];
    const { conector, pendente } = splitByRoute(groups, new Set(['resumo', 'vinculo']));
    expect(conector.map((g) => [g.label, g.entries.map((e) => e.change.key)])).toEqual([
      ['Dados gerais', ['resumo']],
      ['Atuação', ['vinculo']],
    ]);
    expect(pendente.map((g) => [g.label, g.entries.map((e) => e.change.key)])).toEqual([
      ['Dados gerais', ['endereco']],
    ]);
  });

  it('sem nada pendente, essa parte fica vazia', () => {
    const { pendente } = splitByRoute([group('Dados gerais', ['resumo'])], new Set(['resumo']));
    expect(pendente).toEqual([]);
  });

  it('sem conector, nada vai por ele', () => {
    const { conector, pendente } = splitByRoute([group('Atuação', ['a', 'b'])], new Set());
    expect(conector).toEqual([]);
    expect(pendente[0]?.entries).toHaveLength(2);
  });

  it('conta itens novos e alterações juntos', () => {
    expect(toSendCount(2, [group('Atuação', ['a', 'b']), group('Formação', ['c'])])).toBe(5);
    expect(toSendCount(0, [])).toBe(0);
  });

  it('a aba pedida vale para uma abertura só', () => {
    expect(takeRequestedTab()).toBeUndefined();
    requestTab('enviado');
    expect(takeRequestedTab()).toBe('enviado');
    expect(takeRequestedTab()).toBeUndefined();
  });
});

describe('enviar ao Lattes: o que fica fora do conector', () => {
  it('reconhece o motivo que é do Lattes, e não do editor', () => {
    expect(lattesLacks('O formulário de eventos do Lattes não tem: Idioma')).toBe(true);
    expect(lattesLacks('País que o formulário do Lattes não tem: Atlântida')).toBe(true);
    expect(lattesLacks('Forma de participação que o Lattes não tem: Outra')).toBe(true);
    expect(lattesLacks('Divulgação científica: o formulário do Lattes não volta para vazio')).toBe(
      true,
    );
    expect(lattesLacks('O Lattes não aceita título vazio')).toBe(true);
    expect(lattesLacks('Campos não suportados ainda: Nível')).toBe(false);
    expect(lattesLacks('Formulário não suportado ainda')).toBe(false);
    expect(lattesLacks('')).toBe(false);
  });

  it('separa por motivo; sem motivo, fica com o editor', () => {
    const reasons = new Map([
      ['idioma', 'O formulário de eventos do Lattes não tem: Idioma'],
      ['nivel', 'Campos não suportados ainda: Nível'],
    ]);
    const { editor, lattes } = splitPending(
      [group('Eventos', ['idioma', 'nivel', 'sem-motivo'])],
      reasons,
    );
    expect(lattes[0]?.entries.map((e) => e.change.key)).toEqual(['idioma']);
    expect(editor[0]?.entries.map((e) => e.change.key)).toEqual(['nivel', 'sem-motivo']);
  });
});
