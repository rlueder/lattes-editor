// ↓ e ↑ no "Nesta seção" (src/ui/jump-keys.ts): quando a tecla pula de grupo
// e quando fica com a página ou com o controle em foco.

import { describe, expect, it } from 'vitest';

import { arrowJumpAllowed, nextJump } from '../src/ui/jump-keys.ts';

const key = (k: string, extra: Partial<Parameters<typeof arrowJumpAllowed>[0]> = {}) => ({
  altKey: false,
  ctrlKey: false,
  defaultPrevented: false,
  key: k,
  metaKey: false,
  shiftKey: false,
  target: null,
  ...extra,
});
const page = (overlay = false) => ({ querySelector: () => (overlay ? ({} as Element) : null) });
/** Um alvo cujo closest() acha (ou não) um controle que usa setas. */
const target = (usesArrows: boolean) =>
  ({ closest: () => (usesArrows ? ({} as Element) : null) }) as unknown as EventTarget;

describe('quando a seta pula de grupo', () => {
  it('só ↓ e ↑, sem modificador e sem outro dono da tecla', () => {
    expect(arrowJumpAllowed(key('ArrowDown'), page())).toBe(true);
    expect(arrowJumpAllowed(key('ArrowUp', { target: target(false) }), page())).toBe(true);
    expect(arrowJumpAllowed(key('ArrowLeft'), page())).toBe(false);
    for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
      expect(arrowJumpAllowed(key('ArrowDown', { [mod]: true }), page()), mod).toBe(false);
    }
    expect(arrowJumpAllowed(key('ArrowDown', { defaultPrevented: true }), page())).toBe(false);
  });

  it('não em campo, lista ou menu, nem com janela ou menu aberto', () => {
    expect(arrowJumpAllowed(key('ArrowDown', { target: target(true) }), page())).toBe(false);
    expect(arrowJumpAllowed(key('ArrowDown'), page(true))).toBe(false);
  });
});

describe('para onde pula', () => {
  const ids = ['a', 'b', 'c'];

  it('a próxima e a anterior; nas pontas, nenhuma, e a tecla segue para a rolagem', () => {
    expect(nextJump(ids, 'a', 1)).toBe('b');
    expect(nextJump(ids, 'b', -1)).toBe('a');
    expect(nextJump(ids, 'c', 1)).toBeUndefined();
    expect(nextJump(ids, 'a', -1)).toBeUndefined();
  });

  it('sem divisão ativa, ↓ vai à primeira', () => {
    expect(nextJump(ids, undefined, 1)).toBe('a');
    expect(nextJump(ids, 'x', -1)).toBeUndefined();
  });
});
