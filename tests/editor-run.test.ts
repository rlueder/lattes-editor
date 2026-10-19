import { describe, expect, it, vi } from 'vitest';

import {
  endDeadRound,
  handleSend,
  refuseBusy,
  refuseRun,
  replayResults,
  RUNNING_TEXT,
  waitWhile,
} from '../extension/src/editor-run.ts';
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

  it('rodada que o worker deixou correndo termina ao acordar, divergente', async () => {
    const written: QueueState[] = [];
    const sent: BridgeMessage[] = [];
    await endDeadRound(
      {
        ops: [op('a'), op('b')],
        results: { a: { detail: '', key: 'a', status: 'conferido' } },
        running: true,
      },
      async (next) => {
        written.push(next);
      },
      async (msg) => {
        sent.push(msg);
      },
    );
    expect(written[0]).toMatchObject({ running: false, results: { b: { status: 'divergente' } } });
    expect(sent.map((m) => m.type)).toEqual(['resultado', 'fim']);
    expect((sent[0] as { result: { detail: string } }).result.detail).toMatch(
      /^O conector reiniciou no meio da gravação; /,
    );
  });
});

describe('editor que reconecta no meio da fila', () => {
  it('recebe de novo cada resultado, marcado como repetição', async () => {
    const sent: BridgeMessage[] = [];
    const a = { detail: '', key: 'a', status: 'conferido' } as const;
    const b = { detail: 'não gravou', key: 'b', status: 'divergente' } as const;
    await replayResults(
      { ops: [op('a'), op('b')], results: { a, b }, running: true },
      async (m) => {
        sent.push(m);
      },
    );
    expect(sent).toEqual([
      { replay: true, result: a, type: 'resultado' },
      { replay: true, result: b, type: 'resultado' },
    ]);
  });

  it('com a fila parada, repete também o fim, com a pausa', async () => {
    const sent: BridgeMessage[] = [];
    const a = { detail: '', key: 'a', status: 'conferido' } as const;
    await replayResults(
      { ops: [op('a'), op('b')], pausa: { done: 1, left: 1 }, results: { a }, running: false },
      async (m) => {
        sent.push(m);
      },
    );
    expect(sent.at(-1)).toEqual({ pause: { done: 1, left: 1 }, type: 'fim' });
  });
});

describe('pedido de gravação com outra rodada correndo', () => {
  it('o editor recebe o porquê e o fim, e o estado não muda', async () => {
    const sent: BridgeMessage[] = [];
    await refuseBusy([op('x'), op('y')], async (m) => {
      sent.push(m);
    });
    expect(sent).toEqual([
      { result: { detail: RUNNING_TEXT, key: 'x', status: 'erro' }, type: 'resultado' },
      { type: 'fim' },
    ]);
  });
});

describe('pedido do editor enquanto a rodada anterior ainda não começou', () => {
  it('o segundo volta recusado, e a fila do primeiro fica', async () => {
    let stored: QueueState = { ops: [], results: {}, running: false };
    vi.stubGlobal('chrome', {
      action: { setBadgeText: async () => undefined },
      storage: {
        session: {
          get: async () => ({ fila: stored }),
          set: async (v: { fila: QueueState }) => {
            stored = v.fila;
          },
        },
      },
    });
    let release: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>((r) => (release = r)));
    const sent: BridgeMessage[] = [];
    const send = async (m: BridgeMessage) => {
      sent.push(m);
    };
    await handleSend({ ops: [op('a')], start: true, type: 'enviar' }, 7, run, send);
    await handleSend({ ops: [op('b')], start: true, type: 'enviar' }, 7, run, send);
    expect(run).toHaveBeenCalledTimes(1);
    expect(stored.ops.map((o) => o.key)).toEqual(['a']);
    expect(sent).toEqual([
      { result: { detail: RUNNING_TEXT, key: 'b', status: 'erro' }, type: 'resultado' },
      { type: 'fim' },
    ]);
    release();
    await Promise.resolve();
    await Promise.resolve();
    // Terminada a primeira, o próximo pedido entra.
    await handleSend({ ops: [op('c')], start: false, type: 'enviar' }, 7, run, send);
    expect(stored.ops.map((o) => o.key)).toEqual(['c']);
    vi.unstubAllGlobals();
  });

  it('dois pedidos quase juntos: os awaits se intercalam e só o primeiro entra', async () => {
    let stored: QueueState = { ops: [], results: {}, running: false };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    vi.stubGlobal('chrome', {
      action: { setBadgeText: async () => undefined },
      storage: {
        session: {
          get: async () => {
            await tick();
            return { fila: stored };
          },
          set: async (v: { fila: QueueState }) => {
            await tick();
            stored = v.fila;
          },
        },
      },
    });
    let release: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>((r) => (release = r)));
    const sent: BridgeMessage[] = [];
    const send = async (m: BridgeMessage) => {
      sent.push(m);
    };
    await Promise.all([
      handleSend({ ops: [op('a')], start: true, type: 'enviar' }, 7, run, send),
      handleSend({ ops: [op('b')], start: true, type: 'enviar' }, 7, run, send),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(stored.ops.map((o) => o.key)).toEqual(['a']);
    expect(sent[0]).toMatchObject({ result: { detail: RUNNING_TEXT, key: 'b' } });
    release();
    await tick();
    // Sem start, a trava não fica tomada.
    await handleSend({ ops: [op('c')], start: false, type: 'enviar' }, 7, run, send);
    await handleSend({ ops: [op('d')], start: false, type: 'enviar' }, 7, run, send);
    expect(stored.ops.map((o) => o.key)).toEqual(['d']);
    vi.unstubAllGlobals();
  });
});
