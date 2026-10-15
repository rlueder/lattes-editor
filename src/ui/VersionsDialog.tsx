// "Versões do Lattes" (LAT-12): as exportações já abertas deste currículo,
// da mais recente à mais antiga, e o que mudou em cada uma em relação à
// anterior. Também a faixa curta que aparece depois de abrir uma exportação
// nova.

import { type ReactNode, useEffect, useState } from 'react';

import type { ChangeKind } from '../model/changes.ts';
import { getVersion, type LattesVersion } from '../model/store.ts';
import { parseXml } from '../model/xml.ts';
import type { HashRoute } from './hash-route.ts';
import { CloseIcon } from './icons.tsx';
import { Modal } from './Modal.tsx';
import { Tip } from './primitives/Tip.tsx';
import { buildSections } from './sections.ts';
import { diffSummary, diffVersions, versionDate } from './version-diff.ts';

const KIND: Record<ChangeKind, string> = {
  alterado: 'Alterado',
  novo: 'Novo',
  removido: 'Removido',
};

type VersionInfo = Omit<LattesVersion, 'xml'>;

/** O que mudou entre duas versões; só estas duas são decifradas, ao escolher. */
function VersionChanges({
  newer,
  older,
  onGo,
}: {
  newer: VersionInfo;
  older?: VersionInfo;
  onGo: (route: HashRoute) => void;
}) {
  const [diff, setDiff] = useState<ReturnType<typeof diffVersions>>();
  useEffect(() => {
    setDiff(undefined);
    if (!older || newer.id === undefined || older.id === undefined) return;
    let current = true;
    void Promise.all([getVersion(newer.id), getVersion(older.id)]).then(([a, b]) => {
      if (!current || !a || !b) return;
      const root = parseXml(a.xml).root;
      setDiff(diffVersions(parseXml(b.xml).root, root, buildSections(root)));
    });
    return () => {
      current = false;
    };
  }, [newer, older]);
  if (!older) {
    return <p className="muted">É a primeira versão guardada; não há anterior para comparar.</p>;
  }
  if (!diff) return <p className="muted">Comparando…</p>;
  return (
    <>
      <p className="versions-summary">{diffSummary(diff, versionDate(older))}</p>
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

export function VersionsDialog({
  backups,
  onClear,
  onClose,
  onGo,
  open,
  versions,
}: {
  /** "Cópias de segurança" (BackupsSection), embaixo das versões. */
  backups?: ReactNode;
  open: boolean;
  /** Da mais recente à mais antiga, sem o XML. */
  versions: VersionInfo[];
  onClear: () => void;
  onClose: () => void;
  onGo: (route: HashRoute) => void;
}) {
  // A seleção é pelo id da versão, e volta à mais recente a cada abertura:
  // um índice apontaria para outra versão depois de uma gravação nova.
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (!open) return;
    setSelectedId(undefined);
    setClearing(false);
  }, [open]);
  const found = versions.findIndex((v) => v.id === selectedId);
  const index = found >= 0 ? found : 0;
  const newer = versions[index];
  return (
    <Modal
      className="versions"
      footer={
        clearing ? (
          <>
            <span className="muted versions-clear-note">
              Apaga as versões guardadas deste currículo. A cópia de trabalho, as cópias de
              segurança e o Lattes não mudam.
            </span>
            <button type="button" onClick={() => setClearing(false)}>
              Manter
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => {
                setClearing(false);
                onClear();
              }}
            >
              Apagar as versões
            </button>
          </>
        ) : (
          versions.length > 0 && (
            <button className="ghost" type="button" onClick={() => setClearing(true)}>
              Apagar as versões
            </button>
          )
        )
      }
      label="Versões do Lattes"
      open={open}
      subtitle="Cada exportação aberta neste app vira uma versão. Escolha uma para ver o que mudou em relação à anterior."
      title="Versões do Lattes"
      onClose={onClose}
    >
      {versions.length === 0 ? (
        <p className="muted">Nenhuma versão guardada ainda. Abra uma exportação do Lattes.</p>
      ) : (
        <div className="versions-body">
          <ul className="versions-list">
            {versions.map((v, i) => (
              <li key={v.id ?? i}>
                <button
                  aria-pressed={i === index}
                  className={i === index ? 'versions-pick active' : 'versions-pick'}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                >
                  Exportação de {versionDate(v)}
                  <span className="muted">
                    aberta em {new Date(v.loadedAt).toLocaleDateString('pt-BR')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="versions-detail">
            {newer && <VersionChanges newer={newer} older={versions[index + 1]} onGo={onGo} />}
          </div>
        </div>
      )}
      {backups}
    </Modal>
  );
}

/** Depois de abrir uma exportação nova: o resumo do que mudou desde a anterior. */
export function VersionBanner({
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
        Ver o que mudou
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
