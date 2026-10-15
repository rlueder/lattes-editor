// Campo de intervalo de anos: o campo mostra "2009 – 2026" com o botão do
// calendário, como o campo de ano, e o popover traz só a grade de anos. O
// primeiro clique marca o início, o segundo o fim; entre os dois, a grade
// mostra a prévia. Os atalhos ficam fora, no painel (YearRangeFilter). Mesma família do campo de data e do campo de ano
// (CalendarPopover e a grade de anos de Calendar.tsx).

import { useLayoutEffect, useRef, useState } from 'react';

import { YearGrid } from './Calendar.tsx';
import { yearPageRange } from './calendar-dates.ts';
import { CalendarPopover } from './CalendarPopover.tsx';
import { ChevronIcon } from './icons.tsx';
import { formatRange, pickYear, shownRange, type YearRange } from './year-range.ts';

interface Props {
  /** Período diferente de "todos os anos": o campo fica marcado como filtro ativo. */
  active?: boolean;
  id: string;
  /** Rótulo do campo; dá nome ao diálogo para leitores de tela. */
  label: string;
  max: number;
  min: number;
  today: number;
  value: YearRange;
  onChange: (range: YearRange) => void;
}

export function YearRangeField({ active, id, label, max, min, onChange, today, value }: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<number | undefined>();
  const [hover, setHover] = useState<number | undefined>();
  const [focus, setFocus] = useState(value.to);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLTableCellElement>(null);
  const shown = shownRange(value, start, hover);
  const { first, last } = yearPageRange(focus, min, max);

  const openWith = (next: boolean) => {
    setStart(undefined);
    setHover(undefined);
    if (next) setFocus(Math.min(max, Math.max(min, value.to)));
    setOpen(next);
  };

  // Depois de desenhar o ano novo (talvez noutra página), o foco vai para ele,
  // como no seletor de ano.
  const focusAfter = useRef(false);
  useLayoutEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    activeRef.current?.focus();
  });
  const move = (year: number) => {
    focusAfter.current = true;
    setFocus(year);
    setHover(start === undefined ? undefined : year);
  };

  return (
    <div
      ref={anchorRef}
      className={active ? 'date-field year-range-field active' : 'date-field year-range-field'}
    >
      <input
        ref={inputRef}
        readOnly
        aria-haspopup="dialog"
        aria-label={label}
        id={id}
        type="text"
        value={formatRange(value)}
        onClick={() => openWith(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || (e.key === 'ArrowDown' && e.altKey)) {
            e.preventDefault();
            openWith(true);
          }
        }}
      />
      <CalendarPopover
        activeRef={activeRef}
        anchorRef={anchorRef}
        buttonLabel="Escolher período"
        inputRef={inputRef}
        label={label}
        open={open}
        onOpenChange={openWith}
      >
        {(close) => (
          <div className="calendar-body calendar-year-picker year-range-picker">
            <div className="calendar-head">
              <button
                aria-label="Anos anteriores"
                className="ghost calendar-nav calendar-prev"
                disabled={first <= min}
                type="button"
                onClick={() => setFocus(Math.max(min, focus - 12))}
              >
                <ChevronIcon />
              </button>
              <span className="calendar-range">{`${first}–${last}`}</span>
              <button
                aria-label="Próximos anos"
                className="ghost calendar-nav calendar-next"
                disabled={last >= max}
                type="button"
                onClick={() => setFocus(Math.min(max, focus + 12))}
              >
                <ChevronIcon />
              </button>
            </div>
            <p aria-live="polite" className="year-range-hint">
              {start === undefined
                ? `De ${shown.from} a ${shown.to}. Escolha o primeiro ano.`
                : `Início em ${start}. Escolha o último ano.`}
            </p>
            <YearGrid
              activeRef={activeRef}
              focus={focus}
              max={max}
              min={min}
              range={shown}
              today={today}
              onHover={start === undefined ? undefined : setHover}
              onMove={move}
              onPick={(year) => {
                const r = pickYear(start, year);
                if ('pending' in r) {
                  setStart(r.pending);
                  setHover(r.pending);
                  return;
                }
                onChange(r.done);
                close();
              }}
            />
          </div>
        )}
      </CalendarPopover>
    </div>
  );
}
