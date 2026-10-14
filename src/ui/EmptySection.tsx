// Seção sem itens: no centro da coluna, um desenho em traço, o que a seção
// guarda e o caminho para começar (como os estados vazios do Linear).

import type { ReactNode } from 'react';

import { FORM_SPECS } from '../forms/specs.ts';
import { elementLabel } from '../labels/labels.ts';
import type { ProductionType } from '../model/production.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { SectionArt } from './empty-art.tsx';
import { PlusIcon } from './icons.tsx';
import { LATTES_URL } from './onboarding.ts';
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

/**
 * Seções em que o editor não cria itens (o Importar do Lattes não as aceita):
 * o caminho é cadastrar no próprio Lattes e recarregar a exportação.
 */
const LATTES_ONLY = new Set(['atuacao', 'formacao', 'patentes', 'projetos']);

export function EmptySection({ action, onNewItem, onOpenPicker, section }: Props) {
  const types = typesForSection(lattesSchema, section.id);
  const labelOf = (t: ProductionType) =>
    FORM_SPECS.find((s) => s.itemName === t.itemName)?.title ?? elementLabel(t.itemName);
  const description = SECTION_DESCRIPTIONS[section.id];
  const note = EMPTY_NOTES[section.id];

  return (
    <div className="empty-section">
      <SectionArt sectionId={section.id} />
      <h2 className="empty-title">{section.label}</h2>
      {description && <p className="empty-text">{description}</p>}
      {types.length === 0 ? (
        <>
          {action && <div className="empty-actions">{action}</div>}
          {!action && LATTES_ONLY.has(section.id) && (
            <div className="empty-actions">
              <a className="primary action-link" href={LATTES_URL} rel="noreferrer" target="_blank">
                Abrir o Lattes
              </a>
            </div>
          )}
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
