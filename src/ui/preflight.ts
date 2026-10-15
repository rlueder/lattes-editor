// Contas do App que não são estado nem desenho: a conferência antes de
// publicar (LAT-54), com a mesma lista do diagnóstico do currículo.

import type { XElement } from '../model/xml.ts';
import { validateCv } from '../review/validation.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { Section } from './sections.ts';

/**
 * A conferência antes de publicar (LAT-54): quantos achados o diagnóstico do
 * currículo tem (validateCv, a mesma lista do painel), e abri-lo.
 */
export function preflight(root: XElement | false, sections: Section[], onOpen: () => void) {
  // Só com o painel aberto: a conferência percorre o currículo inteiro.
  if (!root) return undefined;
  const { items } = validateCv(lattesSchema, root, sections);
  return { count: items.reduce((n, r) => n + r.checks.length, 0), onOpen };
}
