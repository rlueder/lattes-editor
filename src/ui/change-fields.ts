// Que campos de uma alteração aparecem na lista do "Enviar ao Lattes" e
// quanto espaço cada um ocupa na grade (FieldChange.tsx).

import type { Change } from '../model/changes.ts';
import { isSystemAttr } from './field-kind.ts';
import { cellSpan } from './reading.ts';

/** Acima disto (ou com quebra de linha), o valor para em quatro linhas e ganha "Ler mais". */
const LONG_TEXT = 240;

export function isLongText(text: string): boolean {
  return text.length > LONG_TEXT || text.includes('\n');
}

/**
 * Os campos que se mostram. Os códigos que o Lattes gera (sequência, código de
 * instituição e de curso, identificadores: isSystemAttr, a mesma regra do
 * modo de leitura e do formulário) ficam de fora, a não ser com "Mostrar
 * códigos do Lattes" ligado. Escondidos só na tela: continuam indo ao Lattes.
 * Quando a alteração só mexe em códigos, eles aparecem, para o item não ficar
 * sem nada embaixo do título.
 */
export function visibleFields(change: Change, showCodes: boolean): Change['fields'] {
  if (showCodes) return change.fields;
  const shown = change.fields.filter((f) => !isSystemAttr(change.element, f.attr));
  return shown.length > 0 ? shown : change.fields;
}

/**
 * Quantas colunas da grade um campo ocupa, pelo valor mais longo que mostra:
 * a regra da grade do modo de leitura (cellSpan), e texto longo (resumo,
 * descrição) sempre na linha inteira. 3 quer dizer a linha inteira.
 */
export function fieldSpan(values: string[]): 1 | 2 | 3 {
  if (values.some(isLongText)) return 3;
  return Math.max(1, ...values.map(cellSpan)) as 1 | 2 | 3;
}
