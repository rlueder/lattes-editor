import { describe, expect, it } from 'vitest';

import { liveLine, summaryOf } from '../src/ui/use-test-items.ts';

describe('itens de teste no editor: o resumo da resposta', () => {
  it('o andamento e o de um lote viram resumo; o resto, não', () => {
    expect(summaryOf({ criados: 3, faltam: 2, falharam: [], removidos: 0 })).toMatchObject({
      criados: 3,
    });
    expect(summaryOf({ removidos: 4, total: 9 })).toMatchObject({ removidos: 4 });
    expect(summaryOf({ removidos: 0 } as unknown)).toBeDefined();
    expect(summaryOf(undefined)).toBeUndefined();
    expect(summaryOf('x')).toBeUndefined();
    expect(summaryOf({ outro: 1 })).toBeUndefined();
  });
});

describe('itens de teste no editor: a linha do andamento', () => {
  it('lendo, criando e esperando', () => {
    expect(liveLine({ at: 1000, done: 37, last: 'pkg_x.form', phase: 'lendo' }, 5000)).toBe(
      '37 páginas lidas · último: pkg_x.form · há 4 s',
    );
    expect(liveLine({ at: 1000, done: 12, phase: 'criando', total: 50 }, 1000)).toBe(
      '12 de 50 · há 0 s',
    );
    expect(liveLine(undefined)).toBe('Esperando a extensão começar.');
    expect(liveLine({ at: 0, done: 0, phase: 'parado' })).toBe('Esperando a extensão começar.');
  });
});
