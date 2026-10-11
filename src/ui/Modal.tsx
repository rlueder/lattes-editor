// Modal sobre o <dialog> nativo: Esc, foco preso e ::backdrop vêm do navegador.

import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  /** Foca o primeiro campo ao abrir (formulários em branco). */
  focusFirstField?: boolean;
  label: string;
  open: boolean;
  onClose: () => void;
}

export function Modal({ children, className, focusFirstField, label, onClose, open }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal foca o próprio <dialog> quando nada tem autofocus.
      if (focusFirstField) {
        dialog
          .querySelector<HTMLElement>(
            'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
          )
          ?.focus();
      }
    }
    if (!open && dialog.open) dialog.close();
  }, [focusFirstField, open]);

  // Clique fora do conteúdo cai no próprio <dialog> (a área do ::backdrop).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onMouseDown = (e: MouseEvent) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener('mousedown', onMouseDown);
    return () => dialog.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`modal ${className ?? ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}
