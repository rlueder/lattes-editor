// Aviso na abertura quando o editor não pode guardar o trabalho cifrado: o
// chaveiro do sistema não respondeu, ou a chave que cifrava os dados sumiu
// (src/model/store.ts, StorageStatus).

import { useState } from 'react';

import { resetStorage, type StorageStatus } from '../model/store.ts';
import { Modal } from './Modal.tsx';

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
  const [open, setOpen] = useState(status !== 'cifrado');
  if (status === 'cifrado') return null;
  const close = () => setOpen(false);

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
              void resetStorage().then(() => {
                close();
                onReset();
              });
            }}
          >
            Apagar e começar de novo
          </button>
        </>
      }
      label="Os dados guardados não podem ser lidos"
      open={open}
      title="Os dados guardados não podem ser lidos"
      onClose={close}
    >
      <p>
        A chave que cifrava a cópia de trabalho não está mais no chaveiro do sistema: ele foi
        apagado, ou o app abriu com outro usuário. Sem ela, a cópia de trabalho, o histórico e o
        registro do que foi enviado ao Lattes não podem ser lidos.
      </p>
      <p>
        Dá para começar de novo a partir de uma exportação do Lattes. O registro do enviado se
        perde, e com ele o &quot;Desfazer no Lattes&quot; do que ainda não foi enviado ao CNPq. Até
        lá, nada é guardado.
      </p>
    </Modal>
  );
}
