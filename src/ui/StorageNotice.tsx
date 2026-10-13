// Aviso na abertura quando o editor não pode guardar o trabalho cifrado: o
// chaveiro do sistema não respondeu, ou a chave que cifrava os dados sumiu
// (src/model/store.ts, StorageStatus).

import { useState } from 'react';

import { resetStorage, type StorageStatus } from '../model/store.ts';
import { Modal } from './Modal.tsx';
import { setNoticeOpen, useNoticeOpen } from './storage-notice-open.ts';

export function StorageNotice({
  onReset,
  reason,
  status,
}: {
  reason?: string;
  status: StorageStatus;
  /** Depois de apagar os dados ilegíveis: o editor volta à tela inicial. */
  onReset: () => void;
}) {
  const open = useNoticeOpen(status);
  const [resetError, setResetError] = useState<string | undefined>();
  if (status === 'cifrado') return null;
  const close = () => setNoticeOpen(false);

  if (status === 'sem-chave') {
    return (
      <Modal
        footer={
          <button className="primary" type="button" onClick={close}>
            Entendi
          </button>
        }
        label="O trabalho não está sendo guardado"
        open={open}
        title="O trabalho não está sendo guardado"
        onClose={close}
      >
        <p>
          O LattesEditor guarda a cópia de trabalho cifrada, com a chave no chaveiro do sistema, e
          não conseguiu usar o chaveiro agora. Para não deixar o currículo legível no disco, nada é
          guardado nesta sessão: ao fechar o app, o que não foi levado ao Lattes se perde.
        </p>
        <p>
          No Linux, instale e desbloqueie um chaveiro (GNOME Keyring ou KWallet) e abra o app de
          novo. No macOS e no Windows, confira se o app tem acesso ao Keychain ou ao Gerenciador de
          Credenciais.
        </p>
        {reason && <p className="muted">Detalhe: {reason}</p>}
      </Modal>
    );
  }

  return (
    <Modal
      footer={
        <>
          <button type="button" onClick={close}>
            Agora não
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => {
              resetStorage().then(
                () => {
                  close();
                  onReset();
                },
                (err: unknown) => setResetError(err instanceof Error ? err.message : String(err)),
              );
            }}
          >
            Apagar e recomeçar
          </button>
        </>
      }
      label="Não dá para ler o trabalho guardado"
      open={open}
      title="Não dá para ler o trabalho guardado"
      onClose={close}
    >
      <p>
        A chave que protegia o trabalho guardado neste computador sumiu do chaveiro do sistema.
        Apague os dados e abra o currículo de novo. O registro do que foi enviado ao Lattes se
        perde, e até apagar nada é guardado.
      </p>
      {resetError && (
        <p className="field-error" role="alert">
          Não deu para apagar os dados guardados: {resetError}
        </p>
      )}
    </Modal>
  );
}
