// As gravações divergentes que bloqueiam "Enviar ao CNPq" (LAT-59, freio de
// escrita), dentro do painel do envio: cada uma com o motivo e o "Já conferi
// no Lattes". As regras estão em src/bridge/write-brake.ts.

import type { SentEntry } from '../bridge/sent-log.ts';
import { publishBlockText } from '../bridge/write-brake.ts';

export function PublishBlockers({
  blockers,
  onCheck,
}: {
  blockers: SentEntry[];
  onCheck: (entry: SentEntry) => Promise<void>;
}) {
  if (blockers.length === 0) return null;
  return (
    <section className="panel-section">
      <h3 className="panel-section-head">Gravações não conferidas</h3>
      <p className="export-blocked">{publishBlockText(blockers.length)}</p>
      <ul className="diagnosis-lines">
        {blockers.map((e, i) => (
          <li key={e.id ?? i}>
            <strong>{e.op.label}</strong>
            {e.outcome?.detail && <span className="muted"> {e.outcome.detail}</span>}{' '}
            <button
              className="ghost"
              disabled={e.id === undefined}
              type="button"
              onClick={() => void onCheck(e)}
            >
              Já conferi no Lattes
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
