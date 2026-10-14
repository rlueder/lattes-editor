// Ir a uma seção (e a um grupo ou ano dentro dela), com a URL em sincronia.
// A troca de seção anima (section-transition.ts); ir a um grupo da mesma seção
// é imediato.

import { type MutableRefObject, useCallback, useEffect, useRef } from 'react';

import { type HashRoute, writeHash } from './hash-route.ts';
import { withSectionTransition } from './section-transition.ts';

export function useNavigate(
  sectionId: string,
  setSectionId: (id: string) => void,
  pendingAnchor: MutableRefObject<string | null>,
): (route: HashRoute, write?: boolean) => void {
  const current = useRef(sectionId);
  current.current = sectionId;
  return useCallback(
    (route: HashRoute, write = true) => {
      const go = () => {
        setSectionId(route.sectionId);
        pendingAnchor.current = route.anchor ?? null;
        if (!route.anchor) window.scrollTo({ top: 0 });
      };
      if (route.sectionId !== current.current) withSectionTransition(go);
      else go();
      if (write) writeHash(route);
    },
    [pendingAnchor, setSectionId],
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
