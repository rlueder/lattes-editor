import type { XElement } from '../model/xml.ts';
import { countItems, type Section } from './sections.ts';

interface Props {
  activeId?: string;
  /** Quantos itens novos (ainda não importados) há dentro destes elementos. */
  pendingIn: (els: XElement[]) => number;
  sections: Section[];
  onSelect: (id: string) => void;
}

export function Sidebar({ activeId, onSelect, pendingIn, sections }: Props) {
  return (
    <nav aria-label="Seções" className="sidebar">
      <ul>
        {sections.map((s) => {
          const total = s.groups.reduce((n, g) => n + countItems(g), 0);
          // Inovação e Educação repetem itens de outras seções; contar de novo confundiria.
          const fresh =
            s.importable === 'filtro' ? 0 : pendingIn(s.groups.flatMap((g) => g.elements));
          return (
            <li key={s.id}>
              <button
                className={s.id === activeId ? 'active' : ''}
                disabled={s.groups.length === 0}
                type="button"
                onClick={() => onSelect(s.id)}
              >
                <span>{s.label}</span>
                <span className="nav-counts">
                  {fresh > 0 && (
                    <span className="tag new" title="Itens novos para a próxima importação">
                      {fresh} novo{fresh > 1 ? 's' : ''}
                    </span>
                  )}
                  {total > 0 && <span className="count">{total}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
