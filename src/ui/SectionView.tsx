// Uma seção do menu: título e grupos numa coluna de leitura, e à direita um
// painel com o filtro (vale para todas as listas da seção) e o índice dos grupos.

import { useMemo, useRef, useState } from 'react';

import { isBlank } from '../model/changes.ts';
import type { ProductionType } from '../model/production.ts';
import type { XElement } from '../model/xml.ts';
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
import { EyeIcon, EyeOffIcon } from './icons.tsx';
import { ItemList } from './ItemList.tsx';
import { JumpBar } from './JumpBar.tsx';
import { type ListView, yearView } from './list-view.ts';
import { MarkDialog } from './MarkDialog.tsx';
import { Tip } from './primitives/Tip.tsx';
import { PrivacyContext, usePrivacyMode } from './privacy.ts';
import { useReferenceIndex } from './reference-context.ts';
import { type ReferenceIndex, viewForContainer } from './reference-tables.ts';
import { countItems, groupItemList, type Section, type SectionGroup } from './sections.ts';
import { StickyTitle } from './StickyTitle.tsx';

interface Props {
  section: Section;
  showEmpty: boolean;
  onEdit: EditFn;
  onNewItem: (type: ProductionType) => void;
  onOpenPicker: () => void;
}

interface GroupList {
  /** Os itens são os próprios elementos do grupo, sem contêiner que os embrulhe. */
  direct: boolean;
  items: XElement[];
  view: ListView;
}

/** Os itens de lista de um grupo e a visão que os agrupa; null se o grupo não é lista. */
function groupList(g: SectionGroup, index: ReferenceIndex): GroupList | null {
  const list = groupItemList(g);
  if (!list) return null;
  const view = (list.container && viewForContainer(list.container.name, index)) || yearView;
  return { direct: !list.container, items: list.items, view };
}

export function SectionView(props: Props) {
  // A chave zera o filtro ao trocar de seção.
  return <SectionBody key={props.section.id} {...props} />;
}

function SectionBody({ onEdit, onNewItem, onOpenPicker, section, showEmpty }: Props) {
  const index = useReferenceIndex();
  const [state, setState] = useState<FilterState>(NO_FILTER);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [hideSensitive, setHideSensitive] = usePrivacyMode();
  const [marking, setMarking] = useState(false);
  const mark = section.mark;
  const markButton = mark && mark.items.length > 0 && (
    <button className="ghost mark-open" type="button" onClick={() => setMarking(true)}>
      Marcar itens
    </button>
  );
  const markDialog = mark && (
    <MarkDialog
      attr={mark.attr}
      items={mark.items}
      label={mark.label}
      open={marking}
      onClose={() => setMarking(false)}
      onEdit={onEdit}
    />
  );
  const privacy = section.id === 'dados-gerais';
  const lists = section.groups.map((g) => groupList(g, index));
  const allItems = lists.flatMap((l) => l?.items ?? []);
  // Recalcula só quando os itens da seção mudam de identidade.
  const facets = useMemo(
    () => buildFacets(allItems, { typesInPageOrder: section.id === 'dados-gerais' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, allItems.length],
  );
  const filtering = isFiltering(state);
  const filter = filtering ? { facets, state } : undefined;

  /** Quantos itens do grupo passam pelo filtro; grupos que não são lista contam 0 ou 1. */
  const shownIn = (g: SectionGroup, i: number): number => {
    const list = lists[i];
    // Bloco só com campos vazios (Outras informações relevantes sem texto) não aparece.
    if (!showEmpty && g.elements.every(isBlank)) return 0;
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

  // Olho de privacidade em Dados gerais: na linha do título, à direita da
  // coluna do conteúdo, e repetido no cabeçalho fixo ao rolar.
  const privacyToggle = privacy ? (
    <Tip label={hideSensitive ? 'Mostrar dados pessoais' : 'Esconder dados pessoais'}>
      <button
        aria-label="Esconder dados pessoais"
        aria-pressed={hideSensitive}
        className="ghost icon-btn privacy-toggle"
        type="button"
        onClick={() => setHideSensitive(!hideSensitive)}
      >
        {hideSensitive ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </Tip>
  ) : null;

  const head = (
    <>
      <div className="section-head">
        <h1 ref={titleRef}>{section.label}</h1>
        {privacyToggle}
        {section.groups.length > 0 && markButton && (
          <span className="section-head-actions">{markButton}</span>
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
      <div className="section-main section-main-empty">
        {head}
        <EmptySection
          action={markButton}
          section={section}
          onNewItem={onNewItem}
          onOpenPicker={onOpenPicker}
        />
        {markDialog}
      </div>
    );
  }

  return (
    <PrivacyContext.Provider value={privacy && hideSensitive}>
      <div ref={rootRef} className="section-layout">
        <StickyTitle
          actions={privacyToggle}
          groups={visibleGroups.map((g) => ({ id: g.id, label: g.label }))}
          host={rootRef}
          label={section.label}
          title={titleRef}
        />
        {/* Título na largura toda: o primeiro grupo e o painel lateral começam na mesma linha. */}
        <div className="section-title">{head}</div>
        <div className="section-main">
          <div className="section-body">
            {filtering && visibleGroups.length === 0 && (
              <p className="empty">Nada nesta seção com esses filtros.</p>
            )}
            {section.groups.map((g, i) =>
              counts[i]! > 0 ? (
                <section key={g.id} className="group" id={g.id}>
                  <h2>{g.label}</h2>
                  {/* Itens soltos viram cartões, mesmo um só; o contêiner que embrulha
                      uma lista (IDIOMAS, ARTIGOS-PUBLICADOS) passa pelo ElementView. */}
                  {lists[i]?.direct ? (
                    <ItemList
                      anchorBase={g.id}
                      filter={filter}
                      items={lists[i].items}
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
                  .filter((_, i) => counts[i]! > 0)
                  .map((g) => ({ id: g.id, label: g.label }))}
                label="Grupos da seção"
                level="section"
              />
            </div>
          )}
        </aside>
      </div>
      {markDialog}
    </PrivacyContext.Provider>
  );
}
