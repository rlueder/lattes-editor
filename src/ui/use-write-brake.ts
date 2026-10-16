// O freio de escrita (LAT-59, item 4) do lado do editor, para o use-bridge: a
// pausa no teto da rodada, que a extensão avisa no "fim", o "Continuar" que
// segue com o resto da fila, e o "Já conferi no
// Lattes" de uma gravação divergente, guardado no registro do enviado. As
// regras estão em src/bridge/write-brake.ts.

import { useCallback, useState } from 'react';

import type { BridgeOp } from '../bridge/plan.ts';
import type { EditorMessage } from '../bridge/protocol.ts';
import type { SentEntry } from '../bridge/sent-log.ts';
import type { RoundPause } from '../bridge/write-brake.ts';
import { markSentChecked } from '../model/sent-checks.ts';

export function useWriteBrake(
  reloadSent: () => void,
  post: (msg: EditorMessage) => void,
  setRunning: (running: boolean) => void,
  /**
   * Aceitar na cópia uma alteração gravada (use-bridge.ts). Depois do "Já
   * conferi no Lattes" num item criado com divergência, ele entra com o
   * número que o Lattes deu, como entraria conferido.
   */
  accept: { current: (key: string, assigned?: Record<string, string>) => void },
) {
  const [pause, setPause] = useState<RoundPause | undefined>();
  // As operações da rodada atual, para o passo ② mostrar o andamento de cada
  // uma: as conferidas saem do plano assim que entram na cópia.
  const [round, setRound] = useState<BridgeOp[] | undefined>();

  const resume = useCallback(() => {
    setPause(undefined);
    setRunning(true);
    post({ type: 'continuar' });
  }, [post, setRunning]);

  const checkSent = useCallback(
    async (entry: SentEntry) => {
      if (entry.id === undefined) return;
      await markSentChecked(entry.id, Date.now());
      reloadSent();
      if (entry.outcome?.assigned) accept.current(entry.op.key, entry.outcome.assigned);
    },
    [reloadSent, accept],
  );

  // fields entra direto no BridgeState.
  /** Uma rodada nova: sem pausa, com estas operações. */
  const startRound = useCallback((ops: BridgeOp[]) => {
    setPause(undefined);
    setRound(ops);
  }, []);

  return { fields: { checkSent, pause, resume, round }, setPause, startRound };
}
