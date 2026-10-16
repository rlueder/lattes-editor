import { describe, expect, it } from 'vitest';

import type { OpResult } from '../src/bridge/apply.ts';
import type { BridgeOp } from '../src/bridge/plan.ts';
import { stepStates, writeRows } from '../src/import-export/send-steps.ts';

const op = (key: string) => ({ key, label: `Item ${key}` }) as BridgeOp;
const result = (key: string, status: OpResult['status'], detail = ''): OpResult => ({
  detail,
  key,
  status,
});

describe('passos da janela de envio', () => {
  it('revisar enquanto há o que gravar; gravando, o passo 2; depois, publicar', () => {
    expect(stepStates({ toPublish: false, toWrite: 3, writing: false })).toEqual([
      'atual',
      'depois',
      'depois',
    ]);
    expect(stepStates({ toPublish: true, toWrite: 3, writing: true })).toEqual([
      'feito',
      'atual',
      'depois',
    ]);
    expect(stepStates({ toPublish: true, toWrite: 0, writing: false })).toEqual([
      'feito',
      'feito',
      'atual',
    ]);
    expect(stepStates({ toPublish: false, toWrite: 0, writing: false })[0]).toBe('atual');
  });
});

describe('andamento de cada alteração da rodada', () => {
  const round = [op('a'), op('b'), op('c')];

  it('correndo: a primeira sem resultado grava, as outras esperam', () => {
    const rows = writeRows(round, { a: result('a', 'conferido') }, true);
    expect(rows.map((r) => r.state)).toEqual(['conferido', 'gravando', 'fila']);
    expect(rows[0]).toMatchObject({ label: 'Item a', text: 'gravada e conferida' });
    expect(rows[0]!.detail).toBeUndefined();
  });

  it('parada num problema: o motivo aparece, e as que sobraram não foram enviadas', () => {
    const rows = writeRows(round, { a: result('a', 'divergente', 'não dá para saber') }, false);
    expect(rows.map((r) => r.state)).toEqual(['divergente', 'parada', 'parada']);
    expect(rows[0]).toMatchObject({ detail: 'não dá para saber', text: 'confira no Lattes' });
    expect(rows[1]!.text).toBe('não enviada');
  });

  it('na pausa, as que faltam esperam o Continuar', () => {
    const rows = writeRows(
      round,
      { a: result('a', 'conferido'), b: result('b', 'conferido') },
      false,
      true,
    );
    expect(rows.map((r) => r.state)).toEqual(['conferido', 'conferido', 'fila']);
  });
});
