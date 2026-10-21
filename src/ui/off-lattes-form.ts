// O que o formulário do item esconde num item que já está no Lattes: o campo
// que o formulário de lá não tem, e a parte em que nenhum campo existe lá.

import { childElements, type XElement } from '../model/xml.ts';
import { isSystemAttr } from './field-kind.ts';
import type { FormLacks } from './form-lacks-context.ts';

/** O campo não existe no formulário do Lattes (o mesmo critério do AttributeField). */
export const lacksField = (lacks: FormLacks | undefined, el: XElement, attr: string) =>
  Boolean(lacks?.field(el, attr));

/**
 * Nenhum campo que o formulário do item mostraria existe no formulário do
 * Lattes, nem nos filhos: os códigos que o Lattes gera, escondidos sem
 * "Mostrar códigos do Lattes", não contam.
 */
export function offLattesForm(
  el: XElement,
  lacks: FormLacks | undefined,
  showCodes: boolean,
): boolean {
  if (!lacks) return false;
  const attrs = el.attrs.filter((a) => showCodes || !isSystemAttr(el.name, a.name));
  const kids = childElements(el);
  if (attrs.length === 0 && kids.length === 0) return false;
  return (
    attrs.every((a) => lacksField(lacks, el, a.name)) &&
    kids.every((k) => offLattesForm(k, lacks, showCodes))
  );
}
