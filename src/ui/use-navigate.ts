// Ir a uma seção (e a um grupo ou ano dentro dela), com a URL em sincronia.
// A troca de seção anima (section-transition.ts); ir a um grupo da mesma seção
// é imediato.

import { type MutableRefObject, useCallback, useEffect, useRef } from 'react';

import { type HashRoute, parseHash, writeHash } from './hash-route.ts';
import { withSectionTransition } from './section-transition.ts';
import type { Section } from './sections.ts';

export function useNavigate(
  sectionId: string,
  setSectionId: (id: string) => void,
  pendingAnchor: MutableRefObject<string | null>,
  /** Antes de cada navegação (o modo foco fecha o painel revelado). */
  before?: () => void,
): (route: HashRoute, write?: boolean) => void {
  const current = useRef(sectionId);
  current.current = sectionId;
  return useCallback(
    (route: HashRoute, write = true) => {
      before?.();
      const go = () => {
        setSectionId(route.sectionId);
        pendingAnchor.current = route.anchor ?? null;
        if (!route.anchor) window.scrollTo({ top: 0 });
      };
      if (route.sectionId !== current.current) withSectionTransition(go);
      else go();
      if (write) writeHash(route);
    },
    [before, pendingAnchor, setSectionId],
  );
}

/** Rola até o grupo escolhido no ⌘K depois que a seção renderiza. */
export function useScrollToPendingAnchor(pendingAnchor: MutableRefObject<string | null>): void {
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  });
}

/**
 * Um link "#atuacao/atuacao-profissional/2020", aberto ou editado à mão, leva
 * direto lá, quando a seção existe no currículo aberto.
 */
export function useFollowHash(
  sections: Section[],
  navigate: (route: HashRoute, write?: boolean) => void,
): void {
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const hasSections = sections.length > 0;
  useEffect(() => {
    if (!hasSections) return;
    const follow = () => {
      const route = parseHash(location.hash);
      if (route && sectionsRef.current.some((s) => s.id === route.sectionId))
        navigate(route, false);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [hasSections, navigate]);
}
