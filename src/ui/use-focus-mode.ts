// Modo foco (focus-mode.ts): a escolha guardada, o atalho, a borda que revela
// os painéis e a transição sem salto do conteúdo ao entrar e ao sair.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type EdgeState,
  edgeWait,
  focusShortcutLabel,
  isFocusShortcut,
  nextEdge,
  NO_EDGE,
  readFocusMode,
  shellClass,
  writeFocusMode,
} from './focus-mode.ts';
import { readingModeOn } from './reading.ts';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** O bloco de conteúdo que não pode pular na troca. */
const contentNode = () =>
  document.querySelector<HTMLElement>('.section-layout') ??
  document.querySelector<HTMLElement>('.content');

export interface FocusMode {
  available: boolean;
  on: boolean;
  toggle: () => void;
}

/**
 * Liga e desliga o modo foco (⌘⇧F, ⚙ e ⌘K), lembrado neste aparelho. Ao
 * trocar, o conteúdo sai do lugar antigo para o novo em 200ms (FLIP), em vez
 * de pular; com movimento reduzido, troca direto.
 */
export function useFocusMode(available: boolean): FocusMode {
  const [on, setOn] = useState(() => available && readFocusMode());
  const before = useRef<DOMRect | null>(null);

  const toggle = useCallback(() => {
    if (!available) return;
    before.current = contentNode()?.getBoundingClientRect() ?? null;
    setOn((v) => {
      writeFocusMode(!v);
      return !v;
    });
  }, [available]);

  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    const node = contentNode();
    if (!first || !node || reducedMotion() || typeof node.animate !== 'function') return;
    const last = node.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx === 0 && dy === 0) return;
    node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration: 200,
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    });
  }, [on]);

  useEffect(() => {
    if (!available) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isFocusShortcut(e, IS_MAC)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [available, toggle]);

  return { available, on, toggle };
}

/** Os painéis que a borda revela no modo foco: o menu à esquerda e o cabeçalho em cima. */
export function useEdgeReveal(on: boolean): EdgeState {
  const [state, setState] = useState<EdgeState>(NO_EDGE);
  const current = useRef<EdgeState>(NO_EDGE);
  useEffect(() => {
    current.current = NO_EDGE;
    setState(NO_EDGE);
    if (!on) return;
    let timer = 0;
    const panels = () => ({
      left: document.querySelector('.sidebar')?.getBoundingClientRect().width ?? 240,
      top: document.querySelector('.topbar')?.getBoundingClientRect().height ?? 57,
    });
    const step = (x: number, y: number) => {
      const now = performance.now();
      const next = nextEdge(current.current, { t: now, x, y }, panels());
      clearTimeout(timer);
      const wait = edgeWait(next, now);
      // Ponteiro parado na borda: reavalia quando a espera acabar.
      if (wait !== undefined) timer = window.setTimeout(() => step(x, y), wait + 5);
      if (next.left !== current.current.left || next.top !== current.current.top) {
        setState(next);
      }
      current.current = next;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') step(e.clientX, e.clientY);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
    };
  }, [on]);
  return state;
}

/**
 * Um menu ou painel aberto a partir do cabeçalho (⚙, sino) ou do menu de
 * seções: o Base UI marca o gatilho com data-popup-open ou aria-expanded. Com
 * ele aberto, o painel de onde saiu continua à mostra no modo foco, mesmo com
 * o ponteiro e o foco já dentro do menu, fora do painel.
 */
function usePopupOpen(selector: string, on: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const host = on ? document.querySelector(selector) : null;
    if (!host) {
      setOpen(false);
      return;
    }
    const check = () =>
      setOpen(host.querySelector('[data-popup-open], [aria-expanded="true"]') !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(host, {
      attributeFilter: ['data-popup-open', 'aria-expanded'],
      attributes: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [selector, on]);
  return open;
}

export interface FocusShell {
  /** Classes da moldura. */
  className: string;
  focus: FocusMode;
  /** O atalho por extenso (⌘⇧F), quando o modo foco existe. */
  label?: string;
  /** Para o ⚙: estado, atalho e troca; ausente sem ?leitura. */
  menuItem?: { label: string; on: boolean; toggle: () => void };
  menuPinned: boolean;
  setMenuPinned: (v: boolean | ((v: boolean) => boolean)) => void;
}

/**
 * Tudo que a moldura precisa do modo foco: ligado ou não, os painéis à
 * mostra (borda, puxador, ⌘K) e o atalho. Só existe com ?leitura.
 */
export function useFocusShell(paletteOpen: boolean, sectionId: string): FocusShell {
  const [readingMode] = useState(readingModeOn);
  const focus = useFocusMode(readingMode);
  const edge = useEdgeReveal(focus.on);
  const topMenu = usePopupOpen('.topbar', focus.on);
  const sideMenu = usePopupOpen('.sidebar', focus.on);
  const [menuPinned, setMenuPinned] = useState(false);
  // O menu aberto pelo puxador fecha ao sair do modo foco ou ao escolher seção.
  useEffect(() => setMenuPinned(false), [focus.on, sectionId]);
  const label = focus.available ? focusShortcutLabel(IS_MAC) : undefined;
  return {
    className: shellClass(focus.on, {
      left: edge.left || menuPinned || sideMenu,
      top: edge.top || paletteOpen || topMenu,
    }),
    focus,
    label,
    menuItem: label ? { label, on: focus.on, toggle: focus.toggle } : undefined,
    menuPinned,
    setMenuPinned,
  };
}
