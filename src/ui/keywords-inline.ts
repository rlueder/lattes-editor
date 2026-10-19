// O campo de palavras-chave do formulário da linha (KeywordsInline.tsx): quando
// ele aparece e como o texto vira a lista.

import { childElements, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';

/** O tipo do item tem palavras-chave no XSD, e este ainda não tem nenhuma. */
export function canAddKeywords(el: XElement): boolean {
  const children = lattesSchema.elements[el.name]?.children ?? [];
  return (
    children.some((c) => c.name === 'PALAVRAS-CHAVE') &&
    childElements(el, 'PALAVRAS-CHAVE').length === 0
  );
}

/** Até 6, como o Lattes aceita, sem vazias. */
export function parseKeywords(text: string): string[] {
  return text
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 6);
}
