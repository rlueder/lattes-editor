// As chaves de alteração que dependem de uma capacidade da extensão
// (GATED_EDITS, src/bridge/plan.ts): a capacidade entra em BRIDGE_FEATURES no
// mesmo commit em que a chave liga, e só então.

import { describe, expect, it } from 'vitest';

import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { GATED_EDITS, planOptionsFor } from '../src/bridge/plan.ts';

describe('chaves de alteração e capacidades da extensão', () => {
  it('cada chave ligada tem a capacidade anunciada, e cada desligada não', () => {
    for (const g of GATED_EDITS) {
      expect({
        feature: g.feature,
        on: (BRIDGE_FEATURES as readonly string[]).includes(g.feature),
      }).toEqual({ feature: g.feature, on: g.enabled });
    }
  });

  it('cada chave tem opção e capacidade próprias', () => {
    const options = GATED_EDITS.map((g) => g.option);
    const features = GATED_EDITS.map((g) => g.feature);
    expect(new Set(options).size).toBe(options.length);
    expect(new Set(features).size).toBe(features.length);
  });

  it('a extensão sem a capacidade deixa a chave desligada no plano', () => {
    const all = GATED_EDITS.map((g) => g.feature);
    for (const g of GATED_EDITS) {
      expect(planOptionsFor(all)[g.option]).toBe(g.enabled);
      expect(planOptionsFor([])[g.option]).toBe(false);
    }
  });
});
