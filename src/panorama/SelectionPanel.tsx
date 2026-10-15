// O que foi clicado no gráfico, no painel à direita: os itens, o botão que
// abre a lista no editor com o filtro que ele já sabe aplicar, e o recorte
// que ainda falta ao editor, marcado como "em breve".

import { CloseIcon } from '../ui/icons.tsx';
import { Tip } from '../ui/primitives/Tip.tsx';
import type { Section } from '../ui/sections.ts';
import { itemTarget, listTarget, type OpenTarget, personTarget, type Selection } from './drill.ts';

interface Props {
  sections: Section[];
  selection: Selection;
  onClose: () => void;
  onOpen: (target: OpenTarget) => void;
}

const SHOWN = 8;

export function SelectionPanel({ onClose, onOpen, sections, selection }: Props) {
  const { items, label, person, soon } = selection;
  const target = person ? personTarget(sections, person, items) : listTarget(sections, items);
  const sectionLabel = sections.find((s) => s.id === target?.sectionId)?.label;
  const sorted = [...items].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
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
      {items.length > 0 && (
        <ol className="pano-selection-list">
          {sorted.slice(0, SHOWN).map((item, i) => (
            <li key={`${item.title}-${i}`}>
              <button type="button" onClick={() => onOpen(itemTarget(sections, item))}>
                <span className="pano-selection-year">{item.year ?? '–'}</span>
                <span>{item.title || item.typeLabel}</span>
              </button>
            </li>
          ))}
          {items.length > SHOWN && <li className="muted">e mais {items.length - SHOWN}</li>}
        </ol>
      )}
      {target && sectionLabel && (
        <button className="pano-open" type="button" onClick={() => onOpen(target)}>
          Abrir em {sectionLabel}
        </button>
      )}
      {soon && (
        <p className="pano-soon">
          <span className="pano-soon-tag">em breve</span> {soon}
        </p>
      )}
    </div>
  );
}
