// Os achados do diagnóstico (LAT-25): uma lista só, com o que o formulário de
// cada item confere e a revisão de consistência (LAT-29), por seção e com
// pílulas para filtrar por tipo. Cada linha leva ao grupo do item; o achado é
// a etiqueta da linha.

import { useState } from 'react';

import type { Place } from './locate.ts';
import {
  CATEGORIES,
  type Category,
  CATEGORY_LABELS,
  type CvValidation,
  type ItemReport,
  onlyCategory,
  summaryLine,
} from './validation.ts';

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

export function Findings({
  onGo,
  validation,
}: {
  /** Fecha o diagnóstico e vai ao grupo do item. */
  onGo: (place: Place) => void;
  validation: CvValidation;
}) {
  const [category, setCategory] = useState<Category | undefined>();
  // Um filtro que ficou sem achados (a pessoa corrigiu tudo dele) volta a "Tudo".
  const active = category && validation.byCategory[category] ? category : undefined;
  const shown = onlyCategory(validation.items, active);
  const total = validation.items.reduce((n, r) => n + r.checks.length, 0);

  return (
    <>
      <p className="findings-summary" role="status">
        <strong>{summaryLine(validation)}</strong>
        <span className="muted">
          {validation.total === 1
            ? ' em 1 item conferido'
            : ` em ${validation.total} itens conferidos`}
        </span>
      </p>

      {validation.items.length === 0 ? (
        <p className="empty">
          Campos obrigatórios, listas do Lattes, anos, autores, DOI e a revisão de consistência:
          nada chamou atenção.
        </p>
      ) : (
        <>
          <div aria-label="Filtrar por tipo" className="findings-filter" role="group">
            <button
              aria-pressed={active === undefined}
              className="filter-pill"
              type="button"
              onClick={() => setCategory(undefined)}
            >
              Tudo
              <span className="count">{total}</span>
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
            <div key={g.label} className="findings-group">
              <h4 className="findings-group-label">{g.label}</h4>
              <ul className="findings-list">
                {g.rows.map((r, i) => (
                  <li key={i}>
                    <button
                      className="finding-row"
                      disabled={!r.place}
                      type="button"
                      onClick={() => r.place && onGo(r.place)}
                    >
                      <span className="finding-head">
                        <span className="finding-title">{r.title}</span>
                        <span className="finding-group">{r.place?.groupLabel}</span>
                      </span>
                      <span className="finding-badges">
                        {r.checks.map((c, j) => (
                          <span key={j} className={`finding-badge ${c.severity}`}>
                            {c.message}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </>
  );
}
