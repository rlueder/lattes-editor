// Acompanha os cartões abertos de uma seção e devolve o índice do mais
// recente ("Neste item"). Só contam os cartões de primeiro nível: um cartão
// aberto dentro de outro não troca o índice.

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import {
  activeCard,
  OUTLINE_HEAD_ATTR,
  outlineEntries,
  type OutlineEntry,
  sameEntries,
  trackOpen,
} from './item-outline.ts';

const CARD = 'details.item';

/** Cartão que não está dentro de outro cartão. */
function isTopLevelCard(el: EventTarget | null): el is HTMLDetailsElement {
  return (
    el instanceof HTMLDetailsElement && el.matches(CARD) && el.parentElement?.closest(CARD) === null
  );
}

/** Títulos das subseções do próprio cartão, sem os dos cartões de dentro dele. */
function cardEntries(card: HTMLDetailsElement): OutlineEntry[] {
  const heads = [...card.querySelectorAll<HTMLElement>(`[${OUTLINE_HEAD_ATTR}]`)].filter(
    (h) => h.closest(CARD) === card,
  );
  return outlineEntries(
    heads.map((h) => ({ id: h.id, text: h.getAttribute(OUTLINE_HEAD_ATTR) ?? '' })),
  );
}

export function useOpenItem(root: RefObject<HTMLElement | null>): OutlineEntry[] {
  const stack = useRef<HTMLDetailsElement[]>([]);
  const [entries, setEntries] = useState<OutlineEntry[]>([]);

  const refresh = useCallback(() => {
    const host = root.current;
    // Cartão que saiu da tela (filtro, troca de visão) deixa de valer.
    stack.current = stack.current.filter((c) => c.isConnected);
    const card = activeCard(stack.current, (c) => c.open && host !== null && host.contains(c));
    const next = card ? cardEntries(card) : [];
    setEntries((prev) => (sameEntries(prev, next) ? prev : next));
  }, [root]);

  useEffect(() => {
    // "toggle" não sobe pela árvore; na captura, o documento ouve todos os
    // cartões. A raiz da seção só existe quando a seção tem grupos, e pode
    // aparecer depois (o primeiro item numa seção vazia).
    const onToggle = (ev: Event) => {
      const card = ev.target;
      if (!isTopLevelCard(card) || !root.current?.contains(card)) return;
      stack.current = trackOpen(stack.current, card, card.open);
      refresh();
    };
    document.addEventListener('toggle', onToggle, true);
    return () => document.removeEventListener('toggle', onToggle, true);
  }, [root, refresh]);

  // O conteúdo do cartão muda com edições e com "mostrar vazios": relê os
  // títulos do cartão ativo a cada render da seção (barato, e só atualiza o
  // estado quando as entradas mudam).
  useEffect(refresh);

  return entries;
}
