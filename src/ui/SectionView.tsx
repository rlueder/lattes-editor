// Uma seção do menu: título e grupos numa coluna de leitura, e à direita um
// painel com o filtro (vale para todas as listas da seção) e o índice dos grupos.

import { useMemo, useState } from 'react';

import type { ProductionType } from '../model/production.ts';
import { childElements, type XElement } from '../model/xml.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { EmptySection } from './EmptySection.tsx';
import {
  applyFilter,
  buildFacets,
  cardText,
  elementMatchesText,
  type FilterState,
  isFiltering,
  NO_FILTER,
} from './facets.ts';
import { FilterBar } from './FilterBar.tsx';
import { isListItem } from './item-meta.ts';
import { ItemList } from './ItemList.tsx';
import { JumpBar } from './JumpBar.tsx';
import { type ListView, yearView } from './list-view.ts';
import { useReferenceIndex } from './reference-context.ts';
import { type ReferenceIndex, viewForContainer } from './reference-tables.ts';
import { countItems, type Section, type SectionGroup } from './sections.ts';

interface Props {
  section: Section;
  showEmpty: boolean;
  onEdit: EditFn;
  onNewItem: (type: ProductionType) => void;
  onOpenPicker: () => void;
}

interface GroupList {
  items: XElement[];
  view: ListView;
}

/** Os itens de lista de um grupo e a visão que os agrupa; null se o grupo não é lista. */
function groupList(g: SectionGroup, index: ReferenceIndex): GroupList | null {
  if (g.elements.length > 1) return { items: g.elements, view: yearView };
  const el = g.elements[0];
  if (!el || el.attrs.length > 0) return null;
  const children = childElements(el).filter((c) => c.attrs.length > 0 || c.children.length > 0);
  if (children.length === 0 || !children.every(isListItem)) return null;
  return { items: children, view: viewForContainer(el.name, index) ?? yearView };
}

export function SectionView(props: Props) {
  // A chave zera o filtro ao trocar de seção.
  return <SectionBody key={props.section.id} {...props} />;
}

function SectionBody({ onEdit, onNewItem, onOpenPicker, section, showEmpty }: Props) {
  const index = useReferenceIndex();
  const [state, setState] = useState<FilterState>(NO_FILTER);
  const lists = section.groups.map((g) => groupList(g, index));
  const allItems = lists.flatMap((l) => l?.items ?? []);
  // Recalcula só quando os itens da seção mudam de identidade.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const facets = useMemo(() => buildFacets(allItems), [section, allItems.length]);
  const filtering = isFiltering(state);
  const filter = filtering ? { facets, state } : undefined;

  /** Quantos itens do grupo passam pelo filtro; grupos que não são lista contam 0 ou 1. */
  const shownIn = (g: SectionGroup, i: number): number => {
    const list = lists[i];
    if (!filtering) return countItems(g);
    if (list)
      return applyFilter(list.items, facets, state, (el) => cardText(list.view.card(el))).length;
    // Grupo de campos (Identificação, Resumo): só a busca de texto vale, sem facetas.
    if (Object.keys(state.selected).length > 0) return 0;
    return g.elements.some((el) => elementMatchesText(el, state.query)) ? 1 : 0;
  };
  const counts = section.groups.map(shownIn);
  const visibleGroups = section.groups.filter((_, i) => counts[i]! > 0);
  const shownTotal = lists.reduce((n, l, i) => n + (l ? counts[i]! : 0), 0);

  // O filtro serve a listas de itens. Dados gerais é o perfil (identificação,
  // resumo, endereço) e fica só com o índice; as outras seções são listas,
  // mesmo quando os grupos vêm embrulhados num elemento só (Projetos, Patentes).
  const showFilter = section.id !== 'dados-gerais';
  const hasPanel = section.groups.length > 0;
  const head = (
    <>
      <div className="section-head">
        <h1>{section.label}</h1>
        {section.importable === false && (
          <span
            className="badge"
            title="O Importar do Lattes ignora esta seção; copie as mudanças à mão no Lattes."
          >
            não importável no Lattes
          </span>
        )}
      </div>
      {section.importable === 'filtro' && (
        <p className="muted section-note">
          Itens de outras seções reunidos pela marca do Lattes. Cada um é importável ou não conforme
          a seção de origem.
        </p>
      )}
    </>
  );

  if (!hasPanel) {
    return (
      <div className="section-main">
        {head}
        <EmptySection section={section} onNewItem={onNewItem} onOpenPicker={onOpenPicker} />
      </div>
    );
  }

  return (
    <div className="section-layout">
      <div className="section-main">
        {head}
        <div className="section-body">
          {filtering && visibleGroups.length === 0 && (
            <p className="empty">Nada nesta seção com esses filtros.</p>
          )}
          {section.groups.map((g, i) =>
            counts[i]! > 0 ? (
              <section key={g.id} className="group" id={g.id}>
                <h2>{g.label}</h2>
                {g.elements.length > 1 ? (
                  <ItemList
                    anchorBase={g.id}
                    filter={filter}
                    items={g.elements}
                    showEmpty={showEmpty}
                    onEdit={onEdit}
                  />
                ) : (
                  g.elements.map((el, j) => (
                    <ElementView
                      key={j}
                      anchorBase={g.id}
                      el={el}
                      filter={filter}
                      showEmpty={showEmpty}
                      onEdit={onEdit}
                    />
                  ))
                )}
              </section>
            ) : null,
          )}
        </div>
      </div>

      {/* Painel à direita: filtro e índice da seção, fora da coluna de leitura. */}
      <aside aria-label="Filtro e índice da seção" className="section-panel">
        {showFilter && (
          <FilterBar
            facets={facets}
            shown={shownTotal}
            state={state}
            total={allItems.length}
            onChange={setState}
          />
        )}
        {visibleGroups.length > 1 && (
          <div className="panel-block">
            <h2 className="panel-heading">Nesta seção</h2>
            <JumpBar
              linkable
              vertical
              entries={section.groups
                .map((g, i) => ({ count: counts[i]!, id: g.id, label: g.label }))
                .filter((e) => e.count > 0)}
              label="Grupos da seção"
              level="section"
            />
          </div>
        )}
      </aside>
    </div>
  );
}
