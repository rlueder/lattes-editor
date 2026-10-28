// Disponibilidade nas produções técnicas: as opções de f_disp estão no censo
// de 15/10/2026. O XML de processos e produtos guarda os códigos em maiúsculas
// (docs/lattes_internals.md, seção 23), como o enumerado do software no XSD.
// Os XMLs públicos de relatório e trabalho técnico usam a mesma grafia.

import { enumLabel } from '../labels/labels.ts';
import { foldText } from '../model/fold-text.ts';

const ELEMENTS = new Set([
  'DETALHAMENTO-DO-PRODUTO-TECNOLOGICO',
  'DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS',
  'DETALHAMENTO-DO-RELATORIO-DE-PESQUISA',
  'DETALHAMENTO-DO-TRABALHO-TECNICO',
]);

export const availabilityChoices = [
  { label: 'Restrita', value: 'RESTRITA' },
  { label: 'Irrestrita', value: 'IRRESTRITA' },
  { label: enumLabel('NAO_INFORMADO'), value: 'NAO_INFORMADO' },
];

export const hasAvailabilityChoices = (element: string, attr: string): boolean =>
  attr === 'DISPONIBILIDADE' && ELEMENTS.has(element);

/** O código do XML no valor do select; aceita também a grafia antiga do editor. */
export function availabilityToForm(value: string): string | undefined {
  const normalized = foldText(value.trim()).replaceAll('_', ' ');
  if (normalized === '' || normalized === 'nao informado') return '';
  if (normalized === 'restrita') return 'Restrita';
  if (normalized === 'irrestrita') return 'Irrestrita';
  return undefined;
}
