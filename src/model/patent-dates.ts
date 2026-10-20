// As datas da patente: cada atributo de data do REGISTRO-OU-PATENTE é uma
// situação da grade de datas do Lattes (seção 21 de docs/lattes_internals.md),
// com o código e o rótulo da opção do combo. A exportação guarda a mesma data
// também na linha do HISTORICO-SITUACOES-PATENTE com aquele rótulo como
// descrição (observado em 20/10/2026). Fica no modelo porque o editor
// (linked-attrs.ts) e o conector usam a mesma tabela.

import { foldText } from './fold-text.ts';

/**
 * Data do XML → situação da grade de datas da patente (seção 21): o código e o
 * rótulo da opção do combo.
 */
export const PATENT_DATE_CODES: Record<string, [string, string]> = {
  'DATA-DE-CONCESSAO': ['3', 'Concessão'],
  'DATA-DE-PEDIDO-DE-EXAME': ['5', 'Pedido do Exame'],
  'DATA-DEPOSITO-PCT': ['2', 'Depósito PCT'],
  'DATA-PEDIDO-DE-DEPOSITO': ['1', 'Depósito'],
};

/**
 * O atributo do REGISTRO-OU-PATENTE cuja data é a de uma situação do
 * histórico da patente, pela descrição dela (o rótulo da linha da grade de
 * situações, observado em 20/10/2026), sem acento nem caixa.
 */
export function patentDateAttrOf(description: string): string | undefined {
  return Object.entries(PATENT_DATE_CODES).find(
    ([, [, label]]) => foldText(label) === foldText(description),
  )?.[0];
}
