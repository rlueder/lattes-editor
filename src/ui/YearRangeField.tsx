// Campo de intervalo de anos: o campo mostra "2009 – 2026" com o botão do
// calendário, como o campo de ano, e o popover traz atalhos e a grade de
// anos. O primeiro clique marca o início, o segundo o fim; entre os dois, a
// grade mostra a prévia. Mesma família do campo de data e do campo de ano
// (CalendarPopover e a grade de anos de Calendar.tsx).

import { useLayoutEffect, useRef, useState } from 'react';

import { YearGrid } from './Calendar.tsx';
import { yearPageRange } from './calendar-dates.ts';
import { CalendarPopover } from './CalendarPopover.tsx';
import { ChevronIcon } from './icons.tsx';
import { formatRange, pickYear, shownRange, type YearRange } from './year-range.ts';

export interface RangePreset {
  id: string;
  label: string;
  range: YearRange;
}

interface Props {
  id: string;
  /** Rótulo do campo; dá nome ao diálogo para leitores de tela. */
  label: string;
  max: number;
  min: number;
  presets: RangePreset[];
  today: number;
  value: YearRange;
  onChange: (range: YearRange) => void;
}

export function YearRangeField({ id, label, max, min, onChange, presets, today, value }: Props) {
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
    <div ref={anchorRef} className="date-field year-range-field">
      <input
        ref={inputRef}
        readOnly
        aria-haspopup="dialog"
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
            <div aria-label="Atalhos de período" className="year-range-presets" role="group">
              {presets.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={p.range.from === value.from && p.range.to === value.to}
                  className="year-range-preset"
                  type="button"
                  onClick={() => {
                    onChange(p.range);
                    close();
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
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
