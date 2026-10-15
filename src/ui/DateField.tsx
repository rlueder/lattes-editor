// Campo de data em dd/mm/aaaa com calendário próprio (Popover do Base UI).
// O campo nativo do navegador segue o idioma do sistema, não o da página: no
// app de desktop (WebKit) aparecia 08/20/2016 e um calendário pequeno, em
// inglês e sem os tokens do editor.

import { useEffect, useRef, useState } from 'react';

import { Calendar } from './Calendar.tsx';
import { calendarDateOf, dateFromLattes, lattesFromDate } from './calendar-dates.ts';
import { CalendarPopover } from './CalendarPopover.tsx';
import { displayLattesDate, lattesFromMasked, maskDateInput } from './lattes-date.ts';

interface Props {
  common: { 'aria-describedby'?: string; 'aria-invalid'?: boolean; id: string };
  /** Rótulo do campo; dá nome ao calendário para leitores de tela. */
  label: string;
  /** Valor guardado: DDMMAAAA válido ou vazio. */
  value: string;
  /** Recebe o valor em DDMMAAAA, ou vazio quando o campo foi limpo. */
  onCommit: (next: string) => void;
}

/**
 * Grava ao sair do campo ou no Enter, como os campos de texto, e só se a data
 * estiver completa e existir; data pela metade volta ao valor guardado. No
 * calendário, escolher o dia grava na hora.
 */
export function DateField({ common, label, onCommit, value }: Props) {
  const shown = displayLattesDate(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLTableCellElement>(null);

  const finish = () => {
    const next = lattesFromMasked(draft);
    if (next === undefined) setDraft(shown);
    else onCommit(next);
  };

  return (
    <div ref={anchorRef} className="date-field">
      <input
        {...common}
        ref={inputRef}
        autoComplete="off"
        inputMode="numeric"
        maxLength={10}
        placeholder="DD/MM/AAAA"
        type="text"
        value={draft}
        onBlur={finish}
        onChange={(e) => {
          const input = e.target;
          const masked = maskDateInput(input.value, input.selectionStart ?? input.value.length);
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
        buttonLabel="Abrir calendário"
        inputRef={inputRef}
        label={label}
        open={open}
        onOpenChange={setOpen}
      >
        {(close) => (
          <Calendar
            activeRef={activeRef}
            selected={dateFromLattes(value)}
            today={calendarDateOf(new Date())}
            onSelect={(date) => {
              const next = lattesFromDate(date);
              setDraft(displayLattesDate(next));
              onCommit(next);
              close();
            }}
          />
        )}
      </CalendarPopover>
    </div>
  );
}
