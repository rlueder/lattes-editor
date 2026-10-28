// O efeito de Abrir do Lattes na tela inicial; as regras estão em lattes-open.ts.

import { useCallback, useEffect, useRef, useState } from 'react';

import { fromBase64 } from '../bridge/export.ts';
import {
  canOpenFromLattes,
  type CvSource,
  OPEN_TIMEOUT_MS,
  type OpenState,
  retriesOnReading,
} from './lattes-open.ts';

export interface LattesOpen {
  /** A extensão ligada sabe exportar. */
  available: boolean;
  open: () => void;
  state: OpenState;
}

/**
 * A tela inicial aparece quando não há currículo aberto e o app já carregou
 * (booting). A primeira vez que ela aparece com a extensão pronta, o pedido
 * sai sozinho; depois, só pelo botão ou quando a extensão volta a ler o Lattes
 * após uma falha que se resolve lá. Depois de um currículo aberto nesta sessão
 * do app (cvOpen), fechar não pede de novo sozinho: quem fechou não quer que
 * ele volte.
 */
export function useLattesOpen(
  cvOpen: boolean,
  booting: boolean,
  bridge: CvSource,
  onFile: (file: File) => unknown,
): LattesOpen {
  const active = !cvOpen && !booting;
  const [state, setState] = useState<OpenState>({ kind: 'parado' });
  /** O pedido em aberto; só a resposta com este id vale. */
  const pending = useRef<string | undefined>(undefined);
  const attempted = useRef(false);
  const linkState = useRef(bridge.link.state);
  linkState.current = bridge.link.state;
  const request = useRef(bridge.requestCv);
  request.current = bridge.requestCv;
  const fileRef = useRef(onFile);
  fileRef.current = onFile;
  const available = canOpenFromLattes(bridge.link);
  const timeoutMs = bridge.timeoutMs ?? OPEN_TIMEOUT_MS;
  /** A leitura do Lattes que valia quando o pedido falhou. */
  const readingAtFailure = useRef(bridge.link.state);

  const open = useCallback(() => {
    attempted.current = true;
    const id = crypto.randomUUID();
    pending.current = id;
    setState({ kind: 'abrindo' });
    request.current(id);
  }, []);

  // Um currículo já esteve aberto (o guardado, ao abrir o app): a tela inicial
  // que aparece depois de fechá-lo não é a primeira, e o pedido não sai sozinho.
  useEffect(() => {
    if (cvOpen) attempted.current = true;
  }, [cvOpen]);

  // Primeira abertura sem currículo, com a extensão pronta: pede sozinho.
  useEffect(() => {
    if (active && available && !attempted.current) open();
  }, [active, available, open]);

  // Um currículo aberto por outro caminho (arquivo escolhido ou solto) encerra
  // o pedido: a resposta que chegar depois não substitui o que a pessoa abriu.
  useEffect(() => {
    if (active) return;
    pending.current = undefined;
    setState({ kind: 'parado' });
  }, [active]);

  // A resposta do pedido em aberto; uma atrasada, de um pedido anterior, não conta.
  const reply = bridge.curriculo;
  useEffect(() => {
    if (!active || !reply || !pending.current || reply.id !== pending.current) return;
    pending.current = undefined;
    if (reply.zip) {
      setState({ kind: 'parado' });
      try {
        const bytes = fromBase64(reply.zip);
        fileRef.current(new File([bytes], reply.fileName ?? 'curriculo-lattes.zip'));
      } catch {
        // Mensagem corrompida no caminho: a tela inicial mostra a falha.
        setState({ detail: 'O arquivo chegou corrompido', kind: 'falhou', reason: 'erro' });
      }
    } else {
      readingAtFailure.current = linkState.current;
      setState({
        detail: reply.detail,
        kind: 'falhou',
        lattesId: reply.lattesId,
        reason: reply.reason ?? 'erro',
      });
    }
  }, [active, reply]);

  // Sem resposta, não fica "abrindo" para sempre.
  useEffect(() => {
    if (state.kind !== 'abrindo') return;
    const timer = setTimeout(() => {
      pending.current = undefined;
      setState({ kind: 'falhou', reason: 'sem-resposta' });
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [state, timeoutMs]);

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
