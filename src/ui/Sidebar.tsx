import { useCallback } from 'react';

import type { XElement } from '../model/xml.ts';
import { countItems, type Section } from './sections.ts';
import { IS_MAC, SECTION_MODIFIER_LABEL, useSectionShortcuts } from './use-section-shortcuts.ts';

interface Props {
  activeId?: string;
  /** Quantos itens novos (ainda não importados) há dentro destes elementos. */
  pendingIn: (els: XElement[]) => number;
  sections: Section[];
  onSelect: (id: string) => void;
}

export function Sidebar({ activeId, onSelect, pendingIn, sections }: Props) {
  // Toda seção tem número, na ordem do menu; os nove primeiros têm atalho.
  const select = useCallback(
    (index: number) => {
      const target = sections[index];
      if (target) onSelect(target.id);
    },
    [sections, onSelect],
  );
  const showHints = useSectionShortcuts(Math.min(sections.length, 9), select);

  return (
    <nav aria-label="Seções" className="sidebar">
      <ul>
        {sections.map((s) => {
          const total = s.groups.reduce((n, g) => n + countItems(g), 0);
          // Inovação e Educação repetem itens de outras seções; contar de novo confundiria.
          const fresh =
            s.importable === 'filtro' ? 0 : pendingIn(s.groups.flatMap((g) => g.elements));
          const position = sections.indexOf(s) + 1;
          const shortcut = position >= 1 && position <= 9 ? position : undefined;
          return (
            <li key={s.id}>
              <button
                aria-keyshortcuts={
                  shortcut
                    ? IS_MAC
                      ? `Control+${shortcut} Meta+${shortcut}`
                      : `Alt+${shortcut}`
                    : undefined
                }
                className={[s.id === activeId ? 'active' : '', s.groups.length === 0 ? 'empty' : '']
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                onClick={() => onSelect(s.id)}
              >
                {showHints && (
                  <span aria-hidden="true" className="nav-key">
                    {shortcut !== undefined ? `${SECTION_MODIFIER_LABEL}${shortcut}` : ''}
                  </span>
                )}
                <span className="nav-label">{s.label}</span>
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
