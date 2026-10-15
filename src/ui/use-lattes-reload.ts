// O efeito de "Recarregar do Lattes…" pela ponte (LAT-46); as regras estão em
// lattes-reload.ts. Enquanto o pedido anda, um aviso no canto; a falha fica no
// sino até a próxima tentativa dar certo.

import { useCallback, useEffect, useRef, useState } from 'react';

import { canOpenFromLattes, OPEN_TIMEOUT_MS } from './lattes-open.ts';
import { type ReloadFailure, reloadReply } from './lattes-reload.ts';
import { toasts } from './toasts.ts';
import type { BridgeState } from './use-bridge.ts';

export interface LattesReload {
  /** A extensão ligada sabe exportar: o menu pede o ZIP em vez de um arquivo. */
  available: boolean;
  failure?: ReloadFailure;
  start: () => void;
}

/**
 * lattesId: o currículo aberto, que a sessão do Lattes precisa ter.
 * onFile: o mesmo caminho do arquivo escolhido à mão (App.reload), com a
 * confirmação quando há itens novos ainda não importados.
 */
export function useLattesReload(
  bridge: Pick<BridgeState, 'curriculo' | 'link' | 'requestCv'>,
  lattesId: string | undefined,
  onFile: (file: File) => void,
): LattesReload {
  const [pending, setPending] = useState<string | undefined>();
  const [failure, setFailure] = useState<ReloadFailure | undefined>();
  const toast = useRef<string | undefined>(undefined);
  const request = useRef(bridge.requestCv);
  request.current = bridge.requestCv;
  const fileRef = useRef(onFile);
  fileRef.current = onFile;
  const idRef = useRef(lattesId);
  idRef.current = lattesId;

  const finish = useCallback((next?: ReloadFailure) => {
    setPending(undefined);
    setFailure(next);
    if (toast.current) toasts.close(toast.current);
    toast.current = undefined;
  }, []);

  const start = useCallback(() => {
    const id = crypto.randomUUID();
    setPending(id);
    setFailure(undefined);
    if (toast.current) toasts.close(toast.current);
    toast.current = toasts.add({
      description: 'A extensão está pedindo a exportação ao Lattes.',
      title: 'Recarregando do Lattes',
    });
    request.current(id);
  }, []);

  // A resposta do pedido em aberto; uma atrasada, de outro pedido, não conta.
  const reply = bridge.curriculo;
  useEffect(() => {
    if (!pending || !reply || reply.id !== pending) return;
    const outcome = reloadReply(reply, idRef.current);
    if ('file' in outcome) {
      finish();
      fileRef.current(outcome.file);
    } else finish(outcome.failure);
  }, [finish, pending, reply]);

  // Sem resposta, não fica esperando para sempre.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => finish({ reason: 'sem-resposta' }), OPEN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [finish, pending]);

  return { available: canOpenFromLattes(bridge.link), failure, start };
}
