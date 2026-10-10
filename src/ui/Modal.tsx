// Modal sobre o <dialog> nativo: Esc, foco preso e ::backdrop vêm do navegador.

import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  label: string;
  open: boolean;
  onClose: () => void;
}

export function Modal({ children, className, label, onClose, open }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
