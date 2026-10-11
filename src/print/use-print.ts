import { useCallback, useEffect, useState } from 'react';

export interface PrintControl {
  hide: () => void;
  open: boolean;
  show: () => void;
}

/**
 * Estado do diálogo de impressão. ⌘P / Ctrl+P abre o diálogo do editor em vez
 * da impressão do navegador, só enquanto há um currículo aberto.
 */
export function usePrint(enabled: boolean): PrintControl {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, show]);
  return { hide, open, show };
}
