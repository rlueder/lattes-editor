// Valor de atributo como a pessoa deve ver, quando só se tem o nome do
// elemento (a lista do "Enviar ao Lattes"): marcas sim/não viram "Sim" e
// "Não", códigos de enum viram rótulo e datas DDMMAAAA viram dd/mm/aaaa. As
// marcas e os códigos escritos por extenso usam as mesmas funções do modo de
// leitura (reading.ts), para as duas telas dizerem a mesma coisa.

import { enumLabel } from '../labels/labels.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { codeValueLabel, enumElsewhere, flagLabel, isBooleanAttr } from './field-kind.ts';
import { displayLattesDate, isLattesDateAttr } from './lattes-date.ts';

export function displayValue(element: string, attr: string, value: string): string {
  if (!value) return value;
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  if (isBooleanAttr(attr, spec, value)) return flagLabel(element, attr, value);
  if (isLattesDateAttr(element, attr, [])) return displayLattesDate(value);
  // A mesma regra do modo de leitura (reading.ts): o valor de um enumerado de
  // outro elemento (STATUS-DO-CURSO no pós-doutorado) também vira rótulo.
  if (spec?.enum?.includes(value) || enumElsewhere(attr, value)) return enumLabel(value);
  return codeValueLabel(element, attr, value);
}
