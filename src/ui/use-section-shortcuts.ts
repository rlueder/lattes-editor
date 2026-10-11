// Atalhos numéricos para as seções do menu lateral, como no app do Claude.
//
// Numa aba do navegador, ⌘1–⌘9 (Mac) e Ctrl+1–Ctrl+9 (Windows, Linux) trocam
// de aba antes de a página ver a tecla. Por isso o modificador é ⌃ Control no
// Mac e Alt fora dele; ⌘ também funciona quando o navegador deixa passar (app
// instalado, por exemplo). Segurar o modificador mostra os números.

import { useEffect, useState } from 'react';

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Símbolo do modificador, para os rótulos na tela. */
export const SECTION_MODIFIER_LABEL = IS_MAC ? '⌃' : 'Alt';

const MODIFIER_KEYS = IS_MAC ? ['Control', 'Meta'] : ['Alt'];

/** O dígito 1–9 do evento, pelo código da tecla (Alt muda o caractere no Mac). */
export function digitOf(e: Pick<KeyboardEvent, 'code'>): number | undefined {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  return m ? Number(m[1]) : undefined;
}

export function isSectionShortcut(
  e: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  mac = IS_MAC,
): boolean {
  if (e.shiftKey) return false;
  return mac ? (e.ctrlKey || e.metaKey) && !e.altKey : e.altKey && !e.ctrlKey && !e.metaKey;
}

/**
 * Registra os atalhos e devolve se os números devem aparecer (modificador
 * segurado sozinho). `onSection` recebe o índice (0 = primeira seção).
 */
export function useSectionShortcuts(count: number, onSection: (index: number) => void): boolean {
  const [showHints, setShowHints] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (MODIFIER_KEYS.includes(e.key)) {
        setShowHints(true);
        return;
      }
      const digit = digitOf(e);
      if (digit !== undefined && isSectionShortcut(e) && digit <= count) {
        e.preventDefault();
        onSection(digit - 1);
        return;
      }
      // Outra tecla com o modificador (⌘K, ⌃C…): some com os números.
      setShowHints(false);
    };
    const up = (e: KeyboardEvent) => {
      if (MODIFIER_KEYS.includes(e.key)) setShowHints(false);
    };
    const hide = () => setShowHints(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', hide);
    };
  }, [count, onSection]);

  return showHints;
}
