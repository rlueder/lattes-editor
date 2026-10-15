// O ponto de restauração antes de cada rodada de escrita do conector (LAT-59),
// para o use-bridge: pede o ZIP do Exportar à extensão, espera a resposta com
// o mesmo id, guarda a cópia (src/bridge/restore-point.ts) e, sem ela, segura
// a rodada até a pessoa responder.

import { useCallback, useRef, useState } from 'react';

import type { BridgeOp } from '../bridge/plan.ts';
import type { BridgeMessage } from '../bridge/protocol.ts';
import {
  beginSendSession,
  type ExportReply,
  exportReplyOf,
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
  /** Os pedidos de exportação do ponto de restauração, pelo id. */
  const waiters = useRef(new Map<string, (reply: ExportReply) => void>());
  /** A confirmação em aberto, quando não houve ponto de restauração. */
  const answerRef = useRef<((go: boolean) => void) | undefined>(undefined);
  /** Uma rodada começando (ponto em andamento ou pergunta aberta). */
  const starting = useRef(false);

  /** A resposta "curriculo" de um pedido do ponto; true quando era dele. */
  const takeReply = useCallback((msg: BridgeMessage): boolean => {
    const waiter = msg.type === 'curriculo' && msg.id ? waiters.current.get(msg.id) : undefined;
    if (msg.type !== 'curriculo' || !waiter) return false;
    waiters.current.delete(msg.id!);
    waiter(exportReplyOf(msg));
    return true;
  }, []);

  /** A extensão desligou: os pedidos em aberto não vão ter resposta. */
  const dropAll = useCallback(() => {
    for (const resolve of waiters.current.values()) resolve({ ok: false, reason: 'sem-resposta' });
    waiters.current.clear();
  }, []);

  const exportNow = (): Promise<ExportReply> => {
    if (!features.includes('curriculo')) {
      return Promise.resolve({ ok: false, reason: 'sem-exportar' });
    }
    const id = `restauracao-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiters.current.delete(id);
        resolve({ ok: false, reason: 'sem-resposta' });
      }, OPEN_TIMEOUT_MS);
      waiters.current.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
      post({ id, type: 'pedir-curriculo' });
    });
  };

  /** O começo da rodada: true quando pode gravar. Uma rodada de cada vez. */
  const begin = async (lattesId: string | undefined, ops: BridgeOp[]): Promise<boolean> => {
    if (starting.current) return false;
    starting.current = true;
    try {
      return await beginSendSession({
        confirmWithout: () =>
          new Promise<boolean>((resolve) => {
            answerRef.current = resolve;
          }),
        onOutcome: setRestore,
        restore: async () => {
          if (!lattesId) {
            return {
              detail: 'O currículo aberto não tem o NUMERO-IDENTIFICADOR',
              kind: 'parar',
              reason: 'erro',
            };
          }
          setRestore({ kind: 'fazendo' });
          return makeRestorePoint({ exportNow, lattesId, ops, store: backupStore() });
        },
      });
    } finally {
      starting.current = false;
    }
  };

  /** A resposta da pessoa sem ponto novo; depois de uma rodada parada, só fecha o aviso. */
  const answer = (go: boolean) => {
    const resolve = answerRef.current;
    answerRef.current = undefined;
    setRestore(undefined);
    resolve?.(go);
  };

  // fields entra direto no BridgeState.
  return { begin, dropAll, fields: { answerRestore: answer, restore }, takeReply };
}
