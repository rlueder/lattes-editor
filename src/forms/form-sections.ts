// O que a linha fechada de uma parte do formulário de item novo mostra
// (FormSection.tsx): quantos campos têm valor, o resumo deles e se a parte
// precisa abrir sozinha.

import { getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { type GroupFacts, groupSummary } from '../ui/disclosure.ts';
import { displayValue } from '../ui/reading.ts';

/** O que a linha fechada e a abertura sozinha precisam saber de uma parte. */
export function sectionFacts(
  legend: string,
  el: XElement,
  fields: { attr: string; required?: boolean }[],
  hasError: (attr: string) => boolean,
): GroupFacts & { summary: string } {
  const specs = schema.elements[el.name]?.attributes ?? [];
  const values = fields.map((f) => getAttr(el, f.attr) ?? '');
  return {
    error: fields.some((f) => hasError(f.attr)),
    filled: values.filter((v) => v.trim() !== '').length,
    label: legend,
    required: fields.some(
      (f) => f.required === true || specs.find((s) => s.name === f.attr)?.required === true,
    ),
    summary: groupSummary(
      fields.map((f, i) => ({ attr: f.attr, value: displayValue(el, f.attr, values[i]!) })),
    ),
    target: false,
  };
}
