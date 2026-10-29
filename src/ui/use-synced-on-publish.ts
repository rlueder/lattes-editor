// Depois de um envio ao CNPq confirmado pelo editor: sem pendência de fora
// dele no Lattes, tudo o que foi publicado passou pelo conector, que releu
// cada item depois de gravar. A cópia fica em dia nesse dia
// (WorkingCopy.syncedOn), e o aviso da exportação atrasada não vale para ela.

import { type Dispatch, type SetStateAction, useRef } from 'react';

import { localDay } from '../bridge/publish-status.ts';
import type { Session } from '../forms/use-production.ts';
import { stripFor } from './app-notices.ts';
import type { BridgeState } from './use-bridge.ts';

export function useSyncedOnPublish(
  bridge: Pick<BridgeState, 'lattes' | 'link' | 'sent'>,
  setSession: Dispatch<SetStateAction<Session | null>>,
  onEdit: (note: string) => void,
): () => void {
  // Lida enquanto há pendência: depois do envio confirmado, o menu já não a mostra.
  const outsidePending = useRef(false);
  if (bridge.lattes?.pending) {
    outsidePending.current = stripFor(0, bridge).segments.some(
      (x) => x.kind === 'pendencia-desconhecida',
    );
  }
  return () => {
    if (outsidePending.current) return;
    setSession((s) => s && { ...s, meta: { ...s.meta, syncedOn: localDay(new Date()) } });
    onEdit('Publicado no CNPq');
  };
}
