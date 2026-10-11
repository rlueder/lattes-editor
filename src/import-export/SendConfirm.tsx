// Confirmação antes de mandar a fila ao Lattes: o que vai mudar em cada item,
// campo a campo, e a cópia de segurança do currículo, marcada por padrão.

import { useId, useState } from 'react';

import { opRows } from '../bridge/field-labels.ts';
import type { BridgeOp } from '../bridge/plan.ts';
import { Modal } from '../ui/Modal.tsx';
import { Switch } from '../ui/primitives/Switch.tsx';

export function SendConfirm({
  onCancel,
  onSend,
  open,
  ops,
}: {
  open: boolean;
  ops: BridgeOp[];
  onCancel: () => void;
  onSend: (backup: boolean) => void;
}) {
  const [backup, setBackup] = useState(true);
  const backupId = useId();
  const n = ops.length;
  return (
    <Modal
      className="send-confirm"
      footer={
        <>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" type="button" onClick={() => onSend(backup)}>
            Enviar ao Lattes
          </button>
        </>
      }
      label="Enviar ao Lattes"
      open={open}
      subtitle="Cada alteração é gravada, lida de volta e conferida. A fila para no primeiro problema."
      title={n === 1 ? 'Enviar 1 alteração ao Lattes?' : `Enviar ${n} alterações ao Lattes?`}
      onClose={onCancel}
    >
      <ul className="send-list">
        {ops.map((op) => (
          <li key={op.key}>
            <strong>{op.label}</strong>
            <dl>
              {opRows(op).map((row) => (
                <div key={row.name} className="send-field">
                  <dt>{row.label}</dt>
                  <dd>
                    <span className="send-before">{row.before}</span>
                    <span aria-hidden="true"> → </span>
                    <span>{row.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="send-backup">
        <Switch aria-labelledby={backupId} checked={backup} onChange={setBackup} />
        <span id={backupId}>
          Baixar antes uma cópia do currículo como ele está no Lattes (recomendado)
        </span>
      </div>
    </Modal>
  );
}
