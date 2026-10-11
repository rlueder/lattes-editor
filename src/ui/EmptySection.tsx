// Seção sem itens: em vez de "nada aqui", o caminho para começar.

import { FORM_SPECS } from '../forms/specs.ts';
import { elementLabel } from '../labels/labels.ts';
import type { ProductionType } from '../model/production.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { PlusIcon } from './icons.tsx';
import { EMPTY_NOTES, typesForSection } from './section-types.ts';
import type { Section } from './sections.ts';

const MAX_SHORTCUTS = 6;

interface Props {
  section: Section;
  onNewItem: (type: ProductionType) => void;
  onOpenPicker: () => void;
}

export function EmptySection({ onNewItem, onOpenPicker, section }: Props) {
  const types = typesForSection(lattesSchema, section.id);
  const labelOf = (t: ProductionType) =>
    FORM_SPECS.find((s) => s.itemName === t.itemName)?.title ?? elementLabel(t.itemName);

  if (types.length === 0) {
    return (
      <div className="empty-section">
        <p className="empty-title">Nada em {section.label} nesta exportação.</p>
        {EMPTY_NOTES[section.id] && <p className="muted">{EMPTY_NOTES[section.id]}</p>}
      </div>
    );
  }

  return (
    <div className="empty-section">
      <p className="empty-title">Nenhum item em {section.label} ainda.</p>
      <p className="muted">
        Comece por um dos tipos abaixo. O item entra no próximo arquivo para o Importar do Lattes.
      </p>
      <ul className="picker-grid empty-types">
        {types.slice(0, MAX_SHORTCUTS).map((t) => (
          <li key={`${t.module.id}-${t.itemName}`}>
            <button
              className="picker-item"
              title={labelOf(t)}
              type="button"
              onClick={() => onNewItem(t)}
            >
              <PlusIcon /> {labelOf(t)}
            </button>
          </li>
        ))}
      </ul>
      {types.length > MAX_SHORTCUTS && (
        <button className="picker-more" type="button" onClick={onOpenPicker}>
          Outros tipos ({types.length - MAX_SHORTCUTS})
        </button>
      )}
    </div>
  );
}
