// Valor de atributo como a pessoa deve ver: códigos de enum viram rótulo e
// datas DDMMAAAA viram dd/mm/aaaa.

import { enumLabel } from '../labels/labels.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { displayLattesDate, isLattesDateAttr } from './lattes-date.ts';

export function displayValue(element: string, attr: string, value: string): string {
  if (!value) return value;
  if (isLattesDateAttr(element, attr, [])) return displayLattesDate(value);
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  return spec?.enum ? enumLabel(value) : value;
}
