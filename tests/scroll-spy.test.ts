// Grupo ativo ao rolar (src/ui/scroll-spy.ts), o mesmo no caminho da barra
// fixa e no "Nesta seção".

import { describe, expect, it } from 'vitest';

import { activeGroup, SPY_SLACK } from '../src/ui/scroll-spy.ts';

const tops = (...t: number[]) => t.map((top, i) => ({ id: `g${i}`, top }));
const page = { atBottom: false, viewport: 800 };

describe('grupo ativo', () => {
  it('muda quando o título chega à borda de baixo da barra', () => {
    expect(activeGroup(tops(-500, 105 + SPY_SLACK + 1), 105, page)).toBe('g0');
    expect(activeGroup(tops(-500, 105 + SPY_SLACK), 105, page)).toBe('g1');
    expect(activeGroup(tops(-500, 105 + 8), 105, page)).toBe('g1');
  });

  it('antes de tudo, o primeiro; no fim da página, o último que aparece', () => {
    expect(activeGroup(tops(300, 600), 105, page)).toBe('g0');
    expect(activeGroup(tops(-900, 300, 600), 105, { atBottom: true, viewport: 800 })).toBe('g2');
  });

  it('ignora grupo sem título na página', () => {
    expect(
      activeGroup(
        [
          { id: 'a', top: -10 },
          { id: 'b', top: undefined },
        ],
        105,
        page,
      ),
    ).toBe('a');
  });
});
