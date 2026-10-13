// O efeito de Abrir do Lattes na tela inicial; as regras estão em lattes-open.ts.

import { useCallback, useEffect, useRef, useState } from 'react';

import { fromBase64 } from '../bridge/export.ts';
import {
  canOpenFromLattes,
  OPEN_TIMEOUT_MS,
  type OpenState,
  retriesOnReading,
} from './lattes-open.ts';
import type { BridgeState } from './use-bridge.ts';

export interface LattesOpen {
  /** A extensão ligada sabe exportar. */
  available: boolean;
  open: () => void;
  state: OpenState;
}

/**
 * active: a tela inicial está aberta (sem currículo). A primeira vez que ela
 * aparece com a extensão pronta, o pedido sai sozinho; depois, só pelo botão
 * ou quando a extensão volta a ler o Lattes após uma falha que se resolve lá.
 */
export function useLattesOpen(
  active: boolean,
  bridge: Pick<BridgeState, 'curriculo' | 'link' | 'requestCv'>,
  onFile: (file: File) => void,
): LattesOpen {
  const [state, setState] = useState<OpenState>({ kind: 'parado' });
  const requestedAt = useRef<number | undefined>(undefined);
  const attempted = useRef(false);
  const linkState = useRef(bridge.link.state);
  linkState.current = bridge.link.state;
  const request = useRef(bridge.requestCv);
  request.current = bridge.requestCv;
  const fileRef = useRef(onFile);
  fileRef.current = onFile;
  const available = canOpenFromLattes(bridge.link);
  /** A leitura do Lattes que valia quando o pedido falhou. */
  const readingAtFailure = useRef(bridge.link.state);

  const open = useCallback(() => {
    attempted.current = true;
    requestedAt.current = Date.now();
    setState({ kind: 'abrindo' });
    request.current();
  }, []);

  // Primeira abertura sem currículo, com a extensão pronta: pede sozinho.
  useEffect(() => {
    if (active && available && !attempted.current) open();
  }, [active, available, open]);

  // A resposta do pedido feito agora (uma anterior não conta).
  const reply = bridge.curriculo;
  useEffect(() => {
    const since = requestedAt.current;
    if (!reply || since === undefined || reply.at < since) return;
    requestedAt.current = undefined;
    if (reply.zip) {
      setState({ kind: 'parado' });
      const bytes = fromBase64(reply.zip);
      fileRef.current(new File([bytes], reply.fileName ?? 'curriculo-lattes.zip'));
    } else {
      readingAtFailure.current = linkState.current;
      setState({ detail: reply.detail, kind: 'falhou', reason: reply.reason ?? 'erro' });
    }
  }, [reply]);

  // Sem resposta, não fica "abrindo" para sempre.
  useEffect(() => {
    if (state.kind !== 'abrindo') return;
    const timer = setTimeout(() => {
      requestedAt.current = undefined;
      setState({ kind: 'falhou', reason: 'sem-resposta' });
    }, OPEN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state]);

  // Falha que se resolve no Lattes: quando chega uma leitura nova do menu
  // (aviso aceito, Lattes aberto, sessão refeita), tenta outra vez. Só uma
  // leitura que chegou depois da falha conta, senão a mesma falha se repetiria.
  const reading = bridge.link.state;
  useEffect(() => {
    if (!active || state.kind !== 'falhou' || !retriesOnReading(state.reason)) return;
    if (reading === readingAtFailure.current) return;
    if (reading.kind === 'lido' || reading.kind === 'outro-cv') open();
  }, [active, open, reading, state]);

  return { available, open, state };
}
