// Publica a altura do cabeçalho em --topbar-h; o que gruda embaixo dele usa a
// variável. Medida de novo a cada troca de tela (deps).

import { type RefObject, useEffect } from 'react';

export function useTopbarHeight(ref: RefObject<HTMLElement | null>, deps: unknown): void {
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    // Cabeçalho desmontado (troca de tela, recarga do código) mede 0; não publica.
    const observer = new ResizeObserver(() => {
      if (bar.offsetHeight > 0) {
        document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
      }
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [ref, deps]);
}
