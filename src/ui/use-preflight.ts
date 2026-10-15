// A conferência antes de publicar (preflight.ts), calculada uma vez por
// abertura do "Enviar ao CNPq" e por edição, e não a cada render do App.

import { useMemo } from 'react';

import type { XElement } from '../model/xml.ts';
import { preflight } from './preflight.ts';
import type { Section } from './sections.ts';

export function usePreflight(
  open: boolean,
  root: XElement | undefined,
  sections: Section[],
  /** Muda a cada edição; o documento é mutado no lugar. */
  version: number,
  onOpen: () => void,
) {
  const counted = useMemo(
    () => preflight(open && root !== undefined && root, sections, () => undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, root, sections, version],
  );
  return counted && { ...counted, onOpen };
}
