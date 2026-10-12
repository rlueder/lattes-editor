// Lógica do calendário do campo de data: grade do mês, movimentos do teclado,
// páginas de anos e nomes em pt-BR. As contas não usam Date: o Lattes aceita
// qualquer ano de 0001 a 9999, e o construtor do Date e o Date.UTC leem os
// anos de 0 a 99 como 1900 a 1999.

import { daysInMonth, isValidLattesDate } from './lattes-date.ts';

/** Data do calendário; `month` vai de 1 a 12. */
export interface CalendarDate {
  day: number;
  month: number;
  year: number;
}

export interface CalendarDay {
  date: CalendarDate;
  /** Do mês mostrado; os dias que completam a primeira e a última semana não são. */
  inMonth: boolean;
  /** Entre 01/01/0001 e 31/12/9999, o que cabe em DDMMAAAA. */
  inRange: boolean;
}

export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;
const MIN_DATE: CalendarDate = { day: 1, month: 1, year: MIN_YEAR };
const MAX_DATE: CalendarDate = { day: 31, month: 12, year: MAX_YEAR };

/** Anos por página na escolha do ano, em três colunas e quatro linhas. */
export const YEARS_PER_PAGE = 12;
export const YEAR_COLUMNS = 3;

export const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** Semana começando no domingo, como no calendário de parede brasileiro. */
export const WEEKDAYS = [
  { long: 'domingo', short: 'D' },
  { long: 'segunda-feira', short: 'S' },
  { long: 'terça-feira', short: 'T' },
  { long: 'quarta-feira', short: 'Q' },
  { long: 'quinta-feira', short: 'Q' },
  { long: 'sexta-feira', short: 'S' },
  { long: 'sábado', short: 'S' },
] as const;

/**
 * Número do dia contado a partir de 01/01/1970, no calendário gregoriano
 * estendido para trás (algoritmo "days from civil" de Howard Hinnant).
 */
function toDayNumber({ day, month, year }: CalendarDate): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * ((month + 9) % 12) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function fromDayNumber(n: number): CalendarDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const month = mp < 10 ? mp + 3 : mp - 9;
  return {
    day: dayOfYear - Math.floor((153 * mp + 2) / 5) + 1,
    month,
    year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0),
  };
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function sameDate(a: CalendarDate | undefined, b: CalendarDate | undefined): boolean {
  return a !== undefined && b !== undefined && compareDates(a, b) === 0;
}

function clampDate(date: CalendarDate): CalendarDate {
  if (compareDates(date, MIN_DATE) < 0) return MIN_DATE;
  if (compareDates(date, MAX_DATE) > 0) return MAX_DATE;
  return date;
}

/** Dia da semana, 0 = domingo. 01/01/1970 foi quinta-feira. */
export function weekday(date: CalendarDate): number {
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return clampDate(fromDayNumber(toDayNumber(date) + days));
}

/**
 * Soma meses mantendo o dia, ou o último dia do mês quando ele não existe lá:
 * 31/01 mais um mês é 28/02 (29/02 em ano bissexto).
 */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const total = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  if (year < MIN_YEAR) return MIN_DATE;
  if (year > MAX_YEAR) return MAX_DATE;
  return { day: Math.min(date.day, daysInMonth(year, month)), month, year };
}

export function addYears(date: CalendarDate, years: number): CalendarDate {
  return addMonths(date, years * 12);
}

/** Mesma data em outro ano; 29/02 vira 28/02 em ano comum. */
export function withYear(date: CalendarDate, year: number): CalendarDate {
  return addYears(date, year - date.year);
}

/**
 * Próxima data em foco para uma tecla da grade de dias, como no padrão de
 * seletor de data do WAI-ARIA APG: setas andam um dia ou uma semana, Home e
 * End vão ao começo e ao fim da semana, PageUp e PageDown trocam o mês, e
 * com Shift trocam o ano. Outra tecla devolve undefined.
 */
export function moveDate(date: CalendarDate, key: string, shift = false): CalendarDate | undefined {
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1);
    case 'ArrowRight':
      return addDays(date, 1);
    case 'ArrowUp':
      return addDays(date, -7);
    case 'ArrowDown':
      return addDays(date, 7);
    case 'Home':
      return addDays(date, -weekday(date));
    case 'End':
      return addDays(date, 6 - weekday(date));
    case 'PageUp':
      return shift ? addYears(date, -1) : addMonths(date, -1);
    case 'PageDown':
      return shift ? addYears(date, 1) : addMonths(date, 1);
    default:
      return undefined;
  }
}

/**
 * Seis semanas do mês, de domingo a sábado, com os dias do mês anterior e do
 * seguinte completando as pontas. Seis linhas sempre, para o calendário não
 * mudar de altura de um mês para outro.
 */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = { day: 1, month, year };
  const start = toDayNumber(first) - weekday(first);
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = fromDayNumber(start + w * 7 + d);
      week.push({
        date,
        inMonth: date.month === month && date.year === year,
        inRange: date.year >= MIN_YEAR && date.year <= MAX_YEAR,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Os doze anos da página que contém `year` (2016 a 2027 para 2020). */
export function yearPage(year: number): number[] {
  const start = year - (((year % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE);
  return Array.from({ length: YEARS_PER_PAGE }, (_, i) => start + i);
}

/**
 * Primeiro e último ano mostrados na página de `year`, sem passar dos limites:
 * a página de 2020 vai de 2016 a 2027; a de 1000, com mínimo 1000, começa em
 * 1000 e não em 996.
 */
export function yearPageRange(
  year: number,
  min = MIN_YEAR,
  max = MAX_YEAR,
): { first: number; last: number } {
  const page = yearPage(year);
  return { first: Math.max(min, page[0]!), last: Math.min(max, page[page.length - 1]!) };
}

/** Ano dentro dos limites da grade; por padrão, 0001 a 9999. */
export function isYearInRange(year: number, min = MIN_YEAR, max = MAX_YEAR): boolean {
  return year >= min && year <= max;
}

/**
 * Próximo ano em foco para uma tecla da grade de anos (três colunas):
 * setas andam um ano ou uma linha, Home e End vão à ponta da página, PageUp
 * e PageDown trocam de página. Outra tecla devolve undefined. O resultado
 * fica entre `min` e `max` (por padrão, 0001 a 9999).
 */
export function moveYear(
  year: number,
  key: string,
  min = MIN_YEAR,
  max = MAX_YEAR,
): number | undefined {
  const page = yearPage(year);
  let next: number;
  switch (key) {
    case 'ArrowLeft':
      next = year - 1;
      break;
    case 'ArrowRight':
      next = year + 1;
      break;
    case 'ArrowUp':
      next = year - YEAR_COLUMNS;
      break;
    case 'ArrowDown':
      next = year + YEAR_COLUMNS;
      break;
    case 'Home':
      next = page[0]!;
      break;
    case 'End':
      next = page[page.length - 1]!;
      break;
    case 'PageUp':
      next = year - YEARS_PER_PAGE;
      break;
    case 'PageDown':
      next = year + YEARS_PER_PAGE;
      break;
    default:
      return undefined;
  }
  return Math.min(max, Math.max(min, next));
}

/** "abril de 2016". */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

/** "sábado, 20 de agosto de 2016", para leitores de tela. */
export function formatFullDate(date: CalendarDate): string {
  return `${WEEKDAYS[weekday(date)]!.long}, ${date.day} de ${formatMonthYear(date.year, date.month)}`;
}

/** "15032024" em data do calendário; vazio ou inválido devolve undefined. */
export function dateFromLattes(value: string): CalendarDate | undefined {
  if (!isValidLattesDate(value)) return undefined;
  return {
    day: Number(value.slice(0, 2)),
    month: Number(value.slice(2, 4)),
    year: Number(value.slice(4)),
  };
}

export function lattesFromDate({ day, month, year }: CalendarDate): string {
  return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${String(year).padStart(4, '0')}`;
}

/** Data local de hoje (ou de `now`), para abrir o calendário no mês corrente. */
export function calendarDateOf(now: Date): CalendarDate {
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}
