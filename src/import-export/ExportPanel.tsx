// "Enviar ao Lattes", em três passos um embaixo do outro (SendSteps.tsx):
// ① revisar, ② gravar no Lattes, ③ publicar no CNPq. O passo ① é uma lista
// só, com itens novos e alterações, e cada coisa diz como vai hoje: pelo
// conector (a extensão grava e confere), pelo Importar (no arquivo de
// importação, com os passos na tela) ou ainda não ("O editor ainda não envia
// estes"). O histórico do que o conector gravou fica no fim, fechado.
// As instruções do Importar importam tanto quanto o arquivo (guia, seção 6): o
// Lattes pré-marca tudo nos Passos 2 e 3, e confirmar um item vermelho duplica.

import { useEffect, useMemo, useRef, useState } from 'react';

import { failed } from '../bridge/sent-log.ts';
import { elementLabel } from '../labels/labels.ts';
import type { Problem } from '../model/validate.ts';
import type { ChangeEntry, ChangeGroup } from '../ui/changes-view.ts';
import { ChangesList } from '../ui/ChangesList.tsx';
import { DownloadIcon, UploadIcon } from '../ui/icons.tsx';
import { Modal } from '../ui/Modal.tsx';
import type { StripState } from '../ui/status-strip.ts';
import { StatusStrip } from '../ui/StatusStrip.tsx';
import type { BridgeState } from '../ui/use-bridge.ts';
import type { ImportFile } from './import-file.ts';
import {
  canImportByConnector,
  IMPORT_REPLY_TIMEOUT_MS,
  type ImportAttempt,
  importStatus,
} from './import-request.ts';
import { type PublishContext, PublishStep } from './PublishStep.tsx';
import {
  listenTabRequests,
  splitByRoute,
  splitPending,
  takeRequestedTab,
  toSendCount,
} from './send-routes.ts';
import { currentStep, stepStates } from './send-steps.ts';
import { Notice, Step, StepHeader, WriteStep } from './SendSteps.tsx';
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
  /** O passo ③, publicar no CNPq (LAT-54): o que o painel de envio precisa. */
  publish: PublishContext;
  /**
   * Estado do currículo no Lattes (status-strip.ts): gravado e não publicado,
   * alterações que não passaram por aqui e a data da última publicação. Fica
   * no alto do painel; a contagem de alterações já está no selo e no aviso.
   */
  strip: StripState;
  onClose: () => void;
  onDiagnosis: () => void;
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
  onDiagnosis,
  onDiscard,
  onDiscardField,
  onDownload,
  onOpenItem,
  open,
  pending,
  publish,
  strip,
}: Props) {
  const blocked = pending.filter((p) => p.problems.length > 0);
  const years = pending.map((p) => p.year).filter((y): y is number => y !== undefined);
  const minYear = years.length ? Math.min(...years) : undefined;
  // Só o que o conector leva entra; sem conector, nenhuma rota é dele.
  const connectorOps = bridge?.available ? bridge.plan.ops : undefined;
  const connectorKeys = useMemo(
    () => new Set((connectorOps ?? []).map((op) => op.key)),
    [connectorOps],
  );
  const routed = useMemo(() => splitByRoute(changes, connectorKeys), [changes, connectorKeys]);
  const unsupported = bridge?.available ? bridge.plan.unsupported : undefined;
  const reasons = useMemo(
    () => new Map((unsupported ?? []).map((u) => [u.key, u.reason])),
    [unsupported],
  );
  const pendingBy = useMemo(() => splitPending(routed.pendente, reasons), [routed, reasons]);
  const toSend = toSendCount(pending.length, changes);
  // As tentativas que não deram certo ficam no registro, mas não contam como enviadas.
  const sent = bridge?.sent.filter((e) => !failed(e)).length ?? 0;
  // O histórico do enviado: fechado, a não ser que alguém peça (a faixa de
  // estado, "Enviado").
  const [history, setHistory] = useState(false);
  useEffect(() => {
    if (!open) return;
    setHistory(takeRequestedTab() === 'enviado');
    const stopListening = listenTabRequests((t) => setHistory(t === 'enviado'));
    return () => {
      stopListening();
      takeRequestedTab();
    };
  }, [open]);

  // A janela fechou com a cópia ainda sendo feita ou com a pergunta aberta:
  // vale como cancelar, nada é gravado e o aviso não volta ao reabrir. Fica
  // aqui, preso ao abrir e fechar da janela, e não no passo 2: ele só monta
  // quando a rodada começa, e o modo estrito do React roda a limpeza logo na
  // montagem, o que cancelava a rodada que acabava de começar.
  const dismissRestore = useRef(bridge?.dismissRestore);
  dismissRestore.current = bridge?.dismissRestore;
  useEffect(() => {
    if (!open) return;
    return () => dismissRestore.current?.();
  }, [open]);

  const toWrite = connectorOps?.length ?? 0;
  const writing = !!bridge && isWriting(bridge);
  const toPublish = !!bridge?.lattes?.pending;
  // Publicado por esta janela: o passo ③ fica com a confirmação, em vez de a
  // janela voltar ao passo ① sem dizer nada. Some ao fechar ou ao gravar de novo.
  const [publishedAt, setPublishedAt] = useState<number | undefined>();
  useEffect(() => {
    if (!open || writing) setPublishedAt(undefined);
  }, [open, writing]);
  const steps = stepStates({ published: !!publishedAt, toPublish, toWrite, writing });
  // Só o passo atual aparece; um passo já feito abre pelo clique na pílula, e
  // a janela volta a seguir o passo atual quando ele muda.
  const current = currentStep(steps);
  const [viewing, setViewing] = useState<number | undefined>();
  useEffect(() => setViewing(undefined), [current]);
  const shown = bridge?.available ? (viewing ?? current) : 0;
  // A última rodada parou com alteração que não conferiu: o passo 1 avisa.
  const stopped =
    bridge?.round && !writing
      ? bridge.round.filter((op) => {
          const r = bridge.results[op.key];
          return r && r.status !== 'conferido';
        }).length
      : 0;
  const plural = (n: number) => (n === 1 ? '1 alteração' : `${n} alterações`);

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
      label="Enviar ao Lattes"
      open={open}
      subtitle="Revise, grave no Lattes e publique no CNPq."
      title="Enviar ao Lattes"
      onClose={onClose}
    >
      <StatusStrip
        state={{
          ...strip,
          segments: strip.segments.filter((x) => x.kind !== 'original' && x.kind !== 'alteracoes'),
        }}
        onOpen={(kind) => (kind === 'pendencia-desconhecida' ? onDiagnosis() : setHistory(true))}
      />
      {bridge?.available && <StepHeader shown={shown} steps={steps} onSelect={setViewing} />}

      {shown === 0 && (
        <Step title="Revisar">
          {stopped > 0 && (
            <Notice
              warn
              actions={
                <button type="button" onClick={() => setViewing(1)}>
                  Ver a gravação
                </button>
              }
            >
              <p>
                {stopped === 1
                  ? 'A última gravação parou numa alteração que precisa ser conferida no Lattes.'
                  : `A última gravação parou com ${stopped} alterações que precisam ser conferidas no Lattes.`}
              </p>
            </Notice>
          )}
          {toSend === 0 ? (
            <p className="empty">
              Nada esperando para ir ao Lattes. Itens novos e alterações aparecem aqui, cada um com
              o caminho que vai seguir.
            </p>
          ) : (
            <>
              {bridge && routed.conector.length > 0 && (
                <>
                  <ChangesList
                    groups={routed.conector}
                    onDiscard={onDiscard}
                    onDiscardField={onDiscardField}
                  />
                  <div className="step-actions">
                    <span className="muted">
                      A extensão grava cada uma no Lattes e lê de volta para conferir.
                    </span>
                    <button
                      className="primary"
                      disabled={writing || toWrite === 0}
                      type="button"
                      onClick={() => void bridge.send()}
                    >
                      <UploadIcon /> Gravar {plural(toWrite)} no Lattes
                    </button>
                  </div>
                </>
              )}

              {pending.length > 0 && (
                <section className="panel-section">
                  <h4 className="panel-section-head">Itens novos, no arquivo de importação</h4>
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
                      Corrija as pendências antes de gerar o arquivo. O Lattes descarta itens
                      incompletos sem avisar.
                    </p>
                  ) : (
                    file && (
                      <>
                        <ImportSteps file={file} minYear={minYear} />
                        {bridge && canImportByConnector(bridge.link) && (
                          <ConnectorImport bridge={bridge} />
                        )}
                      </>
                    )
                  )}
                </section>
              )}

              {pendingBy.editor.length > 0 && (
                <section className="panel-section pending-unsupported">
                  <p className="muted changes-how">O editor ainda não envia estes</p>
                  <ChangesList
                    groups={pendingBy.editor}
                    reasons={reasons}
                    onDiscard={onDiscard}
                    onDiscardField={onDiscardField}
                  />
                </section>
              )}
              {pendingBy.lattes.length > 0 && (
                <section className="panel-section pending-unsupported">
                  <p className="muted changes-how">
                    O formulário do Lattes não tem onde gravar estes. Eles ficam no seu XML, mas não
                    chegam ao Lattes; descarte para tirar da lista.
                  </p>
                  <ChangesList
                    groups={pendingBy.lattes}
                    reasons={reasons}
                    onDiscard={onDiscard}
                    onDiscardField={onDiscardField}
                  />
                </section>
              )}
            </>
          )}
        </Step>
      )}

      {bridge?.available && shown === 1 && (
        <Step
          locked={bridge.round || writing ? undefined : 'Nenhuma gravação nesta sessão ainda.'}
          title="Gravar no Lattes"
        >
          <WriteStep bridge={bridge} />
        </Step>
      )}

      {bridge?.available && shown === 2 && (
        <PublishStep
          bridge={bridge}
          open={open}
          publish={publish}
          publishedAt={publishedAt}
          toPublish={toPublish}
          toWrite={toWrite}
          writing={writing}
          onClose={onClose}
          onPublished={() => setPublishedAt(Date.now())}
        />
      )}

      {bridge && bridge.sent.length > 0 && (
        <details
          className="send-history"
          open={history}
          onToggle={(e) => setHistory(e.currentTarget.open)}
        >
          <summary>Histórico do que foi enviado{sent > 0 ? ` (${sent})` : ''}</summary>
          <SentList bridge={bridge} onUndo={() => setHistory(false)} />
        </details>
      )}
    </Modal>
  );
}

/** Uma rodada em andamento: a cópia de antes, a pergunta sem cópia, gravando ou em pausa. */
function isWriting(bridge: BridgeState): boolean {
  const kind = bridge.restore?.kind;
  return (
    bridge.running ||
    !!bridge.pause ||
    kind === 'fazendo' ||
    kind === 'sem-ponto' ||
    kind === 'parar'
  );
}

/**
 * Importar pelo conector (LAT-50), só com IMPORT_ENABLED: a extensão faz os
 * passos 1 e 2 com um arquivo só com os itens novos e para antes do passo 3.
 */
function ConnectorImport({ bridge }: { bridge: BridgeState }) {
  const [attempt, setAttempt] = useState<ImportAttempt | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const status = importStatus(attempt, bridge.importResult, now);
  // Sem resposta, o prazo libera o botão de novo. Se a extensão desligar ou a
  // leitura do Lattes cair, o componente some e o estado vai junto.
  useEffect(() => {
    if (!status.busy || !attempt) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      attempt.at + IMPORT_REPLY_TIMEOUT_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [status.busy, attempt]);
  return (
    <div className="connector-import">
      <button
        className="ghost"
        disabled={status.busy}
        type="button"
        onClick={() => {
          const at = Date.now();
          setNow(at);
          setAttempt({ at, id: bridge.sendImport() });
        }}
      >
        Importar pelo conector
      </button>
      {status.text && (
        <p className="muted" role="status">
          {status.text}
        </p>
      )}
    </div>
  );
}

/** Os passos do Importar do Lattes para o arquivo gerado (guia, seção 6). */
function ImportSteps({ file, minYear }: { file: ImportFile; minYear?: number }) {
  return (
    <>
      <p className="muted">
        Arquivo <code>{file.fileName}</code> com{' '}
        {file.newItems === 1 ? '1 item novo' : `${file.newItems} itens novos`}. Depois de baixar, no
        Lattes:
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
              Confira se &quot;Produção C&amp;T a partir de&quot; não passa de {minYear}.
            </span>
          )}
        </li>
        <li className="danger-step">
          Passo 3: os itens novos aparecem em verde.{' '}
          <strong>Desmarque todos os itens vermelhos</strong>: eles já estão no seu currículo, e
          confirmar um item vermelho cria uma cópia.
        </li>
        <li>Confirme.</li>
        <li>
          Depois, exporte o currículo de novo no Lattes e use &quot;Recarregar do Lattes&quot; aqui.
          Os itens importados deixam de aparecer como novos.
        </li>
      </ol>
    </>
  );
}
