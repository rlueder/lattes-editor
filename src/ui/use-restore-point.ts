// O ponto de restauração antes de cada rodada de escrita do conector (LAT-59),
// para o use-bridge: pede o ZIP do Exportar à extensão, espera a resposta com
// o mesmo id, guarda a cópia (src/bridge/restore-point.ts) e, sem ela, segura
// a rodada até a pessoa responder.

import { useCallback, useRef, useState } from 'react';

import type { BridgeOp } from '../bridge/plan.ts';
import type { BridgeMessage } from '../bridge/protocol.ts';
import {
  beginSendSession,
  ConfirmGate,
  type ExportReply,
  ExportRequests,
  makeRestorePoint,
  type RestoreOutcome,
} from '../bridge/restore-point.ts';
import { backupStore } from '../desktop/backup-folder.ts';
import { OPEN_TIMEOUT_MS } from './lattes-open.ts';

/**
 * Sendo feito, feito, ou o resultado que espera a pessoa (sem ponto) ou que
 * para a rodada.
 */
export type RestoreState = RestoreOutcome | { kind: 'fazendo' };

export function useRestorePoint(
  features: readonly string[],
  post: (msg: { id: string; type: 'pedir-curriculo' }) => void,
) {
  const [restore, setRestore] = useState<RestoreState | undefined>();
  /** Os pedidos de exportação do ponto de restauração (src/bridge/restore-point.ts). */
  const requests = useRef(new ExportRequests());
  /** A confirmação sem ponto de restauração, cancelável quando o painel fecha. */
  const gate = useRef(new ConfirmGate());
  /** Uma rodada começando (ponto em andamento ou pergunta aberta). */
  const starting = useRef(false);

  /** A resposta "curriculo" de um pedido do ponto, mesmo atrasada; true quando era dele. */
  const takeReply = useCallback((msg: BridgeMessage) => requests.current.take(msg), []);

  /**
   * O painel fechou ou a extensão desligou: a rodada que começava é cancelada
   * (sem gravar nada) e o aviso dela não volta ao reabrir o painel.
   */
  const dismiss = useCallback(() => {
    gate.current.cancel();
    setRestore(undefined);
  }, []);

  /** A extensão desligou: os pedidos em aberto não vão ter resposta. */
  const dropAll = useCallback(() => {
    requests.current.dropAll();
    dismiss();
  }, [dismiss]);

  const exportNow = (): Promise<ExportReply> =>
    features.includes('curriculo')
      ? requests.current.request((id) => post({ id, type: 'pedir-curriculo' }), OPEN_TIMEOUT_MS)
      : Promise.resolve({ ok: false, reason: 'sem-exportar' });

  /** O começo da rodada: true quando pode gravar. Uma rodada de cada vez. */
  const begin = async (lattesId: string | undefined, ops: BridgeOp[]): Promise<boolean> => {
    if (starting.current) return false;
    starting.current = true;
    gate.current.reset();
    try {
      return await beginSendSession({
        confirmWithout: () => gate.current.ask() ?? Promise.resolve(false),
        onOutcome: (outcome) => setRestore(gate.current.isCancelled ? undefined : outcome),
        restore: async () => {
          if (!lattesId) {
            return {
              detail: 'O currículo aberto não tem o NUMERO-IDENTIFICADOR',
              kind: 'parar',
              reason: 'erro',
            };
          }
          if (!gate.current.isCancelled) setRestore({ kind: 'fazendo' });
          return makeRestorePoint({ exportNow, lattesId, ops, store: backupStore() });
        },
      });
    } finally {
      starting.current = false;
    }
  };

  /** A resposta da pessoa sem ponto novo; depois de uma rodada parada, só fecha o aviso. */
  const answer = (go: boolean) => {
    setRestore(undefined);
    gate.current.answer(go);
  };

  // fields entra direto no BridgeState.
  return {
    begin,
    dropAll,
    fields: { answerRestore: answer, dismissRestore: dismiss, restore },
    takeReply,
  };
}
