// Validação do currículo inteiro (LAT-25): os achados de cada item, por
// seção, com um filtro por tipo de conferência. Só leitura: cada linha leva ao
// grupo do item no editor, onde a pessoa corrige.

import { useMemo, useState } from 'react';

import type { XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { HashRoute } from '../ui/hash-route.ts';
import { Modal } from '../ui/Modal.tsx';
import type { Section } from '../ui/sections.ts';
import {
  CATEGORIES,
  type Category,
  CATEGORY_LABELS,
  type ItemReport,
  onlyCategory,
  type Severity,
  summaryLine,
  validateCv,
  worst,
} from './validation.ts';

interface Props {
  open: boolean;
  root: XElement;
  sections: Section[];
  /** Muda a cada edição; o documento é mutado no lugar. */
  version: number;
  onClose: () => void;
  onGo: (route: HashRoute) => void;
}

const SEVERITY_TAG: Record<Severity, { className: string; label: string }> = {
  aviso: { className: 'tag warn', label: 'corrigir?' },
  erro: { className: 'tag warn', label: 'corrigir' },
  nota: { className: 'tag', label: 'conferir' },
};

/** Agrupa por seção, na ordem em que os itens chegam (a do menu). */
function bySection(items: ItemReport[]) {
  const groups = new Map<string, { label: string; rows: ItemReport[] }>();
  for (const r of items) {
    const id = r.place?.sectionId ?? '';
    if (!groups.has(id)) groups.set(id, { label: r.place?.sectionLabel ?? 'Outros', rows: [] });
    groups.get(id)!.rows.push(r);
  }
  return [...groups.values()];
}

export function ValidationPanel({ onClose, onGo, open, root, sections, version }: Props) {
  const [category, setCategory] = useState<Category | undefined>();
  const validation = useMemo(
    () => (open ? validateCv(lattesSchema, root, sections) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, root, sections, version],
  );
  // Um filtro que ficou sem achados (a pessoa corrigiu tudo dele) volta a "Tudo".
  const active = category && validation?.byCategory[category] ? category : undefined;
  const shown = validation ? onlyCategory(validation.items, active) : [];

  const go = (r: ItemReport) => {
    if (!r.place) return;
    onClose();
    onGo({ anchor: r.place.anchor, sectionId: r.place.sectionId });
  };

  return (
    <Modal
      className="export validation"
      footer={
        <button className="ghost" type="button" onClick={onClose}>
          Fechar
        </button>
      }
      label="Validação do currículo"
      open={open}
      subtitle="O que o editor confere em cada item, no currículo inteiro. Nada aqui altera o currículo."
      title="Validação do currículo"
      onClose={onClose}
    >
      {validation && (
        <>
          <p className="validation-summary" role="status">
            <strong>{summaryLine(validation)}</strong>
            <span className="muted">
              {validation.total === 1
                ? ' em 1 item conferido'
                : ` em ${validation.total} itens conferidos`}
            </span>
          </p>

          {validation.items.length === 0 ? (
            <p className="empty">
              Campos obrigatórios, listas do Lattes, anos e períodos, autores, DOI, ISSN e
              duplicatas: nada chamou atenção.
            </p>
          ) : (
            <>
              <div aria-label="Filtrar por tipo" className="validation-filter" role="group">
                <button
                  aria-pressed={active === undefined}
                  className="filter-pill"
                  type="button"
                  onClick={() => setCategory(undefined)}
                >
                  Tudo
                  <span className="count">
                    {validation.items.reduce((n, r) => n + r.checks.length, 0)}
                  </span>
                </button>
                {CATEGORIES.filter((c) => validation.byCategory[c] > 0).map((c) => (
                  <button
                    key={c}
                    aria-pressed={active === c}
                    className="filter-pill"
                    type="button"
                    onClick={() => setCategory(c)}
                  >
                    {CATEGORY_LABELS[c]}
                    <span className="count">{validation.byCategory[c]}</span>
                  </button>
                ))}
              </div>

              {bySection(shown).map((g) => (
                <div key={g.label} className="diagnosis-group">
                  <h4 className="sent-day-head">{g.label}</h4>
                  <ul className="validation-list">
                    {g.rows.map((r, i) => {
                      const tag = SEVERITY_TAG[worst(r)];
                      return (
                        <li key={i}>
                          <button
                            className="ghost validation-row"
                            disabled={!r.place}
                            type="button"
                            onClick={() => go(r)}
                          >
                            <span className="validation-head">
                              <span className="pending-title">{r.title}</span>
                              <span className="validation-group">{r.place?.groupLabel}</span>
                              <span className={tag.className}>{tag.label}</span>
                            </span>
                            <span className="validation-checks">
                              {r.checks.map((c, j) => (
                                <span key={j} className={`validation-check ${c.severity}`}>
                                  {c.message}
                                </span>
                              ))}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
