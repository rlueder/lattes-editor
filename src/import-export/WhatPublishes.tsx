// "O que vai ser publicado", no alto do passo ③ (PublishPanel): a última
// publicação, o que o editor gravou desde então e a comparação dos títulos com
// a versão publicada, num aviso verde quando nada entra nem sai.

import type { SentEntry } from '../bridge/sent-log.ts';
import { openExternal } from '../desktop/external-links.ts';
import type { diffEspelho } from '../review/espelho-diff.ts';
import { dateLabel } from '../ui/status-strip.ts';
import type { BridgeState } from '../ui/use-bridge.ts';
import { Notice } from './SendSteps.tsx';

/** O que vai ser publicado: a última publicação, o que o editor gravou e a comparação dos títulos. */
export function WhatPublishes({
  bridge,
  diff,
  pending,
  previews,
}: {
  bridge: BridgeState;
  diff: ReturnType<typeof diffEspelho> | undefined;
  pending: SentEntry[];
  previews?: { en: string; pt: string };
}) {
  const unchanged = !!diff && diff.onlyInLattes.length === 0 && diff.onlyInExport.length === 0;
  return (
    <section className="panel-section">
      <h3 className="panel-section-head">O que vai ser publicado</h3>
      <ul className="diagnosis-facts">
        <li>
          Última publicação:{' '}
          <strong>
            {bridge.lattes?.lastPublished
              ? dateLabel(bridge.lattes.lastPublished)
              : 'não informada'}
          </strong>
        </li>
        {pending.length > 0 && (
          <li>
            {pending.length === 1
              ? '1 gravação do editor desde então:'
              : `${pending.length} gravações do editor desde então:`}
            <ul className="diagnosis-lines">
              {pending.map((e, i) => (
                <li key={e.id ?? i}>{e.op.label}</li>
              ))}
            </ul>
          </li>
        )}
        {bridge.lattes?.pending && pending.length === 0 && (
          <li>Há alterações no Lattes que não passaram pelo editor.</li>
        )}
        {bridge.lattes && !bridge.lattes.pending && pending.length === 0 && (
          <li>O Lattes não mostra nada pendente de publicação.</li>
        )}
      </ul>
      {diff && !diff.unreadable && (
        <Notice ok={unchanged}>
          <p>
            Comparando os títulos com a última versão publicada:{' '}
            {unchanged
              ? 'nenhuma produção ou evento entra ou sai.'
              : `${[
                  diff.onlyInLattes.length ? `${diff.onlyInLattes.length} entram` : '',
                  diff.onlyInExport.length
                    ? `${diff.onlyInExport.length} saem ou mudam de título`
                    : '',
                ]
                  .filter(Boolean)
                  .join(', ')}.`}
          </p>
        </Notice>
      )}
      {diff && diff.onlyInLattes.length > 0 && (
        <ul className="diagnosis-lines">
          {diff.onlyInLattes.map((item, i) => (
            <li key={i}>
              <span className="muted">{item.group ?? item.section}</span> {item.text}
            </li>
          ))}
        </ul>
      )}
      {diff && diff.onlyInExport.length > 0 && (
        <ul className="diagnosis-lines">
          {diff.onlyInExport.map(({ title }, i) => (
            <li key={i}>
              <span className="muted">Sai ou muda de título</span> {title}
            </li>
          ))}
        </ul>
      )}
      {previews && (
        <div className="publish-previews">
          <button type="button" onClick={() => previews && openExternal(previews.pt)}>
            Ver a versão em português
          </button>
          <button type="button" onClick={() => previews && openExternal(previews.en)}>
            Ver a versão em inglês
          </button>
        </div>
      )}
    </section>
  );
}
