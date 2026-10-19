// O que foi clicado no gráfico, no painel à direita, separado pela seção do
// editor em que cada item mora. Cada grupo tem os itens (cada um abre o
// item) e, quando o filtro da seção reproduz o grupo, "Abrir em <Seção>".
// Para uma pessoa, cada seção abre filtrada pelo nome dela.

import { memo, useMemo } from 'react';

import { CloseIcon } from '../ui/icons.tsx';
import { Tip } from '../ui/primitives/Tip.tsx';
import type { Section } from '../ui/sections.ts';
import { itemTarget, type OpenTarget, type Selection, selectionGroups } from './drill.ts';

interface Props {
  now: number;
  sections: Section[];
  selection: Selection;
  onClose: () => void;
  onOpen: (target: OpenTarget) => void;
}

const SHOWN = 6;

function SelectionPanelView({ now, onClose, onOpen, sections, selection }: Props) {
  const { items, label, person } = selection;
  const groups = useMemo(
    () => selectionGroups(sections, selection, now),
    [now, sections, selection],
  );
  return (
    <div className="panel-block pano-selection">
      <div className="pano-selection-head">
        <h2 className="panel-heading">Seleção</h2>
        <Tip label="Fechar a seleção">
          <button
            aria-label="Fechar a seleção"
            className="ghost icon-btn"
            type="button"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </Tip>
      </div>
      <p className="pano-selection-label">
        {label} <span className="muted">({items.length})</span>
      </p>
      {items.length === 0 && <p className="pano-note">Nenhum item.</p>}
      {groups.map((g) => {
        const sorted = [...g.items].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        return (
          <section key={g.sectionId} className="pano-selection-group">
            {groups.length > 1 && (
              <h3 className="pano-selection-section">
                {g.label} <span className="muted">({g.items.length})</span>
              </h3>
            )}
            <ol className="pano-selection-list">
              {sorted.slice(0, SHOWN).map((item, i) => (
                <li key={`${item.title}-${i}`}>
                  <button type="button" onClick={() => onOpen(itemTarget(sections, item))}>
                    <span className="pano-selection-year">{item.year ?? '–'}</span>
                    <span>{item.title || item.typeLabel}</span>
                  </button>
                </li>
              ))}
              {g.items.length > SHOWN && <li className="muted">e mais {g.items.length - SHOWN}</li>}
            </ol>
            {(person || g.exact) && (
              <button className="pano-open" type="button" onClick={() => onOpen(g.target)}>
                Abrir em {g.label}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Memorizado: só refaz os grupos quando a seleção muda. */
export const SelectionPanel = memo(SelectionPanelView);
