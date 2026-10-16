// A posição no histórico para os botões de voltar e avançar do app de
// desktop (history-nav.ts), e os atalhos de teclado deles. Fora de um campo
// de texto, para ⌘← e ⌘→ continuarem andando na linha enquanto se digita.

import { useEffect, useSyncExternalStore } from 'react';

import { canGoBack, canGoForward, navPosition, navShortcut, subscribeNav } from './history-nav.ts';
import { isTyping } from './use-section-shortcuts.ts';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function useHistoryNav(enabled: boolean) {
  const position = useSyncExternalStore(subscribeNav, navPosition, navPosition);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const dir = navShortcut(e, IS_MAC);
      if (!dir) return;
      e.preventDefault();
      const pos = navPosition();
      if (dir === 'back' && canGoBack(pos)) history.back();
      if (dir === 'forward' && canGoForward(pos)) history.forward();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
  return { back: canGoBack(position), forward: canGoForward(position) };
}

export const backShortcutLabel = IS_MAC ? '⌘[' : 'Alt+←';
export const forwardShortcutLabel = IS_MAC ? '⌘]' : 'Alt+→';
