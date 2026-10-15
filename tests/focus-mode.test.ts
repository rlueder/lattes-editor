import { describe, expect, it } from 'vitest';

import {
  DISMISSED,
  EDGE,
  edgeWait,
  FOCUS_KEY,
  focusShortcutLabel,
  isFocusShortcut,
  nextEdge,
  NO_EDGE,
  readFocusMode,
  shellClass,
  writeFocusMode,
} from '../src/ui/focus-mode.ts';
import { allEntries, paletteActions } from '../src/ui/palette-search.ts';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: () => null,
    get length() {
      return data.size;
    },
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const key = (
  k: string,
  mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>>,
) => ({
  altKey: false,
  ctrlKey: false,
  key: k,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

describe('modo foco: escolha guardada no aparelho', () => {
  it('começa desligado e lembra a última escolha', () => {
    const store = memory();
    expect(readFocusMode(store)).toBe(false);
    writeFocusMode(true, store);
    expect(store.getItem(FOCUS_KEY)).toBe('1');
    expect(readFocusMode(store)).toBe(true);
    writeFocusMode(false, store);
    expect(readFocusMode(store)).toBe(false);
  });

  it('sem armazenamento, ou com ele bloqueado, não quebra', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(readFocusMode(broken)).toBe(false);
    expect(() => writeFocusMode(true, broken)).not.toThrow();
    expect(readFocusMode(undefined)).toBe(false);
    expect(() => writeFocusMode(true, undefined)).not.toThrow();
  });
});

describe('modo foco: atalho', () => {
  it('⌘⇧F no Mac, Ctrl+Shift+F nos outros', () => {
    expect(isFocusShortcut(key('F', { metaKey: true, shiftKey: true }), true)).toBe(true);
    expect(isFocusShortcut(key('f', { metaKey: true, shiftKey: true }), true)).toBe(true);
    expect(isFocusShortcut(key('F', { ctrlKey: true, shiftKey: true }), false)).toBe(true);
    expect(focusShortcutLabel(true)).toBe('⌘⇧F');
    expect(focusShortcutLabel(false)).toBe('Ctrl+Shift+F');
  });

  it('não confunde com ⌘F, ⌘K, Ctrl no Mac ou Alt junto', () => {
    expect(isFocusShortcut(key('f', { metaKey: true }), true)).toBe(false);
    expect(isFocusShortcut(key('k', { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isFocusShortcut(key('f', { ctrlKey: true, shiftKey: true }), true)).toBe(false);
    expect(isFocusShortcut(key('f', { altKey: true, metaKey: true, shiftKey: true }), true)).toBe(
      false,
    );
    expect(isFocusShortcut(key('f', { metaKey: true, shiftKey: true }), false)).toBe(false);
  });

  it('entra no ⌘K só quando existe', () => {
    expect(paletteActions().some((a) => a.action === 'foco')).toBe(false);
    const foco = paletteActions({ focus: '⌘⇧F' }).find((a) => a.action === 'foco');
    expect(foco?.label).toContain('⌘⇧F');
    expect(allEntries([], '⌘⇧F').some((a) => a.action === 'foco')).toBe(true);
  });
});

describe('modo foco: borda que revela os painéis', () => {
  const panels = { left: 240, top: 57 };

  it('abre o menu depois da espera com o ponteiro na faixa da esquerda', () => {
    let s = nextEdge(NO_EDGE, { t: 0, x: 5, y: 400 }, panels);
    expect(s.left).toBe(false);
    expect(s.leftSince).toBe(0);
    expect(edgeWait(s, 100)).toBe(EDGE.delay - 100);
    s = nextEdge(s, { t: 100, x: 8, y: 400 }, panels);
    expect(s.left).toBe(false);
    s = nextEdge(s, { t: EDGE.delay, x: 8, y: 400 }, panels);
    expect(s.left).toBe(true);
    expect(edgeWait(s, EDGE.delay)).toBeUndefined();
  });

  it('passar rápido pela borda não abre', () => {
    let s = nextEdge(NO_EDGE, { t: 0, x: 4, y: 400 }, panels);
    s = nextEdge(s, { t: 60, x: 200, y: 400 }, panels);
    expect(s).toEqual({ left: false, leftSince: undefined, top: false, topSince: undefined });
    s = nextEdge(s, { t: 200, x: 4, y: 400 }, panels);
    expect(s.left).toBe(false);
  });

  it('o menu fica aberto enquanto o ponteiro está nele e fecha ao sair com folga', () => {
    let s = { ...NO_EDGE, left: true };
    s = nextEdge(s, { t: 0, x: 230, y: 400 }, panels);
    expect(s.left).toBe(true);
    s = nextEdge(s, { t: 0, x: 240 + EDGE.slack, y: 400 }, panels);
    expect(s.left).toBe(true);
    s = nextEdge(s, { t: 0, x: 240 + EDGE.slack + 1, y: 400 }, panels);
    expect(s.left).toBe(false);
  });

  it('depois de escolher no painel, o ponteiro parado na borda não o reabre', () => {
    // Fechado pela escolha, com o ponteiro ainda na faixa da esquerda.
    let s = nextEdge(DISMISSED, { t: 0, x: 4, y: 400 }, panels);
    s = nextEdge(s, { t: EDGE.delay * 3, x: 4, y: 400 }, panels);
    expect(s).toEqual(DISMISSED);
    // Sai da faixa: volta ao normal, e voltar à borda abre depois da espera.
    s = nextEdge(s, { t: 1000, x: 300, y: 400 }, panels);
    expect(s).toEqual(NO_EDGE);
    s = nextEdge(s, { t: 1100, x: 4, y: 400 }, panels);
    s = nextEdge(s, { t: 1100 + EDGE.delay, x: 4, y: 400 }, panels);
    expect(s.left).toBe(true);
  });

  it('a borda de cima revela o cabeçalho do mesmo jeito', () => {
    let s = nextEdge(NO_EDGE, { t: 0, x: 600, y: 2 }, panels);
    s = nextEdge(s, { t: EDGE.delay + 1, x: 600, y: 2 }, panels);
    expect(s.top).toBe(true);
    expect(s.left).toBe(false);
    s = nextEdge(s, { t: 400, x: 600, y: 57 + EDGE.slack + 1 }, panels);
    expect(s.top).toBe(false);
  });

  it('classes da moldura', () => {
    expect(shellClass(false, { left: true, top: true })).toBe('shell');
    expect(shellClass(true, { left: false, top: false })).toBe('shell is-focus');
    expect(shellClass(true, { left: true, top: true })).toBe(
      'shell is-focus reveal-left reveal-top',
    );
  });
});
