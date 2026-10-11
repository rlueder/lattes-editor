// Diálogos simples do App: histórico de estados e confirmação de recarga.

import type { PendingSummary } from '../import-export/ExportPanel.tsx';
import type { HistoryEntry } from '../model/store.ts';
import { Modal } from './Modal.tsx';

export function HistoryDialog({
  entries,
  onClose,
  onRestore,
  open,
}: {
  entries: HistoryEntry[];
  open: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
}) {
  return (
    <Modal
      className="history"
      label="Histórico de alterações"
      open={open}
      subtitle="Os últimos 50 estados salvos no navegador. Restaurar volta o currículo àquele ponto."
      title="Histórico de alterações"
      onClose={onClose}
    >
      <ul className="history-list">
        {entries.map((h) => (
          <li key={h.id}>
            <span>
              <time>{new Date(h.savedAt).toLocaleString('pt-BR')}</time> {h.note}
            </span>
            <button className="ghost" type="button" onClick={() => onRestore(h)}>
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Recarregar com itens novos pendentes os descarta; pede confirmação antes. */
export function ReloadConfirm({
  file,
  onCancel,
  onConfirm,
  pending,
}: {
  file: File | null;
  pending: PendingSummary[];
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  return (
    <Modal
      className="confirm"
      footer={
        <>
          <button className="ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" type="button" onClick={() => file && onConfirm(file)}>
            Recarregar mesmo assim
          </button>
        </>
      }
      label="Recarregar do Lattes"
      open={file !== null}
      title="Recarregar do Lattes"
      onClose={onCancel}
    >
      <p>
        {pending.length === 1
          ? 'Há 1 item novo que só existe aqui:'
          : `Há ${pending.length} itens novos que só existem aqui:`}
      </p>
      <ul className="confirm-list">
        {pending.map((p) => (
          <li key={p.sequencia}>{p.title || '(sem título)'}</li>
        ))}
      </ul>
      <p className="muted">
        Se você já importou esses itens no Lattes, eles vêm na nova exportação e pode seguir. Se
        não, eles se perdem ao recarregar.
      </p>
    </Modal>
  );
}
