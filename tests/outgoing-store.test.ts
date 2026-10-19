import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BridgeOp } from '../src/bridge/plan.ts';
import { loadOutgoing, saveOutgoing } from '../src/ui/outgoing-store.ts';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => vi.unstubAllGlobals());

const op = { key: 'k1', kind: 'resumo' } as unknown as BridgeOp;

describe('o que o editor espera de volta da extensão', () => {
  it('sobrevive a um recarregamento, por currículo', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveOutgoing('123', new Map([['k1', { op }]]));
    expect(loadOutgoing('123').get('k1')?.op).toEqual(op);
    expect(loadOutgoing('456').size).toBe(0);
  });

  it('vazio, sai do armazenamento', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    saveOutgoing('123', new Map([['k1', { op }]]));
    saveOutgoing('123', new Map());
    expect(storage.getItem('lattes-editor:envio-em-curso:123')).toBeNull();
  });

  it('sem currículo, sem armazenamento ou com conteúdo estragado, começa vazio', () => {
    expect(loadOutgoing(undefined).size).toBe(0);
    saveOutgoing(undefined, new Map([['k1', { op }]]));
    vi.stubGlobal('localStorage', {
      getItem: () => '{não é json',
      removeItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(loadOutgoing('123').size).toBe(0);
    expect(() => saveOutgoing('123', new Map([['k1', { op }]]))).not.toThrow();
    vi.stubGlobal('localStorage', { getItem: () => '{"a":1}' });
    expect(loadOutgoing('123').size).toBe(0);
  });
});
