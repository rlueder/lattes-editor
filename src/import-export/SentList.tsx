// "Enviado ao Lattes", dentro de "Levar ao Lattes": o que a ponte gravou e
// conferiu, por dia. O Lattes guarda essas gravações como pendentes até
// "Enviar ao CNPq" e não tem como descartá-las; desfazer daqui manda de
// volta o valor de antes, pela mesma confirmação de qualquer envio.

import { useMemo, useState } from 'react';

import { groupByDay, type SentEntry, undoneIds, undoOp } from '../bridge/sent-log.ts';
import { HistoryIcon } from '../ui/icons.tsx';
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

export function SentList({ bridge }: { bridge: BridgeState }) {
  const [undoing, setUndoing] = useState<SentEntry | undefined>();
  const [clearing, setClearing] = useState(false);
  const days = useMemo(() => groupByDay(bridge.sent), [bridge.sent]);
  const undone = useMemo(() => undoneIds(bridge.sent), [bridge.sent]);
  const reverse = undoing && undoOp(undoing);
  if (bridge.sent.length === 0) return null;

  return (
    <section className="panel-section sent">
      <h3 className="panel-section-head">
        <HistoryIcon />
        Enviado ao Lattes
        {bridge.sent.length > 1 && <span className="count">{bridge.sent.length}</span>}
      </h3>
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
              return (
                <li key={entry.id} className={wasUndone ? 'sent-undone' : undefined}>
                  <div className="sent-head">
                    <strong>{entry.op.label}</strong>
                    <span className="muted sent-time">{timeLabel(entry.sentAt)}</span>
                    {entry.undoOf === undefined && (
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
                  <dl>
                    {entry.rows.map((row) => (
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
          <button className="ghost" type="button" onClick={() => setClearing(true)}>
            Apagar este registro do app
          </button>
        )}
      </div>
    </section>
  );
}
