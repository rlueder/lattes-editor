// Anos do Lattes (AAAA) no campo de ano do editor, com a grade de anos do
// calendário para escolher sem digitar.
//
// O schema não declara tipo para os atributos de ano; eles se reconhecem
// pelo nome. Valor guardado que não tem quatro dígitos não vira campo de ano:
// fica texto, como veio, sem reescrita.

import { lattesSchema } from '../schema/lattes.ts';
import { MAX_YEAR } from './calendar-dates.ts';

/** Menor ano aceito no campo: quatro dígitos sem zero à esquerda. */
export const MIN_LATTES_YEAR = 1000;
export const MAX_LATTES_YEAR = MAX_YEAR;

const YEAR_NAME = /^ANO($|-)/;

/**
 * Atributo de ano: chama-se ANO ou começa com ANO-, e o schema não dá a ele
 * uma lista de opções. Hoje nenhum ANO-* tem lista; a exclusão protege
 * contra um schema futuro que traga uma.
 */
export function isLattesYearAttr(element: string, attr: string): boolean {
  if (!YEAR_NAME.test(attr)) return false;
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  return !spec?.enum;
}

/** Valor guardado com exatamente quatro dígitos: o campo de ano consegue mostrá-lo. */
export function isFourDigitYear(value: string): boolean {
  return /^\d{4}$/.test(value);
}

/** "2024" é um ano que o campo aceita gravar (1000 a 9999). */
export function isValidLattesYear(value: string): boolean {
  if (!isFourDigitYear(value)) return false;
  const n = Number(value);
  return n >= MIN_LATTES_YEAR && n <= MAX_LATTES_YEAR;
}

/**
 * Máscara do campo de ano: só dígitos, até quatro. `caret` é a posição do
 * cursor no texto digitado; volta a posição equivalente no texto filtrado
 * (depois do mesmo número de dígitos).
 */
export function maskYearInput(text: string, caret = text.length): { caret: number; value: string } {
  const value = text.replace(/\D/g, '').slice(0, 4);
  const before = text.slice(0, caret).replace(/\D/g, '').length;
  return { caret: Math.min(before, value.length), value };
}

/**
 * Texto do campo para o Lattes: ano válido fica como está e campo limpo vira
 * vazio. Qualquer outra coisa devolve undefined, e o campo volta ao valor
 * guardado.
 */
export function lattesYearFromInput(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  return isValidLattesYear(trimmed) ? trimmed : undefined;
}

/**
 * Ano em foco ao abrir a grade: o guardado, quando é um ano válido, ou o ano
 * corrente, sempre dentro de 1000 a 9999.
 */
export function initialPickerYear(value: string, currentYear: number): number {
  const year = isValidLattesYear(value) ? Number(value) : currentYear;
  return Math.min(MAX_LATTES_YEAR, Math.max(MIN_LATTES_YEAR, year));
}
