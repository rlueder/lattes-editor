// "Enviar ao Lattes": o que espera ir ao Lattes e o que já foi, em duas abas.
// "A enviar" é uma lista só, com itens novos e alterações, e cada coisa diz como
// vai hoje: pelo conector (a extensão grava e confere), pelo Importar (no
// arquivo de importação, com os passos na tela) ou à mão (copiar no formulário
// do Lattes). O objetivo é que tudo vá sozinho; sem nada à mão, essa parte some.
// "Enviado" é o registro do que o conector gravou.
// As instruções do Importar importam tanto quanto o arquivo (guia, seção 6): o
// Lattes pré-marca tudo nos Passos 2 e 3, e confirmar um item vermelho duplica.

import { Tabs } from '@base-ui/react/tabs';
import { useEffect, useMemo, useRef, useState } from 'react';

import { failed } from '../bridge/sent-log.ts';
import { elementLabel } from '../labels/labels.ts';
import type { Problem } from '../model/validate.ts';
import type { ChangeEntry, ChangeGroup } from '../ui/changes-view.ts';
import { ChangesList } from '../ui/ChangesList.tsx';
import { DownloadIcon } from '../ui/icons.tsx';
import { Modal } from '../ui/Modal.tsx';
import type { BridgeState } from '../ui/use-bridge.ts';
import { BridgeBlock } from './BridgeBlock.tsx';
import type { ImportFile } from './import-file.ts';
import { RouteTag } from './RouteTag.tsx';
import {
  initialTab,
  listenTabRequests,
  type PanelTab,
  splitByRoute,
  takeRequestedTab,
  toSendCount,
} from './send-routes.ts';
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
  const toSend = toSendCount(pending.length, changes);
  // As tentativas que não deram certo ficam no registro, mas não contam como enviadas.
  const sent = bridge?.sent.filter((e) => !failed(e)).length ?? 0;
  const [tab, setTab] = useState<PanelTab>(() => initialTab(toSend, sent));
  // A aba foi escolhida (pela pessoa ou por um pedido): a escolha automática para.
  const chosen = useRef(false);
  const choose = (next: PanelTab) => {
    chosen.current = true;
    setTab(next);
  };
  // Ao abrir: a aba pedida, se houver; e, enquanto aberto, os pedidos novos.
  // Ao fechar, um pedido que sobrou é descartado e não vale numa abertura
  // qualquer depois.
  useEffect(() => {
    if (!open) return;
    chosen.current = false;
    const requestedTab = takeRequestedTab();
    if (requestedTab) choose(requestedTab);
    const stopListening = listenTabRequests(choose);
    return () => {
      stopListening();
      takeRequestedTab();
    };
  }, [open]);
  // Sem escolha ainda, segue o que faz sentido agora: o registro do enviado
  // pode chegar um instante depois de o painel abrir.
  useEffect(() => {
    if (open && !chosen.current) setTab(initialTab(toSend, sent));
  }, [open, toSend, sent]);

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
      subtitle="O que espera ir ao Lattes, e como vai; e o que já foi."
      title="Enviar ao Lattes"
      onClose={onClose}
    >
      <Tabs.Root className="send-tabs" value={tab} onValueChange={(v) => choose(v as PanelTab)}>
        <Tabs.List aria-label="Enviar ao Lattes" className="send-tab-list">
          <Tabs.Tab className="send-tab" value="a-enviar">
            A enviar
            {toSend > 0 && <span className="count">{toSend}</span>}
          </Tabs.Tab>
          <Tabs.Tab className="send-tab" value="enviado">
            Enviado
            {sent > 0 && <span className="count">{sent}</span>}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel className="send-tab-panel" value="a-enviar">
          {toSend === 0 && !(bridge?.confirmed ?? 0) ? (
            <p className="empty">
              Nada esperando para ir ao Lattes. Itens novos e alterações aparecem aqui, cada um com
              o caminho que vai seguir.
            </p>
          ) : (
            <>
              {bridge && (routed.conector.length > 0 || bridge.confirmed > 0) && (
                <section className="panel-section">
                  <h3 className="panel-section-head">
                    <RouteTag route="conector" />
                    Gravado pela extensão, conferindo cada um
                  </h3>
                  <BridgeBlock bridge={bridge} />
                  {routed.conector.length > 0 && (
                    <ChangesList
                      groups={routed.conector}
                      route="conector"
                      onDiscard={onDiscard}
                      onDiscardField={onDiscardField}
                    />
                  )}
                </section>
              )}

              {pending.length > 0 && (
                <section className="panel-section">
                  <h3 className="panel-section-head">
                    <RouteTag route="importar" />
                    Itens novos, no arquivo de importação
                  </h3>
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
                    file && <ImportSteps file={file} minYear={minYear} />
                  )}
                </section>
              )}

              {routed.mao.length > 0 && (
                <section className="panel-section">
                  <h3 className="panel-section-head">
                    <RouteTag route="mao" />
                    Copiar no formulário do Lattes
                  </h3>
                  <p className="muted changes-how">
                    O editor ainda não grava estes campos sozinho. Copie cada valor no formulário do
                    Lattes; depois use &quot;Recarregar do Lattes&quot; e o que já estiver lá some
                    desta lista.
                  </p>
                  <ChangesList
                    groups={routed.mao}
                    route="mao"
                    onDiscard={onDiscard}
                    onDiscardField={onDiscardField}
                  />
                </section>
              )}
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel className="send-tab-panel" value="enviado">
          {bridge && sent > 0 ? (
            <SentList bridge={bridge} />
          ) : (
            <p className="empty">
              Nada enviado pelo conector ainda. O que a extensão gravar e conferir no Lattes fica
              registrado aqui, com o valor de antes e o de depois.
            </p>
          )}
        </Tabs.Panel>
      </Tabs.Root>
    </Modal>
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
