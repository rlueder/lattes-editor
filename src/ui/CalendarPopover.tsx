// Botão do calendário dentro do campo e o popover que ele abre (Base UI),
// comum ao campo de data e ao de ano.

import { Popover } from '@base-ui/react/popover';
import { type ReactNode, type RefObject, useRef } from 'react';

import { CalendarIcon } from './icons.tsx';

interface Props {
  /** Célula em foco na grade; recebe o foco quando o popover abre. */
  activeRef: RefObject<HTMLTableCellElement | null>;
  /** Caixa do campo: o popover se alinha à direita dela. */
  anchorRef: RefObject<HTMLDivElement | null>;
  /** Nome acessível do botão. */
  buttonLabel: string;
  /**
   * Conteúdo do popover. `close` fecha devolvendo o foco ao campo, para usar
   * depois de uma escolha.
   */
  children: (close: () => void) => ReactNode;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Rótulo do campo; dá nome ao diálogo para leitores de tela. */
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarPopover({
  activeRef,
  anchorRef,
  buttonLabel,
  children,
  inputRef,
  label,
  onOpenChange,
  open,
}: Props) {
  // Esc, "Fechar" e uma escolha devolvem o foco ao campo; clique fora deixa o
  // foco onde a pessoa clicou.
  const returnToInput = useRef(false);
  const close = () => {
    returnToInput.current = true;
    onOpenChange(false);
  };

  return (
    <Popover.Root
      modal="trap-focus"
      open={open}
      onOpenChange={(next, details) => {
        returnToInput.current =
          !next && (details.reason === 'escape-key' || details.reason === 'close-press');
        onOpenChange(next);
      }}
    >
      <Popover.Trigger aria-label={buttonLabel} className="ghost icon-btn date-field-button">
        <CalendarIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="end"
          anchor={anchorRef}
          className="popup-positioner"
          sideOffset={4}
        >
          <Popover.Popup
            className="calendar"
            finalFocus={() => (returnToInput.current ? inputRef.current : true)}
            initialFocus={activeRef}
          >
            <Popover.Title className="sr-only">{label}</Popover.Title>
            {children(close)}
            <Popover.Close className="calendar-close">Fechar</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
