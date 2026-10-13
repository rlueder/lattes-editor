// Onde os avisos de toasts.ts aparecem: canto inferior direito, por cima de
// tudo, cada um com o seu botão e um fechar.

import { Toast } from '@base-ui/react/toast';

import { CloseIcon } from './icons.tsx';

export function Toaster() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="toast-viewport">
        {toasts.map((t) => (
          <Toast.Root key={t.id} className="toast" toast={t}>
            <Toast.Content className="toast-content">
              <Toast.Title className="toast-title" />
              <Toast.Description className="toast-description" />
              {t.actionProps && <Toast.Action className="primary toast-action" />}
            </Toast.Content>
            <Toast.Close aria-label="Fechar" className="ghost icon-btn toast-close">
              <CloseIcon />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
