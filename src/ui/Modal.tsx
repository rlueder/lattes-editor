// Modal sobre o Dialog do Base UI: foco preso, Esc, clique fora e
// devolução do foco vêm da biblioteca.
//
// Todo modal tem a mesma moldura: cabeçalho com título e botão de fechar,
// corpo com rolagem e margens iguais, rodapé com as ações. "bare" deixa o
// conteúdo montar a própria estrutura (⌘K, formulário de item).

import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

import { CloseIcon } from './icons.tsx';

interface Props {
  bare?: boolean;
  children: ReactNode;
  className?: string;
  /** Foca o primeiro campo ao abrir (formulários em branco). */
  focusFirstField?: boolean;
  /** Ações do rodapé, alinhadas à direita. */
  footer?: ReactNode;
  label: string;
  open: boolean;
  /** Linha de apoio sob o título. */
  subtitle?: ReactNode;
  /** Título visível; sem ele, `label` só nomeia o diálogo para leitores de tela. */
  title?: ReactNode;
  onClose: () => void;
}

const FIELD =
  'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), [role="combobox"]';

export function Modal({
  bare,
  children,
  className,
  focusFirstField,
  footer,
  label,
  onClose,
  open,
  subtitle,
  title,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup
          aria-label={title ? undefined : label}
          className={`modal ${className ?? ''}`}
          initialFocus={
            focusFirstField
              ? () => document.querySelector<HTMLElement>(`.modal ${FIELD}`) ?? true
              : undefined
          }
        >
          {bare ? (
            children
          ) : (
            <div className="modal-frame">
              <header className="modal-head">
                <div className="modal-titles">
                  {title && <Dialog.Title className="modal-title">{title}</Dialog.Title>}
                  {subtitle && (
                    <Dialog.Description className="modal-subtitle">{subtitle}</Dialog.Description>
                  )}
                </div>
                <Dialog.Close aria-label="Fechar" className="ghost icon-btn modal-close">
                  <CloseIcon />
                </Dialog.Close>
              </header>
              <div className="modal-body">{children}</div>
              {footer && <footer className="modal-foot">{footer}</footer>}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
