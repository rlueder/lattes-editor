// Calendário do campo de data: grade de dias do mês e, ao clicar no título,
// grade de anos (doze por página) para atravessar décadas sem passar mês a
// mês. A mesma grade de anos, sozinha, é o seletor do campo de ano. Teclado
// do padrão de seletor de data do WAI-ARIA APG; a lógica fica em
// calendar-dates.ts.

import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef, useState } from 'react';

import {
  addMonths,
  type CalendarDate,
  formatFullDate,
  formatMonthYear,
  isYearInRange,
  MAX_YEAR,
  MIN_YEAR,
  monthGrid,
  moveDate,
  moveYear,
  sameDate,
  WEEKDAYS,
  withYear,
  YEAR_COLUMNS,
  yearPage,
  yearPageRange,
  YEARS_PER_PAGE,
} from './calendar-dates.ts';
import { ChevronIcon } from './icons.tsx';
import { cellState } from './year-range.ts';

/**
 * Teclado e troca de grade levam o foco à célula nova depois de desenhar; os
 * botões de página anterior e seguinte não (o foco fica no botão). Quem muda
 * a célula ativa marca `current = true` antes.
 */
function useFocusAfterRender(activeRef: RefObject<HTMLTableCellElement | null>) {
  const pending = useRef(false);
  useLayoutEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    activeRef.current?.focus();
  });
  return pending;
}

interface YearGridProps {
  /** Recebe a célula do ano em foco. */
  activeRef: RefObject<HTMLTableCellElement | null>;
  focus: number;
  max?: number;
  min?: number;
  /**
   * Intervalo destacado (seletor de intervalo do Panorama): as pontas em azul
   * cheio, o miolo em azul claro. Com ele, Home e End vão ao primeiro e ao
   * último ano permitidos, não à ponta da página.
   */
  range?: { from: number; to: number };
  selected?: number;
  today: number;
  /** Esc tratado na grade. Sem ele, o Esc segue até o popover, que fecha. */
  onEscape?: () => void;
  /** Ponteiro sobre um ano (ou fora da grade), para a prévia do intervalo. */
  onHover?: (year: number | undefined) => void;
  /** Teclado moveu o foco para outro ano. */
  onMove: (year: number) => void;
  /** Clique, Enter ou espaço num ano. */
  onPick: (year: number) => void;
}

/** Doze anos em três colunas, com foco itinerante (um só ano no Tab). */
export function YearGrid({
  activeRef,
  focus,
  max = MAX_YEAR,
  min = MIN_YEAR,
  onEscape,
  onHover,
  onMove,
  onPick,
  range,
  selected,
  today,
}: YearGridProps) {
  const page = yearPage(focus);
  const { first, last } = yearPageRange(focus, min, max);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(focus);
      return;
    }
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
      return;
    }
    const next =
      range && (e.key === 'Home' || e.key === 'End')
        ? e.key === 'Home'
          ? min
          : max
        : moveYear(focus, e.key, min, max);
    if (next === undefined) return;
    e.preventDefault();
    onMove(next);
  };

  return (
    <table
      aria-label={`Anos de ${first} a ${last}`}
      aria-multiselectable={range ? true : undefined}
      className="calendar-grid calendar-years"
      role="grid"
      onKeyDown={onKeyDown}
      onMouseLeave={onHover && (() => onHover(undefined))}
    >
      <tbody>
        {Array.from({ length: page.length / YEAR_COLUMNS }, (_, row) => (
          <tr key={page[row * YEAR_COLUMNS]}>
            {page.slice(row * YEAR_COLUMNS, (row + 1) * YEAR_COLUMNS).map((year) => {
              if (!isYearInRange(year, min, max)) return <td key={year} />;
              const active = year === focus;
              const state = range ? cellState(year, range) : undefined;
              const selectedCell = range ? state !== 'out' : year === selected;
              return (
                <td
                  key={year}
                  ref={active ? activeRef : undefined}
                  aria-current={year === today ? 'date' : undefined}
                  // Na grade de intervalo (multisseleção), toda célula diz se está ou não escolhida.
                  aria-selected={range ? selectedCell : selectedCell || undefined}
                  className={[
                    'calendar-cell',
                    year === today ? 'today' : '',
                    state === 'end' ? 'range-end' : state === 'in' ? 'range-in' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onPick(year)}
                  onFocus={onHover && (() => onHover(year))}
                  onMouseEnter={onHover && (() => onHover(year))}
                >
                  {year}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface YearPickerProps {
  activeRef: RefObject<HTMLTableCellElement | null>;
  /** Ano em foco ao abrir. */
  initial: number;
  max?: number;
  min?: number;
  selected?: number;
  today: number;
  onSelect: (year: number) => void;
}

/** Seletor do campo de ano: só a grade de anos, sem a volta aos dias. */
export function YearPicker({
  activeRef,
  initial,
  max = MAX_YEAR,
  min = MIN_YEAR,
  onSelect,
  selected,
  today,
}: YearPickerProps) {
  const [focus, setFocus] = useState(initial);
  const moveFocus = useFocusAfterRender(activeRef);
  const go = (next: number, focusCell: boolean) => {
    moveFocus.current = focusCell;
    setFocus(next);
  };
  const { first, last } = yearPageRange(focus, min, max);

  return (
    <div className="calendar-body calendar-year-picker">
      <div className="calendar-head">
        <button
          aria-label="Anos anteriores"
          className="ghost calendar-nav calendar-prev"
          disabled={first <= min}
          type="button"
          onClick={() => go(moveYear(focus, 'PageUp', min, max)!, false)}
        >
          <ChevronIcon />
        </button>
        <span className="calendar-range">{`${first}–${last}`}</span>
        <button
          aria-label="Próximos anos"
          className="ghost calendar-nav calendar-next"
          disabled={last >= max}
          type="button"
          onClick={() => go(moveYear(focus, 'PageDown', min, max)!, false)}
        >
          <ChevronIcon />
        </button>
      </div>
      {/* Anuncia a página de anos quando muda. */}
      <div aria-live="polite" className="sr-only">
        {`Anos de ${first} a ${last}`}
      </div>
      <YearGrid
        activeRef={activeRef}
        focus={focus}
        max={max}
        min={min}
        selected={selected}
        today={today}
        onMove={(year) => go(year, true)}
        onPick={onSelect}
      />
    </div>
  );
}

interface Props {
  /** Recebe a célula em foco (dia ou ano), para o popover focá-la ao abrir. */
  activeRef: RefObject<HTMLTableCellElement | null>;
  selected?: CalendarDate;
  today: CalendarDate;
  onSelect: (date: CalendarDate) => void;
}

export function Calendar({ activeRef, onSelect, selected, today }: Props) {
  const [focus, setFocus] = useState<CalendarDate>(selected ?? today);
  const [view, setView] = useState<'days' | 'years'>('days');
  const moveFocus = useFocusAfterRender(activeRef);

  const go = (next: CalendarDate, focusCell: boolean) => {
    moveFocus.current = focusCell;
    setFocus(next);
  };
  const switchView = (next: 'days' | 'years') => {
    moveFocus.current = true;
    setView(next);
  };

  const { first, last } = yearPageRange(focus.year);
  const monthYear = formatMonthYear(focus.year, focus.month);
  const atStart =
    view === 'days' ? focus.year === MIN_YEAR && focus.month === 1 : first <= MIN_YEAR;
  const atEnd = view === 'days' ? focus.year === MAX_YEAR && focus.month === 12 : last >= MAX_YEAR;
  // Em meses: um mês na grade de dias, uma página de anos na outra.
  const step = view === 'days' ? 1 : 12 * YEARS_PER_PAGE;

  const onDaysKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(focus);
      return;
    }
    const next = moveDate(focus, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    go(next, true);
  };

  return (
    <div className="calendar-body">
      <div className="calendar-head">
        <button
          aria-label={view === 'days' ? 'Mês anterior' : 'Anos anteriores'}
          className="ghost calendar-nav calendar-prev"
          disabled={atStart}
          type="button"
          onClick={() => go(addMonths(focus, -step), false)}
        >
          <ChevronIcon />
        </button>
        <button
          aria-label={
            view === 'days' ? `${monthYear}, escolher ano` : `${first} a ${last}, voltar aos dias`
          }
          className="ghost calendar-title"
          type="button"
          onClick={() => switchView(view === 'days' ? 'years' : 'days')}
        >
          <span>{view === 'days' ? monthYear : `${first}–${last}`}</span>
          <span className={`calendar-title-icon${view === 'years' ? ' open' : ''}`}>
            <ChevronIcon />
          </span>
        </button>
        <button
          aria-label={view === 'days' ? 'Próximo mês' : 'Próximos anos'}
          className="ghost calendar-nav calendar-next"
          disabled={atEnd}
          type="button"
          onClick={() => go(addMonths(focus, step), false)}
        >
          <ChevronIcon />
        </button>
      </div>
      {/* Anuncia o mês ou a página de anos quando muda. */}
      <div aria-live="polite" className="sr-only">
        {view === 'days' ? monthYear : `Anos de ${first} a ${last}`}
      </div>
      {view === 'days' ? (
        <table aria-label={monthYear} className="calendar-grid" role="grid" onKeyDown={onDaysKey}>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w.long} scope="col">
                  <span aria-hidden="true">{w.short}</span>
                  <span className="sr-only">{w.long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(focus.year, focus.month).map((week) => (
              <tr key={`${week[0]!.date.year}-${week[0]!.date.month}-${week[0]!.date.day}`}>
                {week.map(({ date, inMonth, inRange }) => {
                  const active = sameDate(date, focus);
                  if (!inRange) return <td key={`${date.year}-${date.month}-${date.day}`} />;
                  return (
                    <td
                      key={`${date.year}-${date.month}-${date.day}`}
                      ref={active ? activeRef : undefined}
                      aria-current={sameDate(date, today) ? 'date' : undefined}
                      aria-label={formatFullDate(date)}
                      aria-selected={sameDate(date, selected) || undefined}
                      className={`calendar-cell${inMonth ? '' : ' outside'}${sameDate(date, today) ? ' today' : ''}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => onSelect(date)}
                    >
                      {date.day}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Esc na grade de anos volta aos dias; na de dias, fecha o calendário.
        <YearGrid
          activeRef={activeRef}
          focus={focus.year}
          selected={selected?.year}
          today={today.year}
          onEscape={() => switchView('days')}
          onMove={(year) => go(withYear(focus, year), true)}
          onPick={(year) => {
            setFocus(withYear(focus, year));
            switchView('days');
          }}
        />
      )}
    </div>
  );
}
