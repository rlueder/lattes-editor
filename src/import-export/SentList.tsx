// O histórico do enviado, no fim da janela Enviar ao Lattes: o que o conector gravou e
// conferiu, por dia. Cada campo mostra o rótulo em cima e, embaixo, o valor
// de antes riscado e o de depois, lado a lado (FieldChange). O Lattes guarda essas gravações como pendentes até
// "Enviar ao CNPq" e não tem como descartá-las; desfazer daqui manda de
// volta o valor de antes, com a confirmação na própria entrada, e a rodada
// aparece no passo da gravação como qualquer envio. As
// tentativas que não terminaram conferidas aparecem marcadas, com o motivo, e
// o registro inteiro sai em texto para anexar a um recurso (LAT-47).

import { Menu } from '@base-ui/react/menu';
import { useMemo, useState } from 'react';

import {
  failed,
  groupByDay,
  noUndoReason,
  opBadge,
  type SentEntry,
  sentLogFileName,
  sentLogText,
  undoneIds,
  undoOp,
} from '../bridge/sent-log.ts';
import { saveBytes } from '../desktop/native.ts';
import { FieldChange } from '../ui/FieldChange.tsx';
import { MoreIcon } from '../ui/icons.tsx';
import type { BridgeState } from '../ui/use-bridge.ts';
import { publishBlockers } from './publish-view.ts';
import { Notice } from './SendSteps.tsx';

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

const timeLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const checkedLabel = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const OUTCOME_LABEL = {
  divergente: 'Não conferido',
  erro: 'Não gravado',
  sessao: 'Não gravado',
} as const;

/** O registro em .txt, com o currículo e a versão do app, para anexar a um recurso. */
async function exportLog(entries: SentEntry[]) {
  const lattesId = entries[0]?.lattesId ?? '';
  const now = Date.now();
  const text = sentLogText(entries, { appVersion: __APP_VERSION__, lattesId, now });
  await saveBytes(new TextEncoder().encode(text), sentLogFileName(lattesId, now), 'text/plain');
}

/**
 * onUndo: o desfazer começou; quem mostra a lista (a janela de envio) vai
 * para o passo da gravação, onde a rodada aparece.
 */
export function SentList({ bridge, onUndo }: { bridge: BridgeState; onUndo?: () => void }) {
  const [undoing, setUndoing] = useState<SentEntry | undefined>();
  const [clearing, setClearing] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();
  const days = useMemo(() => groupByDay(bridge.sent), [bridge.sent]);
  const undone = useMemo(() => undoneIds(bridge.sent), [bridge.sent]);
  // As divergentes que bloqueiam o envio ao CNPq agora (LAT-59).
  const blocking = useMemo(
    () => new Set(publishBlockers(bridge.sent, bridge.lattes)),
    [bridge.sent, bridge.lattes],
  );
  if (bridge.sent.length === 0) return null;

  return (
    <section className="panel-section sent" id="enviado-ao-lattes">
      <p className="muted sent-how">
        Estas gravações só ficam públicas depois de &quot;Enviar ao CNPq&quot; no Lattes, e o Lattes
        não tem como descartá-las. Para voltar atrás, desfaça aqui antes de enviar.
      </p>
      {days.map(({ day, entries }) => (
        <div key={day} className="sent-day">
          <h4 className="sent-day-head">{dayLabel(day)}</h4>
          <ul className="send-list sent-list">
            {entries.map((entry) => {
              const wasUndone = entry.id !== undefined && undone.has(entry.id);
              const canUndo =
                bridge.available && !bridge.running && !wasUndone && undoOp(entry) !== undefined;
              // Criar e excluir não se desfazem mandando o "antes": em vez do
              // botão, o motivo fica escrito, à vista.
              const noUndo = noUndoReason(entry.op);
              return (
                <li
                  key={entry.id}
                  className={wasUndone ? 'sent-undone' : failed(entry) ? 'sent-failed' : undefined}
                >
                  <div className="sent-head">
                    <strong>{entry.op.label}</strong>
                    {opBadge(entry.op) && (
                      <span className={`change-kind kind-${opBadge(entry.op)}`}>
                        {opBadge(entry.op)}
                      </span>
                    )}
                    <span className="muted sent-time">{timeLabel(entry.sentAt)}</span>
                    {entry.outcome && (
                      <span className="sent-side">
                        {/* Conferida à mão: o selo passa a dizer isso, em verde. */}
                        {entry.checkedAt === undefined ? (
                          <span className="tag warn">{OUTCOME_LABEL[entry.outcome.status]}</span>
                        ) : (
                          <span className="tag ok">Conferido</span>
                        )}
                        {blocking.has(entry) && entry.checkedAt === undefined && (
                          <button
                            className="primary sent-check"
                            disabled={entry.id === undefined}
                            type="button"
                            onClick={() => void bridge.checkSent(entry)}
                          >
                            Já conferi no Lattes
                          </button>
                        )}
                      </span>
                    )}
                    {entry.undoOf === undefined &&
                      !failed(entry) &&
                      !noUndo &&
                      undoing !== entry && (
                        <button
                          className="ghost sent-undo"
                          disabled={!canUndo}
                          title={
                            wasUndone
                              ? 'Já desfeito'
                              : bridge.available
                                ? undefined
                                : 'Precisa da extensão e do Lattes aberto'
                          }
                          type="button"
                          onClick={() => setUndoing(entry)}
                        >
                          {wasUndone ? 'Desfeito' : 'Desfazer no Lattes'}
                        </button>
                      )}
                  </div>
                  {undoing === entry && (
                    <Notice
                      actions={
                        <>
                          <button type="button" onClick={() => setUndoing(undefined)}>
                            Cancelar
                          </button>
                          <button
                            className="primary"
                            disabled={!canUndo}
                            type="button"
                            onClick={() => {
                              setUndoing(undefined);
                              void bridge.send({ undo: entry });
                              onUndo?.();
                            }}
                          >
                            Desfazer no Lattes
                          </button>
                        </>
                      }
                      role="group"
                    >
                      <p>
                        Gravar de volta no Lattes o valor de antes? A extensão confere que o Lattes
                        está com o de depois, grava e lê de volta, como em qualquer envio.
                      </p>
                    </Notice>
                  )}
                  {entry.outcome?.detail && (
                    <p className="muted sent-outcome">{entry.outcome.detail}</p>
                  )}
                  {(blocking.has(entry) || entry.checkedAt !== undefined) && (
                    <p className="muted sent-outcome">
                      {entry.checkedAt === undefined
                        ? 'Enquanto não for conferida no Lattes, esta gravação bloqueia o envio ao CNPq pelo editor.'
                        : `Você conferiu no Lattes em ${checkedLabel(entry.checkedAt)}.`}
                    </p>
                  )}
                  {noUndo && !failed(entry) && <p className="muted sent-outcome">{noUndo}</p>}
                  <div className="sent-fields">
                    {entry.rows.map((row) => (
                      <FieldChange
                        key={row.name}
                        captions
                        after={row.after}
                        before={row.before}
                        label={row.label}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {exportError && (
        <p className="error" role="alert">
          O registro em texto não foi salvo: {exportError}
        </p>
      )}
      <div className="sent-clear">
        {clearing ? (
          <>
            <p className="muted">
              Apagar o registro não muda nada no Lattes, e depois não dá para desfazer daqui o que
              ainda não foi enviado ao CNPq.
              {blocking.size > 0 &&
                ` ${blocking.size === 1 ? 'Há uma gravação divergente' : `Há ${blocking.size} gravações divergentes`} bloqueando o envio ao CNPq: apagar o registro tira o bloqueio sem que ninguém confira no Lattes.`}
            </p>
            <button type="button" onClick={() => setClearing(false)}>
              Manter
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => {
                setClearing(false);
                void bridge.clearSent();
              }}
            >
              Apagar registro
            </button>
          </>
        ) : (
          <Menu.Root>
            <Menu.Trigger aria-label="Mais ações do registro" className="ghost icon-btn">
              <MoreIcon />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" className="popup-positioner" sideOffset={6}>
                <Menu.Popup className="menu">
                  <Menu.Item
                    className="menu-item"
                    onClick={() => {
                      setExportError(undefined);
                      // Cancelar a janela de salvar não é erro (saveBytes devolve false).
                      exportLog(bridge.sent).catch((err: unknown) =>
                        setExportError(err instanceof Error ? err.message : String(err)),
                      );
                    }}
                  >
                    Exportar em texto, para anexar a um recurso
                  </Menu.Item>
                  <Menu.Item className="menu-item" onClick={() => setClearing(true)}>
                    Apagar este registro do app…
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </section>
  );
}
