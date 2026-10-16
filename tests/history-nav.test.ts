// Voltar e avançar no app de desktop (src/ui/history-nav.ts): cada entrada do
// histórico leva a própria posição, e a maior posição alcançada diz se há o
// que avançar.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  afterPush,
  afterTraverse,
  canGoBack,
  canGoForward,
  indexOf,
  navShortcut,
  startPosition,
  stateWith,
} from '../src/ui/history-nav.ts';

describe('posição no histórico', () => {
  it('lê a posição gravada e ignora o que não é uma', () => {
    expect(indexOf({ navIndex: 3 })).toBe(3);
    expect(indexOf(null)).toBeUndefined();
    expect(indexOf('x')).toBeUndefined();
    expect(indexOf({ navIndex: -1 })).toBeUndefined();
    expect(indexOf({ navIndex: 1.5 })).toBeUndefined();
  });

  it('grava a posição mantendo o resto do estado', () => {
    expect(stateWith({ outro: 1 }, 2)).toEqual({ navIndex: 2, outro: 1 });
    expect(stateWith(null, 0)).toEqual({ navIndex: 0 });
  });

  it('ao abrir: a posição da entrada, ou 0, e o máximo guardado na sessão', () => {
    expect(startPosition(null, undefined)).toEqual({ index: 0, max: 0 });
    expect(startPosition({ navIndex: 2 }, 5)).toEqual({ index: 2, max: 5 });
    expect(startPosition({ navIndex: 4 }, 1)).toEqual({ index: 4, max: 4 });
  });

  it('entrada nova corta o que havia adiante', () => {
    expect(afterPush({ index: 1, max: 4 })).toEqual({ index: 2, max: 2 });
  });

  it('voltar e avançar mudam a posição sem perder o máximo', () => {
    const pos = { index: 3, max: 3 };
    const back = afterTraverse(pos, { navIndex: 2 });
    expect(back).toEqual({ index: 2, max: 3 });
    expect(canGoBack(back)).toBe(true);
    expect(canGoForward(back)).toBe(true);
    expect(afterTraverse(back, { navIndex: 3 })).toEqual({ index: 3, max: 3 });
  });

  it('entrada sem posição (link seguido pelo navegador) é nova', () => {
    expect(afterTraverse({ index: 1, max: 3 }, null)).toEqual({ index: 2, max: 2 });
  });

  it('no começo não volta; no fim não avança', () => {
    expect(canGoBack({ index: 0, max: 2 })).toBe(false);
    expect(canGoForward({ index: 2, max: 2 })).toBe(false);
  });
});

describe('atalhos de voltar e avançar', () => {
  const key = (
    k: string,
    mods: Partial<Record<'alt' | 'ctrl' | 'meta' | 'shift', boolean>> = {},
  ) => ({
    altKey: Boolean(mods.alt),
    ctrlKey: Boolean(mods.ctrl),
    key: k,
    metaKey: Boolean(mods.meta),
    shiftKey: Boolean(mods.shift),
  });

  it('Mac: ⌘[ e ⌘], ⌘← e ⌘→', () => {
    expect(navShortcut(key('[', { meta: true }), true)).toBe('back');
    expect(navShortcut(key(']', { meta: true }), true)).toBe('forward');
    expect(navShortcut(key('ArrowLeft', { meta: true }), true)).toBe('back');
    expect(navShortcut(key('ArrowRight', { meta: true }), true)).toBe('forward');
  });

  it('outros sistemas: Ctrl+[ e Ctrl+], Alt+← e Alt+→', () => {
    expect(navShortcut(key('[', { ctrl: true }), false)).toBe('back');
    expect(navShortcut(key(']', { ctrl: true }), false)).toBe('forward');
    expect(navShortcut(key('ArrowLeft', { alt: true }), false)).toBe('back');
    expect(navShortcut(key('ArrowRight', { alt: true }), false)).toBe('forward');
  });

  it('sem o modificador certo, ou com Shift (seleção), nada', () => {
    expect(navShortcut(key('ArrowLeft'), true)).toBeUndefined();
    expect(navShortcut(key('[', { ctrl: true }), true)).toBeUndefined();
    expect(navShortcut(key('ArrowLeft', { meta: true, shift: true }), true)).toBeUndefined();
    expect(navShortcut(key('ArrowLeft', { alt: true, meta: true }), true)).toBeUndefined();
    expect(navShortcut(key('k', { meta: true }), true)).toBeUndefined();
  });
});

/** Histórico de uma janela, com voltar e avançar disparando popstate. */
function fakeWindow(start = 'app:/#producoes') {
  const entries: { state: unknown; url: string }[] = [{ state: null, url: start }];
  let at = 0;
  const listeners: Record<string, (() => void)[]> = {};
  const fire = (type: string) => listeners[type]?.forEach((l) => l());
  const store = new Map<string, string>();
  const history = {
    back: () => {
      at--;
      fire('popstate');
    },
    forward: () => {
      at++;
      fire('popstate');
    },
    pushState: (state: unknown, _t: string, url: string) => {
      entries.splice(at + 1, entries.length, { state, url });
      at++;
    },
    replaceState: (state: unknown, _t: string, url: string) => {
      entries[at] = { state, url };
    },
    get state() {
      return entries[at]!.state;
    },
  };
  return {
    /** Um link "#..." seguido pelo navegador: entrada nova sem estado. */
    follow(url: string) {
      entries.splice(at + 1, entries.length, { state: null, url });
      at++;
      fire('popstate');
      fire('hashchange');
    },
    globals: {
      history,
      location: {
        get hash() {
          return entries[at]!.url.replace(/^[^#]*/, '');
        },
        get href() {
          return entries[at]!.url;
        },
      },
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      window: {
        addEventListener: (type: string, l: () => void) => {
          (listeners[type] ??= []).push(l);
        },
      },
    },
    history,
  };
}

describe('histórico da janela', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('marca a entrada, conta as novas e acompanha voltar, avançar e links', async () => {
    const win = fakeWindow();
    for (const [k, v] of Object.entries(win.globals)) vi.stubGlobal(k, v);
    const nav = await import('../src/ui/history-nav.ts');
    nav.startHistoryNav();
    nav.startHistoryNav();
    expect(indexOf(win.history.state)).toBe(0);
    expect(nav.navPosition()).toEqual({ index: 0, max: 0 });

    const seen: number[] = [];
    const stop = nav.subscribeNav(() => seen.push(nav.navPosition().index));
    nav.pushHash('#formacao');
    nav.pushHash('#atuacao');
    expect(nav.navPosition()).toEqual({ index: 2, max: 2 });

    // Trocar o hash na mesma entrada mantém a posição dela.
    nav.replaceHash('#atuacao/vinculos');
    expect(indexOf(win.history.state)).toBe(2);

    win.history.back();
    expect(nav.navPosition()).toEqual({ index: 1, max: 2 });
    win.history.forward();
    expect(nav.navPosition()).toEqual({ index: 2, max: 2 });

    win.history.back();
    win.follow('app:/#patentes');
    expect(nav.navPosition()).toEqual({ index: 2, max: 2 });
    expect(indexOf(win.history.state)).toBe(2);
    stop();
    expect(seen).toEqual([1, 2, 1, 2, 1, 2]);
    expect(win.globals.sessionStorage.getItem('lattes-editor:historico-max')).toBe('2');
  });

  it('ao recarregar, a posição e o máximo voltam da entrada e da sessão', async () => {
    const win = fakeWindow();
    win.history.replaceState({ navIndex: 1 }, '', 'app:/#formacao');
    win.globals.sessionStorage.setItem('lattes-editor:historico-max', '3');
    for (const [k, v] of Object.entries(win.globals)) vi.stubGlobal(k, v);
    const nav = await import('../src/ui/history-nav.ts');
    nav.startHistoryNav();
    expect(nav.navPosition()).toEqual({ index: 1, max: 3 });
  });

  it('sem armazenamento da sessão, o máximo vale até recarregar', async () => {
    const win = fakeWindow();
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    for (const [k, v] of Object.entries({ ...win.globals, sessionStorage: broken })) {
      vi.stubGlobal(k, v);
    }
    const nav = await import('../src/ui/history-nav.ts');
    nav.startHistoryNav();
    nav.pushHash('#formacao');
    expect(nav.navPosition()).toEqual({ index: 1, max: 1 });
  });

  it('trocar de seção cria entrada; ir a um grupo da mesma seção só troca o endereço', async () => {
    const win = fakeWindow();
    for (const [k, v] of Object.entries(win.globals)) vi.stubGlobal(k, v);
    const nav = await import('../src/ui/history-nav.ts');
    const { writeHash } = await import('../src/ui/hash-route.ts');
    nav.startHistoryNav();
    writeHash({ anchor: 'producoes/artigos', sectionId: 'producoes' });
    expect(nav.navPosition().index).toBe(0);
    expect(win.globals.location.hash).toBe('#producoes/artigos');
    writeHash({ sectionId: 'formacao' });
    expect(nav.navPosition().index).toBe(1);
    writeHash({ sectionId: 'formacao' });
    expect(nav.navPosition().index).toBe(1);
  });

  it('a URL sem âncora é a seção de abertura: nomeá-la não cria entrada, e voltar a ela a mostra', async () => {
    const win = fakeWindow('app:/');
    for (const [k, v] of Object.entries(win.globals)) vi.stubGlobal(k, v);
    const nav = await import('../src/ui/history-nav.ts');
    const { DEFAULT_SECTION, routeOf, writeHash } = await import('../src/ui/hash-route.ts');
    nav.startHistoryNav();
    expect(routeOf('')).toEqual({ sectionId: DEFAULT_SECTION });
    expect(routeOf('#formacao/x')).toEqual({ anchor: 'formacao/x', sectionId: 'formacao' });
    writeHash({ sectionId: 'producoes' });
    expect(nav.navPosition().index).toBe(1);
    win.history.back();
    expect(win.globals.location.hash).toBe('');
    expect(routeOf(win.globals.location.hash)).toEqual({ sectionId: DEFAULT_SECTION });
    writeHash({ sectionId: DEFAULT_SECTION });
    expect(nav.navPosition()).toEqual({ index: 0, max: 1 });
    expect(win.globals.location.hash).toBe('#dados-gerais');
  });
});
