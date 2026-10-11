import { useCallback } from 'react';

import type { XElement } from '../model/xml.ts';
import type { Profile } from './profile.ts';
import { ProfileCard } from './ProfileCard.tsx';
import { countItems, type Section } from './sections.ts';
import { IS_MAC, SECTION_MODIFIER_LABEL, useSectionShortcuts } from './use-section-shortcuts.ts';

interface Props {
  activeId?: string;
  /** Quantos itens novos (ainda não importados) há dentro destes elementos. */
  pendingIn: (els: XElement[]) => number;
  profile: Profile;
  sections: Section[];
  onSelect: (id: string) => void;
}

export function Sidebar({ activeId, onSelect, pendingIn, profile, sections }: Props) {
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
      <ProfileCard profile={profile} />
      <ul>
        {sections.map((s) => {
          const total = s.groups.reduce((n, g) => n + countItems(g), 0);
          // Dados gerais é o perfil: somar Identificação, Resumo e endereços não é contagem de nada.
          const shownTotal = s.id === 'dados-gerais' ? 0 : total;
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
                <span className="nav-label">{navLabel(s)}</span>
                <span className="nav-counts">
                  {/* Com o modificador seguro, o selo da contagem mostra o atalho. */}
                  {showHints && shortcut !== undefined ? (
                    <span aria-hidden="true" className="count nav-key">
                      {`${SECTION_MODIFIER_LABEL}${shortcut}`}
                    </span>
                  ) : null}
                  {!showHints && fresh > 0 && (
                    <span className="tag new" title="Itens novos para a próxima importação">
                      {fresh} novo{fresh > 1 ? 's' : ''}
                    </span>
                  )}
                  {!showHints && shownTotal > 0 && <span className="count">{shownTotal}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Quebra fixa nos rótulos longos, para a linha não mudar quando o atalho aparece. */
const NAV_BREAKS: Record<string, [string, string]> = {
  educacao: ['Educação e', 'Popularização de C&T'],
};

function navLabel(s: Section) {
  const parts = NAV_BREAKS[s.id];
  if (!parts) return s.label;
  return (
    <>
      {parts[0]}
      <br />
      {parts[1]}
    </>
  );
}
