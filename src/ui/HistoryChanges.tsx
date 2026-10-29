// O que mudou numa exportação aberta em relação à anterior (LAT-12): no
// Histórico, em "Ver o que mudou", e na faixa curta que aparece logo depois
// de abrir ou recarregar.

import { useEffect, useState } from 'react';

import type { ChangeKind } from '../model/changes.ts';
import { getVersion } from '../model/store.ts';
import { parseXml } from '../model/xml.ts';
import type { HashRoute } from './hash-route.ts';
import { CloseIcon } from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import { buildSections } from './sections.ts';
import { changesSummary, diffVersions } from './version-diff.ts';

const KIND: Record<ChangeKind, string> = {
  alterado: 'Alterado',
  novo: 'Novo',
  removido: 'Removido',
};

/** O que mudou entre duas exportações; só estas duas são decifradas, ao pedir. */
export function ExportChanges({
  newerId,
  olderId,
  onGo,
}: {
  newerId: number;
  olderId: number;
  onGo: (route: HashRoute) => void;
}) {
  const [diff, setDiff] = useState<ReturnType<typeof diffVersions> | 'erro'>();
  useEffect(() => {
    setDiff(undefined);
    let current = true;
    Promise.all([getVersion(newerId), getVersion(olderId)]).then(
      ([a, b]) => {
        if (!current) return;
        if (!a || !b) return setDiff('erro');
        const root = parseXml(a.xml).root;
        setDiff(diffVersions(parseXml(b.xml).root, root, buildSections(root)));
      },
      () => current && setDiff('erro'),
    );
    return () => {
      current = false;
    };
  }, [newerId, olderId]);
  if (diff === 'erro') return <p className="muted">Não deu para abrir as duas exportações.</p>;
  if (!diff) return <p className="muted">Comparando…</p>;
  return (
    <>
      <p className="versions-summary">{changesSummary(diff)}</p>
      {diff.groups.map((group) => (
        <section key={group.label} className="versions-group">
          <h4>{group.label}</h4>
          <ul>
            {group.changes.map(({ change, itemTitle, route }) => (
              <li key={`${change.kind}:${change.key}`}>
                <span className={`versions-kind ${change.kind}`}>{KIND[change.kind]}</span>
                <span className="versions-item">
                  {itemTitle || change.form}
                  {itemTitle && change.form !== itemTitle && (
                    <span className="muted"> · {change.form}</span>
                  )}
                </span>
                {route && change.kind !== 'removido' && (
                  <button className="ghost" type="button" onClick={() => onGo(route)}>
                    Ver no editor
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Depois de abrir ou recarregar: o resumo do que mudou desde a exportação anterior. */
export function OpenedBanner({
  onClose,
  onOpen,
  summary,
}: {
  summary?: string;
  onClose: () => void;
  onOpen: () => void;
}) {
  if (!summary) return null;
  return (
    <div className="version-banner" role="status">
      <span className="version-banner-text">{summary}</span>
      <button className="version-banner-open" type="button" onClick={onOpen}>
        Ver no histórico
      </button>
      <Tip label="Fechar">
        <button
          aria-label="Fechar resumo"
          className="ghost icon-btn"
          type="button"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </Tip>
    </div>
  );
}
