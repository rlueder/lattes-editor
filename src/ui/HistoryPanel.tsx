// "Histórico": no alto, o Lattes como está agora (LattesNow.tsx); embaixo,
// tudo o que aconteceu com o currículo no app, por dia (history-timeline.ts),
// cada linha com o que dá para fazer com ela.

import { type ReactNode, useEffect, useState } from 'react';

import type { HashRoute } from './hash-route.ts';
import type { TimelineEntry } from './history-timeline.ts';
import { ExportChanges } from './HistoryChanges.tsx';
import { Modal } from './Modal.tsx';
import type { HistoryState } from './use-history.ts';

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Restaurar o de antes" quando o estado guardado é o de antes do acontecimento. */
const restoreLabel = (entry: TimelineEntry) =>
  entry.kind === 'envio' || entry.kind === 'recarga' ? 'Restaurar o de antes' : 'Restaurar';

function Actions({
  entry,
  history,
  onToggleChanges,
  showing,
}: {
  entry: TimelineEntry;
  history: HistoryState;
  showing: boolean;
  onToggleChanges: () => void;
}) {
  const { desktop } = history;
  const zero = entry.backup?.kind === 'ponto-zero';
  const canRestore = entry.pointId !== undefined || (zero && entry.kind === 'abertura');
  const canSave = entry.pointId !== undefined || (entry.backup !== undefined && !desktop);
  const compare = entry.versionId !== undefined && entry.previousVersionId !== undefined;
  if (entry.kind === 'publicacao') return null;
  return (
    <span className="history-actions">
      {entry.kind === 'envio' && (entry.sent?.total ?? 0) > 0 && (
        <button className="ghost" type="button" onClick={history.showSent}>
          Ver o que foi enviado
        </button>
      )}
      {compare && (
        <button aria-expanded={showing} className="ghost" type="button" onClick={onToggleChanges}>
          Ver o que mudou
        </button>
      )}
      {canSave && (
        <button className="ghost" type="button" onClick={() => history.saveFile(entry)}>
          Salvar arquivo
        </button>
      )}
      {entry.backup && desktop && (
        <button className="ghost" type="button" onClick={() => history.reveal(entry)}>
          Mostrar na pasta
        </button>
      )}
      {canRestore && (
        <button className="ghost" type="button" onClick={() => history.restore(entry)}>
          {restoreLabel(entry)}
        </button>
      )}
    </span>
  );
}

function Footer({ history }: { history: HistoryState }) {
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (!history.open) setClearing(false);
  }, [history.open]);
  if (clearing) {
    return (
      <>
        <span className="muted versions-clear-note">
          Apaga os estados guardados e as exportações abertas deste currículo. Ficam a cópia de
          trabalho, o que já foi gravado no Lattes e as cópias de segurança.
        </span>
        <button type="button" onClick={() => setClearing(false)}>
          Manter
        </button>
        <button
          className="danger"
          type="button"
          onClick={() => {
            setClearing(false);
            history.clear();
          }}
        >
          Limpar o histórico
        </button>
      </>
    );
  }
  return (
    <>
      {history.desktop && (
        <button className="ghost" type="button" onClick={() => history.reveal()}>
          Abrir a pasta das cópias
        </button>
      )}
      {(history.days?.length ?? 0) > 0 && (
        <button className="ghost" type="button" onClick={() => setClearing(true)}>
          Limpar o histórico
        </button>
      )}
    </>
  );
}

export function HistoryPanel({
  history,
  lattesNow,
  onGo,
}: {
  history: HistoryState;
  /** "No Lattes agora", no alto. */
  lattesNow: ReactNode;
  onGo: (route: HashRoute) => void;
}) {
  // A linha com "Ver o que mudou" aberto; uma por vez.
  const [showing, setShowing] = useState<string>();
  useEffect(() => {
    if (!history.open) setShowing(undefined);
  }, [history.open]);
  const { days, desktop, error, folder } = history;
  const where = desktop
    ? `em ${folder ?? 'Documentos/LattesEditor/Cópias de segurança'}`
    : 'neste navegador, fora do histórico';
  return (
    <Modal
      className="history"
      footer={<Footer history={history} />}
      label="Histórico"
      open={history.open}
      subtitle="Tudo o que aconteceu com este currículo no app, do mais recente ao mais antigo. Restaurar volta a cópia de trabalho àquele momento."
      title="Histórico"
      onClose={history.close}
    >
      {lattesNow}
      <section aria-labelledby="history-list-title" className="panel-section">
        <h3 className="panel-section-head" id="history-list-title">
          Neste app
        </h3>
        {error && <p className="error">{error}</p>}
        {!days && !error && <p className="muted">Lendo o histórico…</p>}
        {days?.length === 0 && (
          <p className="muted">Nada guardado ainda. Cada edição, envio e recarga aparece aqui.</p>
        )}
        {days?.map((day) => (
          <div key={day.day} className="history-day">
            <h4 className="sent-day-head">{day.label}</h4>
            <ul className="history-list">
              {day.entries.map((entry) => {
                const key = `${entry.kind}-${entry.at}-${entry.pointId ?? ''}`;
                const open = showing === key;
                return (
                  <li key={key} className={`history-entry ${entry.kind}`}>
                    <span>
                      <time>{time(entry.at)}</time> {entry.text}
                    </span>
                    <Actions
                      entry={entry}
                      history={history}
                      showing={open}
                      onToggleChanges={() => setShowing(open ? undefined : key)}
                    />
                    {open &&
                      entry.versionId !== undefined &&
                      entry.previousVersionId !== undefined && (
                        <div className="history-changes">
                          <ExportChanges
                            newerId={entry.versionId}
                            olderId={entry.previousVersionId}
                            onGo={(route) => {
                              history.close();
                              onGo(route);
                            }}
                          />
                        </div>
                      )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="muted history-note">
          O app guarda as últimas 50 edições e o estado de antes de cada envio. A primeira abertura
          e o Lattes de antes de cada envio também ficam {where}, e o app nunca os apaga.
        </p>
      </section>
    </Modal>
  );
}
