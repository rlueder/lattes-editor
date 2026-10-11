// Atalhos de seção: G e uma letra, como no Linear. Os números (⌃1–⌃9) saíram:
// não cobriam as doze seções e brigavam com os atalhos de aba do navegador.

import { useEffect, useState } from 'react';

/**
 * Atalhos de duas teclas para todas as seções, como o "G e uma letra" do
 * Linear: G, solta, depois a letra. Cobre as seções além da nona, que o ⌃1–⌃9
 * não alcança.
 */
export const GO_KEYS: Record<string, string> = {
  atuacao: 'A',
  bancas: 'B',
  'dados-gerais': 'D',
  educacao: 'E',
  eventos: 'V',
  formacao: 'F',
  inovacao: 'I',
  orientacoes: 'O',
  outros: 'X',
  patentes: 'T',
  producoes: 'P',
  projetos: 'J',
};

const GO_WINDOW_MS = 1500;

/** Campo de texto com foco: as letras são do texto, não atalhos. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
    el.getAttribute?.('role') === 'combobox'
  );
}

/** Seção da letra digitada depois do G, se houver. */
export function sectionForKey(key: string, ids: string[]): string | undefined {
  const letter = key.toUpperCase();
  return ids.find((id) => GO_KEYS[id] === letter);
}

/** Registra G + letra; devolve se o G está armado (para mostrar as letras). */
export function useGoShortcuts(ids: string[], onSelect: (id: string) => void): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer = 0;
    const disarm = () => {
      clearTimeout(timer);
      setArmed(false);
    };
    let pending = false;
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (pending) {
        const id = sectionForKey(e.key, ids);
        pending = false;
        disarm();
        if (id) {
          e.preventDefault();
          onSelect(id);
        }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        pending = true;
        setArmed(true);
        timer = window.setTimeout(() => {
          pending = false;
          setArmed(false);
        }, GO_WINDOW_MS);
      }
    };
    window.addEventListener('keydown', down);
    return () => {
      window.removeEventListener('keydown', down);
      clearTimeout(timer);
    };
  }, [ids, onSelect]);
  return armed;
}
