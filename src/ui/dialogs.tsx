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

/**
 * Fechar o currículo apaga a cópia de trabalho e o histórico deste navegador.
 * Antes, confirma, diz o que se perde e oferece salvar o arquivo.
 */
export function CloseConfirm({
  onCancel,
  onConfirm,
  onSave,
  open,
  pending,
}: {
  open: boolean;
  /** Alterações e itens novos que ainda não estão no Lattes. */
  pending: number;
  onCancel: () => void;
  onConfirm: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      className="confirm"
      footer={
        <>
          <button className="ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="ghost" type="button" onClick={onSave}>
            Salvar arquivo antes
          </button>
          <button className="primary danger-fill" type="button" onClick={onConfirm}>
            Fechar o currículo
          </button>
        </>
      }
      label="Fechar o currículo"
      open={open}
      title="Fechar o currículo?"
      onClose={onCancel}
    >
      <p>
        A cópia de trabalho e o histórico de alterações saem deste navegador. O currículo no Lattes
        não muda.
      </p>
      {pending > 0 && (
        <p className="confirm-warning">
          {pending === 1
            ? '1 alteração ou item novo ainda não está no Lattes e se perde ao fechar.'
            : `${pending} alterações ou itens novos ainda não estão no Lattes e se perdem ao fechar.`}
        </p>
      )}
      <p className="muted">
        Para continuar depois, salve o arquivo e abra de novo aqui, ou exporte outra vez do Lattes.
      </p>
    </Modal>
  );
}
