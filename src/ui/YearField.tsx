// Campo de ano (AAAA) com a grade de anos do calendário num popover, no mesmo
// desenho do campo de data.

import { useEffect, useRef, useState } from 'react';

import { YearPicker } from './Calendar.tsx';
import { CalendarPopover } from './CalendarPopover.tsx';
import {
  initialPickerYear,
  isValidLattesYear,
  lattesYearFromInput,
  maskYearInput,
  MAX_LATTES_YEAR,
  MIN_LATTES_YEAR,
} from './lattes-year.ts';

interface Props {
  common: { 'aria-describedby'?: string; 'aria-invalid'?: boolean; id: string };
  /** Rótulo do campo; dá nome à grade de anos para leitores de tela. */
  label: string;
  /** Valor guardado: quatro dígitos ou vazio. */
  value: string;
  /** Recebe o ano em AAAA, ou vazio quando o campo foi limpo; grava só se mudou. */
  onCommit: (next: string) => void;
}

/**
 * Grava ao sair do campo ou no Enter, e só se o ano tiver quatro dígitos e
 * ficar entre 1000 e 9999; outro texto volta ao valor guardado. Na grade,
 * escolher o ano grava na hora.
 */
export function YearField({ common, label, onCommit, value }: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLTableCellElement>(null);
  const currentYear = new Date().getFullYear();

  // Quem recebe só grava o que mudou (AttributeField compara com o elemento).
  const finish = () => {
    const next = lattesYearFromInput(draft);
    if (next === undefined) setDraft(value);
    else onCommit(next);
  };

  return (
    <div ref={anchorRef} className="date-field">
      <input
        {...common}
        ref={inputRef}
        autoComplete="off"
        inputMode="numeric"
        maxLength={4}
        placeholder="aaaa"
        type="text"
        value={draft}
        onBlur={finish}
        onChange={(e) => {
          const input = e.target;
          const masked = maskYearInput(input.value, input.selectionStart ?? input.value.length);
          // Escreve já no campo, com o cursor no lugar: o React vê o mesmo valor
          // e não o devolve ao fim do texto.
          input.value = masked.value;
          input.setSelectionRange(masked.caret, masked.caret);
          setDraft(masked.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <CalendarPopover
        activeRef={activeRef}
        anchorRef={anchorRef}
        buttonLabel="Escolher ano"
        inputRef={inputRef}
        label={label}
        open={open}
        onOpenChange={setOpen}
      >
        {(close) => (
          <YearPicker
            activeRef={activeRef}
            initial={initialPickerYear(value, currentYear)}
            max={MAX_LATTES_YEAR}
            min={MIN_LATTES_YEAR}
            selected={isValidLattesYear(value) ? Number(value) : undefined}
            today={currentYear}
            onSelect={(year) => {
              const next = String(year);
              setDraft(next);
              onCommit(next);
              close();
            }}
          />
        )}
      </CalendarPopover>
    </div>
  );
}
