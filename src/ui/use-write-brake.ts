// O freio de escrita (LAT-59, item 4) do lado do editor, para o use-bridge: a
// pausa no teto da rodada, que a extensão avisa no "fim", e o "Já conferi no
// Lattes" de uma gravação divergente, guardado no registro do enviado. As
// regras estão em src/bridge/write-brake.ts.

import { useCallback, useState } from 'react';

import type { SentEntry } from '../bridge/sent-log.ts';
import type { RoundPause } from '../bridge/write-brake.ts';
import { markSentChecked } from '../model/sent-checks.ts';

export function useWriteBrake(reloadSent: () => void) {
  const [pause, setPause] = useState<RoundPause | undefined>();

  const checkSent = useCallback(
    async (entry: SentEntry) => {
      if (entry.id === undefined) return;
      await markSentChecked(entry.id, Date.now());
      reloadSent();
    },
    [reloadSent],
  );

  // fields entra direto no BridgeState.
  return { fields: { checkSent, pause }, setPause };
}
