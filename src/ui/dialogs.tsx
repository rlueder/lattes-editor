// Diálogos simples do App: histórico de estados, confirmação de recarga e as
// confirmações antes de descartar ou remover.

import { type ReactNode, useState } from 'react';

import type { PendingSummary } from '../import-export/ExportPanel.tsx';
import type { HistoryInfo } from '../model/store.ts';
import { AlertIcon } from './icons.tsx';
import { Modal } from './Modal.tsx';

export function HistoryDialog({
  entries,
  onClose,
  onRestore,
  onSave,
  open,
}: {
  entries: HistoryInfo[];
  open: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryInfo) => void;
  /** Salva aquele ponto num arquivo XML, sem mudar a cópia de trabalho. */
  onSave: (entry: HistoryInfo) => void;
}) {
  return (
    <Modal
      className="history"
      label="Histórico de alterações"
      open={open}
      subtitle="Os últimos 50 estados, guardados no app, inclusive um antes de cada envio ao Lattes. Restaurar volta o currículo àquele ponto; Salvar cópia grava aquele ponto num arquivo."
      title="Histórico de alterações"
      onClose={onClose}
    >
      <ul className="history-list">
        {entries.map((h) => (
          <li key={h.id}>
            <span>
              <time>{new Date(h.savedAt).toLocaleString('pt-BR')}</time> {h.note}
            </span>
            <span className="history-actions">
              <button className="ghost" type="button" onClick={() => onSave(h)}>
                Salvar cópia
              </button>
              <button className="ghost" type="button" onClick={() => onRestore(h)}>
                Restaurar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/**
 * Recarregar troca a cópia de trabalho pela exportação nova: itens novos e
 * alterações que não foram ao Lattes saem dela. Pede confirmação antes, e a
 * cópia de agora fica no histórico.
 */
export function ReloadConfirm({
  changes,
  file,
  onCancel,
  onConfirm,
  pending,
}: {
  /** Alterações do editor que não foram ao Lattes (além dos itens novos). */
  changes: number;
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
      {pending.length > 0 && (
        <>
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
        </>
      )}
      {changes > 0 && (
        <p>
          {changes === 1
            ? '1 alteração feita aqui ainda não foi ao Lattes.'
            : `${changes} alterações feitas aqui ainda não foram ao Lattes.`}
        </p>
      )}
      <p className="muted">
        A nova exportação traz o que está publicado no Lattes. O que só existe aqui sai da cópia de
        trabalho, mas a cópia de agora fica no Histórico de alterações, marcada para não sair, e dá
        para restaurá-la ou salvá-la em arquivo.
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
          <button className="text-btn" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="ghost" type="button" onClick={onSave}>
            Salvar XML
          </button>
          <button className="primary danger-fill" type="button" onClick={onConfirm}>
            Descartar
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
          <AlertIcon />
          <span>
            {pending === 1
              ? '1 alteração ou item novo ainda não está no Lattes e se perde ao fechar.'
              : `${pending} alterações ou itens novos ainda não estão no Lattes e se perdem ao fechar.`}
          </span>
        </p>
      )}
      <p className="muted">
        Para continuar depois, salve o arquivo e abra de novo aqui, ou exporte outra vez do Lattes.
      </p>
    </Modal>
  );
}

/**
 * Fechar um formulário com algo preenchido (Esc, clique fora ou o botão de
 * fechar) pergunta antes: um Esc sem querer não pode levar o que a pessoa
 * digitou. Continuar editando é o botão principal e o que o Esc faz aqui.
 */
export function DiscardConfirm({
  onDiscard,
  onKeep,
  open,
}: {
  open: boolean;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  return (
    <Modal
      className="confirm"
      footer={
        <>
          <button className="text-btn" type="button" onClick={onDiscard}>
            Descartar
          </button>
          <button autoFocus className="primary" type="button" onClick={onKeep}>
            Continuar editando
          </button>
        </>
      }
      label="Descartar as mudanças"
      open={open}
      title="Descartar as mudanças?"
      onClose={onKeep}
    >
      <p>O que você preencheu ou mudou neste item se perde.</p>
    </Modal>
  );
}

/**
 * Confirmação antes de uma ação que apaga algo sem volta direta (descartar
 * uma alteração na lista do "Enviar ao Lattes", remover um item). Cancelar
 * recebe o foco, para um Enter sem querer não apagar nada.
 */
export function RemoveConfirm({
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  children: ReactNode;
  confirmLabel: string;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      className="confirm"
      footer={
        <>
          <button autoFocus className="text-btn" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary danger-fill" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
      label={title}
      open={open}
      title={title}
      onClose={onCancel}
    >
      {children}
    </Modal>
  );
}

/** "Remover item", com a pergunta antes: a cópia de trabalho não tem desfazer. */
export function RemoveItemButton({ onRemove }: { onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button className="ghost danger" type="button" onClick={() => setAsking(true)}>
        Remover item
      </button>
      <RemoveConfirm
        confirmLabel="Remover item"
        open={asking}
        title="Remover o item?"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onRemove();
        }}
      >
        <p>O item sai da cópia de trabalho. O currículo no Lattes não muda.</p>
      </RemoveConfirm>
    </>
  );
}
