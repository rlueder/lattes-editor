// Valor de atributo como a pessoa deve ver: códigos de enum viram rótulo.

import { enumLabel } from '../labels/labels.ts';
import { lattesSchema } from '../schema/lattes.ts';

export function displayValue(element: string, attr: string, value: string): string {
  if (!value) return value;
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  return spec?.enum ? enumLabel(value) : value;
}
