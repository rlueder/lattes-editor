// Gerar o XML para o Importar do Lattes, com a lista de passos na tela.
// As instruções importam tanto quanto o arquivo (guia, seção 6): o Lattes
// pré-marca tudo nos Passos 2 e 3, e confirmar um item vermelho duplica.

import { elementLabel } from '../labels/labels.ts';
import type { Problem } from '../model/validate.ts';
import { Modal } from '../ui/Modal.tsx';
import type { ImportFile } from './import-file.ts';

export interface PendingSummary {
  problems: Problem[];
  sequencia: number;
  title: string;
  type: string;
  year?: number;
}

interface Props {
  file?: ImportFile;
  open: boolean;
  pending: PendingSummary[];
  onClose: () => void;
  onDownload: () => void;
  onOpenItem: (sequencia: number) => void;
}

export function ExportPanel({ file, onClose, onDownload, onOpenItem, open, pending }: Props) {
  const blocked = pending.filter((p) => p.problems.length > 0);
  const years = pending.map((p) => p.year).filter((y): y is number => y !== undefined);
  const minYear = years.length ? Math.min(...years) : undefined;

  return (
    <Modal className="export" label="Gerar XML para importação" open={open} onClose={onClose}>
      <h2>Gerar XML para importação</h2>

      {pending.length === 0 ? (
        <p className="muted">
          Nenhum item novo. Itens criados aqui aparecem nesta lista até você importar no Lattes e
          recarregar a exportação.
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
                      {p.problems.length === 1 ? '1 pendência' : `${p.problems.length} pendências`}
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
                <div className="export-download">
                  <button className="primary" type="button" onClick={onDownload}>
                    Baixar {file.fileName}
                  </button>
                  <span className="muted">
                    {file.newItems === 1 ? '1 item novo' : `${file.newItems} itens novos`}
                  </span>
                </div>

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
                        Confira se &quot;Produção C&amp;T a partir de&quot; não passa de {minYear}.
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
      <div className="export-foot">
        <button className="ghost" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
