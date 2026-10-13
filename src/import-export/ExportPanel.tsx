// "Levar ao Lattes": as duas formas de fazer o currículo do Lattes alcançar a
// cópia de trabalho. Itens de produção novos vão pelo Importar, com o XML e a
// lista de passos na tela; o resto vai à mão, pela lista de alterações.
// As instruções importam tanto quanto o arquivo (guia, seção 6): o Lattes
// pré-marca tudo nos Passos 2 e 3, e confirmar um item vermelho duplica.

import { elementLabel } from '../labels/labels.ts';
import type { Problem } from '../model/validate.ts';
import type { ChangeEntry, ChangeGroup } from '../ui/changes-view.ts';
import { changeCount } from '../ui/changes-view.ts';
import { ChangesList } from '../ui/ChangesList.tsx';
import { DownloadIcon } from '../ui/icons.tsx';
import { Modal } from '../ui/Modal.tsx';
import type { BridgeState } from '../ui/use-bridge.ts';
import { BridgeBlock } from './BridgeBlock.tsx';
import type { ImportFile } from './import-file.ts';
import { SentList } from './SentList.tsx';

export interface PendingSummary {
  problems: Problem[];
  sequencia: number;
  title: string;
  type: string;
  year?: number;
}

interface Props {
  /** Extensão do conector, quando instalada: envia o que ela sabe levar. */
  bridge?: BridgeState;
  changes: ChangeGroup[];
  file?: ImportFile;
  open: boolean;
  pending: PendingSummary[];
  onClose: () => void;
  onDiscard: (entry: ChangeEntry) => void;
  onDiscardField: (entry: ChangeEntry, attr: string) => void;
  onDownload: () => void;
  onOpenItem: (sequencia: number) => void;
}

export function ExportPanel({
  bridge,
  changes,
  file,
  onClose,
  onDiscard,
  onDiscardField,
  onDownload,
  onOpenItem,
  open,
  pending,
}: Props) {
  const open_ = changeCount(changes);
  const blocked = pending.filter((p) => p.problems.length > 0);
  const years = pending.map((p) => p.year).filter((y): y is number => y !== undefined);
  const minYear = years.length ? Math.min(...years) : undefined;

  return (
    <Modal
      className="export"
      footer={
        <>
          {file && blocked.length === 0 && (
            <button className="primary" type="button" onClick={onDownload}>
              <DownloadIcon />
              Baixar arquivo de importação
            </button>
          )}
          <button className="ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </>
      }
      label="Levar ao Lattes"
      open={open}
      subtitle="Itens novos entram pelo Importar do Lattes; o resto, à mão nos formulários."
      title="Levar ao Lattes"
      onClose={onClose}
    >
      <section className="panel-section">
        <h3 className="panel-section-head">
          <span className="step">1</span>
          Itens novos, pelo Importar
          {pending.length > 1 && <span className="count">{pending.length}</span>}
        </h3>

        {pending.length === 0 ? (
          <p className="empty">
            Nenhum item novo. Os itens criados em &quot;Novo item&quot; aparecem aqui até você
            importar no Lattes e recarregar a exportação.
          </p>
        ) : (
          <>
            <ul className="pending-list">
              {pending.map((p) => (
                <li key={p.sequencia}>
                  <button
                    className="ghost pending-item"
                    type="button"
                    onClick={() => onOpenItem(p.sequencia)}
                  >
                    <span className="item-kind">{elementLabel(p.type)}</span>
                    <span className="pending-title">{p.title || '(sem título)'}</span>
                    {p.problems.length > 0 ? (
                      <span className="tag warn">
                        {p.problems.length === 1
                          ? '1 pendência'
                          : `${p.problems.length} pendências`}
                      </span>
                    ) : (
                      <span className="tag ok">pronto</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {blocked.length > 0 ? (
              <p className="export-blocked">
                Corrija as pendências antes de gerar o arquivo. O Lattes descarta itens incompletos
                sem avisar.
              </p>
            ) : (
              file && (
                <>
                  <p className="muted">
                    Arquivo <code>{file.fileName}</code> com{' '}
                    {file.newItems === 1 ? '1 item novo' : `${file.newItems} itens novos`}. Depois
                    de baixar, no Lattes:
                  </p>
                  <ol className="lattes-steps">
                    <li>No Lattes, abra a opção Importar do currículo.</li>
                    <li>
                      Passo 1: envie o arquivo <code>{file.fileName}</code>.
                    </li>
                    <li>
                      Passo 2: desmarque &quot;Selecionar todos&quot; e marque só:
                      <ul>
                        {file.modules.map((m) => (
                          <li key={m.id}>
                            <strong>{m.label}</strong>
                          </li>
                        ))}
                      </ul>
                      {minYear !== undefined && (
                        <span className="muted">
                          Confira se &quot;Produção C&amp;T a partir de&quot; não passa de {minYear}
                          .
                        </span>
                      )}
                    </li>
                    <li className="danger-step">
                      Passo 3: os itens novos aparecem em verde.{' '}
                      <strong>Desmarque todos os itens vermelhos</strong>: eles já estão no seu
                      currículo, e confirmar um item vermelho cria uma cópia.
                    </li>
                    <li>Confirme.</li>
                    <li>
                      Depois, exporte o currículo de novo no Lattes e use &quot;Recarregar do
                      Lattes&quot; aqui. Os itens importados deixam de aparecer como novos.
                    </li>
                  </ol>
                </>
              )
            )}
          </>
        )}
      </section>

      <section className="panel-section">
        <h3 className="panel-section-head">
          <span className="step">2</span>
          Alterações, à mão nos formulários
          {open_ > 1 && <span className="count">{open_}</span>}
        </h3>
        {changes.length > 0 && (
          <p className="muted changes-how">
            Copie cada valor no formulário do Lattes; depois exporte o currículo de novo e use
            &quot;Recarregar do Lattes&quot;. O que já estiver lá some desta lista.
          </p>
        )}
        {bridge && <BridgeBlock bridge={bridge} />}
        <ChangesList groups={changes} onDiscard={onDiscard} onDiscardField={onDiscardField} />
      </section>

      {bridge && <SentList bridge={bridge} />}
    </Modal>
  );
}
