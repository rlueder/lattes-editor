// Modo foco (focus-mode.ts): a escolha guardada, o atalho, a borda que revela
// os painéis e a altura do cabeçalho, que fica reservada para o conteúdo não
// sair do lugar ao entrar e ao sair.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DISMISSED,
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

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export interface FocusMode {
  available: boolean;
  on: boolean;
  toggle: () => void;
}

/**
 * Liga e desliga o modo foco (⌘⇧F, ⚙ e ⌘K), lembrado neste aparelho. O
 * conteúdo fica onde estava: a coluna do menu e a altura do cabeçalho ficam
 * reservadas (styles.css, ".shell.is-focus"), então nada se move na troca.
 */
export function useFocusMode(available: boolean): FocusMode {
  const [on, setOn] = useState(() => available && readFocusMode());

  const toggle = useCallback(() => {
    if (!available) return;
    setOn((v) => {
      writeFocusMode(!v);
      return !v;
    });
  }, [available]);

  // A altura do cabeçalho, para o modo foco guardar o lugar dele e o menu
  // revelado começar logo abaixo. Medida sempre que muda (fonte, largura).
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const write = () => root.style.setProperty('--topbar-real-h', `${bar.offsetHeight}px`);
    write();
    const observer = new ResizeObserver(write);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [available]);

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

/**
 * Os painéis que a borda revela no modo foco: o menu à esquerda e o cabeçalho
 * em cima. `dismiss` fecha os dois depois de uma escolha (nextEdge, blocked).
 */
export function useEdgeReveal(on: boolean): { dismiss: () => void; state: EdgeState } {
  const [state, setState] = useState<EdgeState>(NO_EDGE);
  const current = useRef<EdgeState>(NO_EDGE);
  const dismiss = useCallback(() => {
    current.current = DISMISSED;
    setState(DISMISSED);
  }, []);
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
  return { dismiss, state };
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
  /**
   * Antes de navegar: no modo foco, fecha o menu e o cabeçalho revelados e
   * leva o foco ao título da seção, para o :focus-within não segurar o painel.
   */
  onNavigate: () => void;
}

/**
 * Tudo que a moldura precisa do modo foco: ligado ou não, os painéis à
 * mostra (borda, puxador, ⌘K) e o atalho. Só existe com ?leitura.
 */
export function useFocusShell(paletteOpen: boolean, sectionId: string): FocusShell {
  const focus = useFocusMode(true);
  const { dismiss, state: edge } = useEdgeReveal(focus.on);
  const topMenu = usePopupOpen('.topbar', focus.on);
  const sideMenu = usePopupOpen('.sidebar', focus.on);
  const [menuPinned, setMenuPinned] = useState(false);
  // O menu aberto pelo puxador fecha ao sair do modo foco ou ao escolher seção.
  useEffect(() => setMenuPinned(false), [focus.on, sectionId]);
  // O foco sai do painel para o título da seção nova. A troca de seção pode
  // chegar depois (transição de página): tenta de novo quando a seção muda,
  // por até um segundo.
  const refocusUntil = useRef(0);
  const [navigations, setNavigations] = useState(0);
  // Estável: navegar não pode depender de o modo foco ter acabado de mudar
  // (o seguidor do endereço, em App.tsx, refaria a navegação).
  const focusOn = useRef(focus.on);
  focusOn.current = focus.on;
  const onNavigate = useCallback(() => {
    if (!focusOn.current) return;
    const active = document.activeElement;
    if (active?.closest('.sidebar, .topbar')) refocusUntil.current = performance.now() + 1000;
    setMenuPinned(false);
    dismiss();
    setNavigations((n) => n + 1);
  }, [dismiss]);
  useEffect(() => {
    if (performance.now() > refocusUntil.current) return;
    const title = document.querySelector<HTMLElement>('.section-head h1');
    title?.focus({ preventScroll: true });
  }, [sectionId, navigations]);
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
    onNavigate,
    setMenuPinned,
  };
}
