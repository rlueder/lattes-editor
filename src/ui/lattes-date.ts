// Datas do Lattes (DDMMAAAA) no campo de data do editor, que mostra e aceita
// dd/mm/aaaa.
//
// A conversão só existe para datas válidas. Valor torto (incompleto, com
// letras, 31 de fevereiro) não vira data: o campo continua texto e o valor
// fica como veio, sem reescrita.

import { lattesSchema } from '../schema/lattes.ts';

const LATTES_FORMAT = 'DDMMAAAA';

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Dia, mês e ano existem (não há ano 0000). */
function isRealDate(day: number, month: number, year: number): boolean {
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** "15032024" é uma data de verdade em DDMMAAAA. */
export function isValidLattesDate(value: string): boolean {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  return m !== null && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Dígitos de dd/mm/aaaa (até oito) com as barras de quem já tem dígito depois. */
function maskDigits(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Máscara do campo de data: fica só com os dígitos (até oito) e põe as barras
 * de dd/mm/aaaa. A barra só entra quando já há dígito depois dela, para o
 * apagar com backspace não esbarrar numa barra que volta sozinha. Colar
 * "15032024" ou "15/03/2024" dá no mesmo.
 *
 * `caret` é a posição do cursor no texto digitado; volta a posição
 * equivalente no texto mascarado (depois do mesmo número de dígitos).
 */
export function maskDateInput(text: string, caret = text.length): { caret: number; value: string } {
  const value = maskDigits(text.replace(/\D/g, '').slice(0, 8));
  const before = text.slice(0, caret).replace(/\D/g, '').length;
  let pos = 0;
  for (let seen = 0; seen < before && pos < value.length; pos++) {
    if (value[pos] !== '/') seen++;
  }
  return { caret: pos, value };
}

/**
 * Texto do campo (dd/mm/aaaa) para o Lattes: "15/03/2024" vira "15032024" e
 * campo limpo vira vazio. Data incompleta ou impossível devolve undefined, e
 * o campo volta ao valor guardado.
 */
export function lattesFromMasked(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const value = m ? `${m[1]}${m[2]}${m[3]}` : '';
  return isValidLattesDate(value) ? value : undefined;
}

/** "15032024" em "15/03/2024"; valor que não é data válida volta como veio. */
export function displayLattesDate(value: string): string {
  return isValidLattesDate(value)
    ? `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`
    : value;
}

/**
 * Elementos cujo schema declara um FORMATO-DATA-* fixo em DDMMAAAA. O nome do
 * formato nem sempre repete o da data (FORMATO-DATA-DE-NASCIMENTO acompanha
 * DATA-NASCIMENTO, FORMATO-DATA-PEDIDO acompanha DATA-PEDIDO-DE-DEPOSITO),
 * então vale o elemento inteiro: as datas dele são todas DDMMAAAA.
 */
const DATED_ELEMENTS = new Set(
  Object.entries(lattesSchema.elements)
    .filter(([, spec]) =>
      spec.attributes.some(
        (a) =>
          a.name.startsWith('FORMATO-DATA-') && a.enum?.length === 1 && a.enum[0] === LATTES_FORMAT,
      ),
    )
    .map(([name]) => name),
);

/**
 * Atributo de data em DDMMAAAA: nome começa com DATA- e o elemento tem o
 * FORMATO-<nome> ao lado no arquivo, ou o schema do elemento fixa o formato
 * em DDMMAAAA. DATA-ESTREIA e DATA-ENCERRAMENTO (artes cênicas, música) não
 * têm formato declarado em lugar nenhum e ficam texto.
 */
export function isLattesDateAttr(element: string, attr: string, siblings: string[]): boolean {
  if (!attr.startsWith('DATA-')) return false;
  return siblings.includes(`FORMATO-${attr}`) || DATED_ELEMENTS.has(element);
}

/**
 * FORMATO-DATA-* que só repete o DDMMAAAA (ou está vazio) não diz nada a quem
 * edita: sai do formulário e continua no XML. Um valor diferente aparece,
 * para a anomalia ficar à vista.
 */
export function isRedundantDateFormat(attr: string, value: string): boolean {
  return attr.startsWith('FORMATO-DATA-') && (value === '' || value === LATTES_FORMAT);
}
