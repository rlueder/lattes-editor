// O ponto de restauração antes de gravar (LAT-59), quando ele não sai: sem
// ponto novo, a pessoa vê por quê e a cópia mais recente, e só segue com
// "Continuar sem ponto de restauração"; com a rodada parada (a sessão caiu),
// vê o motivo. O caminho feliz não abre nada: o aviso curto fica no
// BridgeBlock.

import { useEffect, useRef } from 'react';

import { latestText, noRestoreText, stopText } from '../bridge/restore-point.ts';
import { isDesktop } from '../desktop/native.ts';
import { Modal } from '../ui/Modal.tsx';
import type { BridgeState } from '../ui/use-bridge.ts';

export function RestorePointDialog({ bridge }: { bridge: BridgeState }) {
  const { restore } = bridge;
  const dismiss = useRef(bridge.dismissRestore);
  dismiss.current = bridge.dismissRestore;
  // O painel fechou com o ponto ainda sendo feito ou com a pergunta aberta:
  // vale como cancelar, nada é gravado e o aviso não volta ao reabrir.
  useEffect(() => () => dismiss.current(), []);

  if (restore?.kind === 'parar') {
    return (
      <Modal
        open
        className="restore-point"
        footer={
          <button className="primary" type="button" onClick={() => bridge.answerRestore(false)}>
            Fechar
          </button>
        }
        label="Envio parado"
        title="Envio parado"
        onClose={() => bridge.answerRestore(false)}
      >
        <p>{stopText(restore)}</p>
      </Modal>
    );
  }

  if (restore?.kind !== 'sem-ponto') return null;
  return (
    <Modal
      open
      className="restore-point"
      footer={
        <>
          <button type="button" onClick={() => bridge.answerRestore(false)}>
            Cancelar
          </button>
          <button className="danger" type="button" onClick={() => bridge.answerRestore(true)}>
            Continuar sem ponto de restauração
          </button>
        </>
      }
      label="Sem ponto de restauração"
      title="Enviar sem ponto de restauração?"
      onClose={() => bridge.answerRestore(false)}
    >
      <p>{noRestoreText(restore)}</p>
      <p>{latestText(restore.latest)}</p>
      <p className="muted">
        {isDesktop()
          ? 'As cópias estão em ⚙ › Versões do Lattes, em Cópias de segurança, numa pasta sua em Documentos.'
          : 'As cópias estão em ⚙ › Versões do Lattes, em Cópias de segurança, dentro deste navegador.'}
      </p>
    </Modal>
  );
}
