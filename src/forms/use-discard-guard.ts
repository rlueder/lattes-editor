// Fechar um formulário de item com algo mudado desde a abertura pergunta antes
// (Esc, clique fora, fechar): um Esc sem querer não leva o que a pessoa
// digitou. Compara o conteúdo do item, então digitar e apagar não conta.

import { useState } from 'react';

import { serializeElement, type XElement } from '../model/xml.ts';

export function useDiscardGuard(item: XElement, onCancel: () => void) {
  const [opened] = useState(() => serializeElement(item).join(''));
  const [confirming, setConfirming] = useState(false);
  return {
    /** Props do DiscardConfirm (src/ui/dialogs.tsx). */
    confirm: {
      onDiscard: () => {
        setConfirming(false);
        onCancel();
      },
      onKeep: () => setConfirming(false),
      open: confirming,
    },
    requestClose: () => {
      // Com a confirmação aberta, um segundo pedido (Esc que chega ao
      // formulário) não faz nada: nem reabre nem tira o foco dela.
      if (confirming) return;
      // Campo de texto só grava no item ao perder o foco: tira o foco antes de
      // comparar, senão o que está sendo digitado (Esc no meio) não conta.
      (document.activeElement as HTMLElement | null)?.blur();
      if (serializeElement(item).join('') !== opened) setConfirming(true);
      else onCancel();
    },
  };
}
