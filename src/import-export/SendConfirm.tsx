// Confirmação antes de mandar a fila ao Lattes: o que vai mudar em cada item,
// campo a campo. O ponto de histórico de antes do envio é guardado sozinho, e
// o ponto de restauração vem logo depois de "Enviar ao Lattes" (LAT-59).

import { isDeleteOp } from '../bridge/delete.ts';
import { opRows } from '../bridge/field-labels.ts';
import type { BridgeOp } from '../bridge/plan.ts';
import { Modal } from '../ui/Modal.tsx';

export function SendConfirm({
  onCancel,
  onSend,
  open,
  ops,
}: {
  open: boolean;
  ops: BridgeOp[];
  onCancel: () => void;
  onSend: () => void;
}) {
  const n = ops.length;
  return (
    <Modal
      className="send-confirm"
      footer={
        <>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" type="button" onClick={onSend}>
            Enviar ao Lattes
          </button>
        </>
      }
      label="Enviar ao Lattes"
      open={open}
      subtitle="Antes, o editor guarda uma cópia do Lattes como está. Cada alteração é gravada, lida de volta e conferida. A fila para no primeiro problema."
      title={n === 1 ? 'Enviar 1 alteração ao Lattes?' : `Enviar ${n} alterações ao Lattes?`}
      onClose={onCancel}
    >
      <ul className="send-list">
        {ops.map((op) => (
          <li key={op.key}>
            <strong>{op.label}</strong>
            {isDeleteOp(op) && (
              <p className="send-delete">
                O item sai do Lattes, e o Lattes não tem como desfazer. Para voltar, só incluindo de
                novo no Lattes.
              </p>
            )}
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
    </Modal>
  );
}
