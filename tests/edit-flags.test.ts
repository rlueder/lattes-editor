// As chaves de alteração que dependem de uma capacidade da extensão
// (GATED_EDITS, src/bridge/plan.ts): a capacidade entra em BRIDGE_FEATURES no
// mesmo commit em que a chave liga, e só então.

import { describe, expect, it } from 'vitest';

import { BUILD_GATES } from '../src/bridge/apply.ts';
import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { EDIT_EVENTO_ENABLED } from '../src/bridge/edit-items.ts';
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

describe('chaves do lado da extensão', () => {
  it('BUILD_GATES segue as chaves da montagem e o contrato', () => {
    expect(BUILD_GATES.editEvento).toBe(EDIT_EVENTO_ENABLED);
    const inContract = (['formacao-complementar', 'premio'] as const).filter(
      (k) => LATTES_CONTRACT.forms[k] !== undefined,
    );
    expect([...BUILD_GATES.lists].sort()).toEqual(inContract);
  });

  it('esta montagem, com tudo ligado, deixa passar cada operação atrás de chave', () => {
    // Para o teste ao vivo: todas as chaves ligadas, com a capacidade anunciada.
    expect(GATED_EDITS.every((g) => g.enabled)).toBe(true);
    expect(BUILD_GATES.editEvento).toBe(true);
    expect([...BUILD_GATES.lists].sort()).toEqual(['formacao-complementar', 'premio']);
    const all = planOptionsFor(BRIDGE_FEATURES);
    for (const g of GATED_EDITS) expect(all[g.option]).toBe(true);
  });
});
