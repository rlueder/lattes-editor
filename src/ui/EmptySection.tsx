// Seção sem itens: no centro da coluna, um desenho em traço, o que a seção
// guarda e o caminho para começar (como os estados vazios do Linear).

import type { ReactNode } from 'react';

import { FORM_SPECS } from '../forms/specs.ts';
import { elementLabel } from '../labels/labels.ts';
import type { ProductionType } from '../model/production.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { PlusIcon } from './icons.tsx';
import { EMPTY_NOTES, SECTION_DESCRIPTIONS, typesForSection } from './section-types.ts';
import type { Section } from './sections.ts';

const MAX_SHORTCUTS = 2;

interface Props {
  /** Ação própria da seção (Marcar itens, nas seções-filtro). */
  action?: ReactNode;
  section: Section;
  onNewItem: (type: ProductionType) => void;
  onOpenPicker: () => void;
}

/** Folhas de currículo empilhadas, em traço, na cor secundária. */
function SheetsArt() {
  return (
    <svg
      aria-hidden="true"
      className="empty-art"
      fill="none"
      height="96"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.25"
      viewBox="0 0 96 96"
      width="96"
    >
      <path d="M22 70 48 84l26-14" />
      <path d="M22 64 48 78l26-14" />
      <path d="M22 58 48 72l26-14L48 44 22 58Z" />
      <path d="M33 22h30l7 7v27H33V22Z" transform="rotate(-8 51 39)" />
      <path d="M40 32h16M40 38h22M40 44h18" transform="rotate(-8 51 39)" />
    </svg>
  );
}

export function EmptySection({ action, onNewItem, onOpenPicker, section }: Props) {
  const types = typesForSection(lattesSchema, section.id);
  const labelOf = (t: ProductionType) =>
    FORM_SPECS.find((s) => s.itemName === t.itemName)?.title ?? elementLabel(t.itemName);
  const description = SECTION_DESCRIPTIONS[section.id];
  const note = EMPTY_NOTES[section.id];

  return (
    <div className="empty-section">
      <SheetsArt />
      <h2 className="empty-title">{section.label}</h2>
      {description && <p className="empty-text">{description}</p>}
      {types.length === 0 ? (
        <>
          {action && <div className="empty-actions">{action}</div>}
          {note && <p className="empty-caption">{note}</p>}
        </>
      ) : (
        <>
          <div className="empty-actions">
            <button className="primary" type="button" onClick={onOpenPicker}>
              <PlusIcon /> Novo item
            </button>
            {types.slice(0, MAX_SHORTCUTS).map((t) => (
              <button
                key={`${t.module.id}-${t.itemName}`}
                className="ghost empty-type"
                title={labelOf(t)}
                type="button"
                onClick={() => onNewItem(t)}
              >
                {labelOf(t)}
              </button>
            ))}
          </div>
          <p className="empty-caption">
            O item novo entra no próximo arquivo para o Importar do Lattes.
          </p>
        </>
      )}
    </div>
  );
}
