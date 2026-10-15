// Valor de atributo como a pessoa deve ver: códigos de enum viram rótulo e
// datas DDMMAAAA viram dd/mm/aaaa.

import { enumLabel } from '../labels/labels.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { flagAsShown } from './field-kind.ts';
import { displayLattesDate, isLattesDateAttr } from './lattes-date.ts';

export function displayValue(element: string, attr: string, value: string): string {
  if (!value) return value;
  if (isLattesDateAttr(element, attr, [])) return displayLattesDate(value);
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  // Marcas que a exportação grava ao contrário, no sentido da tela do Lattes.
  const shown = flagAsShown(element, attr, value);
  return spec?.enum || shown !== value ? enumLabel(shown) : value;
}
