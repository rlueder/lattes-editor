import { describe, expect, it } from 'vitest';

import { refuseRun, waitWhile } from '../extension/src/editor-run.ts';
import type { QueueState } from '../extension/src/state.ts';
import type { BridgeMessage } from '../src/bridge/protocol.ts';

const op = (key: string) => ({ key }) as QueueState['ops'][number];

describe('gravação pedida pelo editor que não começa', () => {
  it('a primeira ainda não conferida leva o motivo, e o editor recebe o fim', async () => {
    const state: QueueState = {
      ops: [op('a'), op('b')],
      pausa: { done: 20, left: 1 },
      results: { a: { detail: '', key: 'a', status: 'conferido' } },
      running: false,
    };
    const written: QueueState[] = [];
    const sent: BridgeMessage[] = [];
    await refuseRun(
      state,
      'ocupado',
      async (next) => {
        written.push(next);
      },
      async (msg) => {
        sent.push(msg);
      },
    );
    const result = { detail: 'ocupado', key: 'b', status: 'erro' };
    expect(written[0]?.results).toEqual({ ...state.results, b: result });
    expect(sent).toEqual([
      { result, type: 'resultado' },
      { pause: { done: 20, left: 1 }, type: 'fim' },
    ]);
  });

  it('sem nada a gravar, só o fim', async () => {
    const sent: BridgeMessage[] = [];
    await refuseRun(
      { ops: [], results: {}, running: false },
      'x',
      async () => undefined,
      async (msg) => {
        sent.push(msg);
      },
    );
    expect(sent).toEqual([{ pause: undefined, type: 'fim' }]);
  });

  it('espera a verificação terminar, e desiste no prazo', async () => {
    let calls = 0;
    await waitWhile(async () => ++calls < 3, 1000, 1);
    expect(calls).toBe(3);
    let forever = 0;
    await waitWhile(
      async () => {
        forever++;
        return true;
      },
      5,
      1,
    );
    expect(forever).toBeGreaterThan(1);
  });
});
