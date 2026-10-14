// Aba "Enviado" do painel Enviar ao Lattes: o que o conector gravou e
// conferiu, por dia. Cada campo mostra o rótulo em cima, o valor de antes
// riscado e o de depois logo abaixo. O Lattes guarda essas gravações como pendentes até
// "Enviar ao CNPq" e não tem como descartá-las; desfazer daqui manda de
// volta o valor de antes, pela mesma confirmação de qualquer envio. As
// tentativas que não terminaram conferidas aparecem marcadas, com o motivo, e
// o registro inteiro sai em texto para anexar a um recurso (LAT-47).

import { useMemo, useState } from 'react';

import {
  failed,
  groupByDay,
  noUndoReason,
  type SentEntry,
  sentLogFileName,
  sentLogText,
  undoneIds,
  undoOp,
} from '../bridge/sent-log.ts';
import { saveBytes } from '../desktop/native.ts';
import type { BridgeState } from '../ui/use-bridge.ts';
import { SendConfirm } from './SendConfirm.tsx';

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

const timeLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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

export function SentList({ bridge }: { bridge: BridgeState }) {
  const [undoing, setUndoing] = useState<SentEntry | undefined>();
  const [clearing, setClearing] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();
  const days = useMemo(() => groupByDay(bridge.sent), [bridge.sent]);
  const undone = useMemo(() => undoneIds(bridge.sent), [bridge.sent]);
  const reverse = undoing && undoOp(undoing);
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
                    <span className="muted sent-time">{timeLabel(entry.sentAt)}</span>
                    {entry.outcome && (
                      <span className="tag warn">{OUTCOME_LABEL[entry.outcome.status]}</span>
                    )}
                    {entry.undoOf === undefined && !failed(entry) && !noUndo && (
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
                  {entry.outcome?.detail && (
                    <p className="muted sent-outcome">{entry.outcome.detail}</p>
                  )}
                  {noUndo && !failed(entry) && <p className="muted sent-outcome">{noUndo}</p>}
                  <dl className="sent-fields">
                    {entry.rows.map((row) => (
                      <div key={row.name} className="sent-field">
                        <dt>{row.label}</dt>
                        <dd>
                          <span className="sent-before">
                            <span className="sr-only">Antes: </span>
                            {row.before || '(vazio)'}
                          </span>
                          <span className="sent-after">
                            <span className="sr-only">Depois: </span>
                            {row.after || '(vazio)'}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <SendConfirm
        open={reverse !== undefined}
        ops={reverse ? [reverse] : []}
        onCancel={() => setUndoing(undefined)}
        onSend={() => {
          const entry = undoing;
          setUndoing(undefined);
          if (entry) void bridge.send({ undo: entry });
        }}
      />
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
          <>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setExportError(undefined);
                // Cancelar a janela de salvar não é erro (saveBytes devolve false).
                exportLog(bridge.sent).catch((err: unknown) =>
                  setExportError(err instanceof Error ? err.message : String(err)),
                );
              }}
            >
              Exportar em texto
            </button>
            <button className="ghost" type="button" onClick={() => setClearing(true)}>
              Apagar este registro do app
            </button>
          </>
        )}
      </div>
    </section>
  );
}
