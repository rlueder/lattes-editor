import { describe, expect, it } from 'vitest';

import { summaryOf } from '../src/ui/use-test-items.ts';

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
