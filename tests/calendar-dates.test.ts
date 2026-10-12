import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  addYears,
  type CalendarDate,
  calendarDateOf,
  compareDates,
  dateFromLattes,
  formatFullDate,
  formatMonthYear,
  isYearInRange,
  lattesFromDate,
  MONTH_NAMES,
  monthGrid,
  moveDate,
  moveYear,
  sameDate,
  weekday,
  WEEKDAYS,
  withYear,
  yearPage,
  yearPageRange,
} from '../src/ui/calendar-dates.ts';

const d = (day: number, month: number, year: number): CalendarDate => ({ day, month, year });

describe('weekday', () => {
  it('bate com o Date em datas conhecidas (0 = domingo)', () => {
    expect(weekday(d(1, 1, 1970))).toBe(4);
    expect(weekday(d(20, 8, 2016))).toBe(6);
    expect(weekday(d(12, 10, 2026))).toBe(1);
    expect(weekday(d(29, 2, 2000))).toBe(2);
    for (let i = 0; i < 400; i++) {
      const js = new Date(Date.UTC(1890, 0, 1 + i * 97));
      const date = d(js.getUTCDate(), js.getUTCMonth() + 1, js.getUTCFullYear());
      expect(weekday(date)).toBe(js.getUTCDay());
    }
  });

  it('funciona nos anos que o Date lê como 19xx', () => {
    // 01/01/0001 no gregoriano estendido foi segunda-feira.
    expect(weekday(d(1, 1, 1))).toBe(1);
    expect(weekday(d(31, 12, 9999))).toBe(5);
  });
});

describe('addDays', () => {
  it('atravessa mês, ano e 29 de fevereiro', () => {
    expect(addDays(d(31, 1, 2024), 1)).toEqual(d(1, 2, 2024));
    expect(addDays(d(28, 2, 2024), 1)).toEqual(d(29, 2, 2024));
    expect(addDays(d(28, 2, 2023), 1)).toEqual(d(1, 3, 2023));
    expect(addDays(d(31, 12, 2016), 1)).toEqual(d(1, 1, 2017));
    expect(addDays(d(1, 1, 2017), -7)).toEqual(d(25, 12, 2016));
  });

  it('não passa de 01/01/0001 nem de 31/12/9999', () => {
    expect(addDays(d(3, 1, 1), -7)).toEqual(d(1, 1, 1));
    expect(addDays(d(30, 12, 9999), 7)).toEqual(d(31, 12, 9999));
  });
});

describe('addMonths e addYears', () => {
  it('prendem o dia no fim do mês quando ele não existe lá', () => {
    expect(addMonths(d(31, 1, 2024), 1)).toEqual(d(29, 2, 2024));
    expect(addMonths(d(31, 1, 2023), 1)).toEqual(d(28, 2, 2023));
    expect(addMonths(d(31, 3, 2024), -1)).toEqual(d(29, 2, 2024));
    expect(addMonths(d(31, 5, 2024), 1)).toEqual(d(30, 6, 2024));
    expect(addMonths(d(15, 12, 2016), 1)).toEqual(d(15, 1, 2017));
    expect(addMonths(d(15, 1, 2017), -1)).toEqual(d(15, 12, 2016));
    expect(addYears(d(29, 2, 2024), 1)).toEqual(d(28, 2, 2025));
    expect(addYears(d(29, 2, 2024), -4)).toEqual(d(29, 2, 2020));
  });

  it('não saem do intervalo de anos do Lattes', () => {
    expect(addMonths(d(15, 1, 1), -1)).toEqual(d(1, 1, 1));
    expect(addMonths(d(15, 12, 9999), 1)).toEqual(d(31, 12, 9999));
    expect(addYears(d(15, 6, 9990), 20)).toEqual(d(31, 12, 9999));
  });

  it('withYear troca só o ano', () => {
    expect(withYear(d(20, 8, 2016), 1985)).toEqual(d(20, 8, 1985));
    expect(withYear(d(29, 2, 2024), 2023)).toEqual(d(28, 2, 2023));
  });
});

describe('moveDate (teclado da grade de dias)', () => {
  const sat = d(20, 8, 2016);
  it('setas andam um dia ou uma semana', () => {
    expect(moveDate(sat, 'ArrowLeft')).toEqual(d(19, 8, 2016));
    expect(moveDate(sat, 'ArrowRight')).toEqual(d(21, 8, 2016));
    expect(moveDate(sat, 'ArrowUp')).toEqual(d(13, 8, 2016));
    expect(moveDate(sat, 'ArrowDown')).toEqual(d(27, 8, 2016));
  });

  it('Home e End vão ao domingo e ao sábado da semana', () => {
    expect(moveDate(sat, 'Home')).toEqual(d(14, 8, 2016));
    expect(moveDate(sat, 'End')).toEqual(sat);
    expect(moveDate(d(1, 9, 2016), 'Home')).toEqual(d(28, 8, 2016));
  });

  it('PageUp e PageDown trocam o mês; com Shift, o ano', () => {
    expect(moveDate(d(31, 1, 2024), 'PageDown')).toEqual(d(29, 2, 2024));
    expect(moveDate(sat, 'PageUp')).toEqual(d(20, 7, 2016));
    expect(moveDate(sat, 'PageDown', true)).toEqual(d(20, 8, 2017));
    expect(moveDate(d(29, 2, 2024), 'PageUp', true)).toEqual(d(28, 2, 2023));
  });

  it('outra tecla não move', () => {
    expect(moveDate(sat, 'Enter')).toBeUndefined();
    expect(moveDate(sat, 'a')).toBeUndefined();
  });
});

describe('monthGrid', () => {
  it('seis semanas de domingo a sábado, com as pontas dos meses vizinhos', () => {
    const grid = monthGrid(2016, 8);
    expect(grid).toHaveLength(6);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    // 01/08/2016 foi segunda: o domingo antes é 31/07.
    expect(grid[0]![0]).toEqual({ date: d(31, 7, 2016), inMonth: false, inRange: true });
    expect(grid[0]![1]!.date).toEqual(d(1, 8, 2016));
    expect(grid[5]![6]).toEqual({ date: d(10, 9, 2016), inMonth: false, inRange: true });
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(grid.flat().every((c, i) => weekday(c.date) === i % 7)).toBe(true);
  });

  it('mês que começa no domingo ainda mostra a semana do mês anterior só no fim', () => {
    // 01/05/2016 foi domingo.
    const grid = monthGrid(2016, 5);
    expect(grid[0]![0]!.date).toEqual(d(1, 5, 2016));
    expect(grid[5]![6]!.date).toEqual(d(11, 6, 2016));
  });

  it('atravessa a virada do ano', () => {
    expect(monthGrid(2017, 1)[0]![0]!.date).toEqual(d(1, 1, 2017));
    expect(monthGrid(2016, 12)[5]![6]!.date).toEqual(d(7, 1, 2017));
  });

  it('marca os dias antes de 0001 e depois de 9999 como fora do intervalo', () => {
    const first = monthGrid(1, 1)[0]!;
    expect(first[0]!.inRange).toBe(false);
    expect(first[1]).toEqual({ date: d(1, 1, 1), inMonth: true, inRange: true });
    const last = monthGrid(9999, 12)[5]!;
    expect(last[6]!.inRange).toBe(false);
  });
});

describe('yearPage e moveYear', () => {
  it('páginas de doze anos alinhadas', () => {
    expect(yearPage(2016)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027,
    ]);
    expect(yearPage(2027)[0]).toBe(2016);
    expect(yearPage(2028)[0]).toBe(2028);
    expect(yearPage(5)[0]).toBe(0);
    expect(yearPage(9999).at(-1)).toBe(10007);
  });

  it('isYearInRange separa os anos que cabem em DDMMAAAA', () => {
    expect(isYearInRange(0)).toBe(false);
    expect(isYearInRange(1)).toBe(true);
    expect(isYearInRange(9999)).toBe(true);
    expect(isYearInRange(10000)).toBe(false);
  });

  it('teclas da grade de anos (três colunas)', () => {
    expect(moveYear(2020, 'ArrowLeft')).toBe(2019);
    expect(moveYear(2020, 'ArrowRight')).toBe(2021);
    expect(moveYear(2020, 'ArrowUp')).toBe(2017);
    expect(moveYear(2020, 'ArrowDown')).toBe(2023);
    expect(moveYear(2020, 'Home')).toBe(2016);
    expect(moveYear(2020, 'End')).toBe(2027);
    expect(moveYear(2020, 'PageUp')).toBe(2008);
    expect(moveYear(2020, 'PageDown')).toBe(2032);
    expect(moveYear(2020, 'Enter')).toBeUndefined();
  });

  it('respeita outros limites, como os do campo de ano (1000 a 9999)', () => {
    expect(isYearInRange(999, 1000, 9999)).toBe(false);
    expect(isYearInRange(1000, 1000, 9999)).toBe(true);
    expect(moveYear(1003, 'ArrowUp', 1000, 9999)).toBe(1000);
    expect(moveYear(1005, 'Home', 1000, 9999)).toBe(1000);
    expect(moveYear(1005, 'PageUp', 1000, 9999)).toBe(1000);
    expect(moveYear(9997, 'End', 1000, 9999)).toBe(9999);
  });

  it('yearPageRange corta a página nos limites', () => {
    expect(yearPageRange(2020)).toEqual({ first: 2016, last: 2027 });
    expect(yearPageRange(5)).toEqual({ first: 1, last: 11 });
    expect(yearPageRange(9999)).toEqual({ first: 9996, last: 9999 });
    expect(yearPageRange(1000, 1000, 9999)).toEqual({ first: 1000, last: 1007 });
  });

  it('não sai de 0001 a 9999', () => {
    expect(moveYear(1, 'ArrowLeft')).toBe(1);
    expect(moveYear(3, 'Home')).toBe(1);
    expect(moveYear(9998, 'PageDown')).toBe(9999);
    expect(moveYear(9999, 'End')).toBe(9999);
  });
});

describe('nomes em pt-BR', () => {
  it('mês e ano do cabeçalho', () => {
    expect(formatMonthYear(2016, 4)).toBe('abril de 2016');
    expect(formatMonthYear(2024, 3)).toBe('março de 2024');
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it('semana começando no domingo, com nome inteiro para leitor de tela', () => {
    expect(WEEKDAYS.map((w) => w.short).join(' ')).toBe('D S T Q Q S S');
    expect(WEEKDAYS[0].long).toBe('domingo');
    expect(WEEKDAYS[6].long).toBe('sábado');
  });

  it('data por extenso', () => {
    expect(formatFullDate(d(20, 8, 2016))).toBe('sábado, 20 de agosto de 2016');
    expect(formatFullDate(d(1, 3, 2024))).toBe('sexta-feira, 1 de março de 2024');
  });
});

describe('conversões com o Lattes', () => {
  it('DDMMAAAA de ida e volta', () => {
    expect(dateFromLattes('20082016')).toEqual(d(20, 8, 2016));
    expect(lattesFromDate(d(5, 6, 2010))).toBe('05062010');
    expect(lattesFromDate(d(1, 1, 1))).toBe('01010001');
    expect(dateFromLattes('')).toBeUndefined();
    expect(dateFromLattes('31022024')).toBeUndefined();
  });

  it('compara e reconhece a mesma data', () => {
    expect(compareDates(d(1, 1, 2016), d(31, 12, 2015))).toBeGreaterThan(0);
    expect(sameDate(d(1, 1, 2016), d(1, 1, 2016))).toBe(true);
    expect(sameDate(d(1, 1, 2016), undefined)).toBe(false);
  });

  it('hoje vem da data local', () => {
    expect(calendarDateOf(new Date(2026, 9, 12, 23, 59))).toEqual(d(12, 10, 2026));
  });
});
