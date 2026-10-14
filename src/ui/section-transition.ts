// Transição suave entre as seções principais (Dados gerais, Formação…), pela
// View Transitions API: o navegador fotografa o conteúdo antes e depois da
// troca e anima entre os dois (CSS em styles.css, "Troca de seção"). Onde a API
// não existe (WebKitGTK antigo, por exemplo) ou com movimento reduzido, a troca
// é imediata, como antes.

import { flushSync } from 'react-dom';

interface ViewTransitionDocument {
  startViewTransition?: (update: () => void) => unknown;
}

/** A API existe e a pessoa não pediu movimento reduzido. */
export function sectionTransitionsEnabled(
  doc: ViewTransitionDocument | undefined = typeof document === 'undefined' ? undefined : document,
  reducedMotion = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches,
): boolean {
  return typeof doc?.startViewTransition === 'function' && !reducedMotion;
}

/**
 * Faz a troca de seção dentro de uma transição de página. O React aplica a
 * mudança na hora (flushSync), para a foto de depois já ter a seção nova.
 */
export function withSectionTransition(
  update: () => void,
  enabled = sectionTransitionsEnabled(),
  doc: ViewTransitionDocument = document,
): void {
  if (!enabled || !doc.startViewTransition) {
    update();
    return;
  }
  doc.startViewTransition.call(doc, () => flushSync(update));
}
