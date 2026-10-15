// Uma seção do menu: título e grupos numa coluna de leitura, e à direita um
// painel com o filtro (vale para todas as listas da seção), o índice dos grupos
// e o índice do item aberto.

import { useMemo, useRef, useState } from 'react';

import { isBlank } from '../model/changes.ts';
import type { ProductionType } from '../model/production.ts';
import type { XElement } from '../model/xml.ts';
import type { EditFn } from './ElementView.tsx';
import { EmptySection } from './EmptySection.tsx';
import {
  applyFilter,
  buildFacets,
  elementMatchesText,
  type FilterState,
  isFiltering,
  NO_FILTER,
  recordSearchText,
} from './facets.ts';
import { FilterBar } from './FilterBar.tsx';
import { EyeIcon, EyeOffIcon, PlusIcon } from './icons.tsx';
import { JumpBar } from './JumpBar.tsx';
import { type ListView, yearView } from './list-view.ts';
import { MarkDialog } from './MarkDialog.tsx';
import { PrivacyContext, usePrivacyMode } from './privacy.ts';
import { ReadingGroup } from './ReadingView.tsx';
import { useReferenceIndex } from './reference-context.ts';
import { type ReferenceIndex, viewForContainer } from './reference-tables.ts';
import { NEW_GENERAL_LABELS } from './section-types.ts';
import { countItems, groupItemList, type Section, type SectionGroup } from './sections.ts';
import { StickyTitle } from './StickyTitle.tsx';
import { useOpenItem } from './use-open-item.ts';

interface Props {
  section: Section;
  onEdit: EditFn;
  /** Item novo de formação, atuação, projeto ou patente, pela seção. */
  onNewGeneral: (sectionId: string) => void;
  onNewItem: (type: ProductionType) => void;
  onOpenPicker: () => void;
}

interface GroupList {
  items: XElement[];
  view: ListView;
}

/** Os itens de lista de um grupo e a visão que os agrupa; null se o grupo não é lista. */
function groupList(g: SectionGroup, index: ReferenceIndex): GroupList | null {
  const list = groupItemList(g);
  if (!list) return null;
  const view = (list.container && viewForContainer(list.container.name, index)) || yearView;
  return { items: list.items, view };
}

export function SectionView(props: Props) {
  // A chave zera o filtro ao trocar de seção.
  return <SectionBody key={props.section.id} {...props} />;
}

function SectionBody({ onEdit, onNewGeneral, onNewItem, onOpenPicker, section }: Props) {
  const index = useReferenceIndex();
  const [state, setState] = useState<FilterState>(NO_FILTER);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const itemOutline = useOpenItem(rootRef);
  const [hideSensitive, setHideSensitive] = usePrivacyMode();
  const [marking, setMarking] = useState(false);
  const mark = section.mark;
  const markButton = mark && mark.items.length > 0 && (
    <button
      aria-label="Marcar itens"
      className="ghost mark-open"
      title="Marcar itens"
      type="button"
      onClick={() => setMarking(true)}
    >
      <span className="btn-label">Marcar itens</span>
    </button>
  );
  // Formação, atuação, projetos e patentes: o item novo pela própria seção. Na
  // seção vazia o botão é o principal; com itens, fica discreto ao lado do título.
  const newLabel = NEW_GENERAL_LABELS[section.id];
  const newButton = (primary: boolean) =>
    newLabel && (
      <button
        aria-label={newLabel}
        className={primary ? 'primary' : 'ghost mark-open'}
        title={newLabel}
        type="button"
        onClick={() => onNewGeneral(section.id)}
      >
        <PlusIcon /> <span className="btn-label">{newLabel}</span>
      </button>
    );
  const actions = markButton || newButton(false);
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
    if (g.elements.every(isBlank)) return 0;
    if (!filtering) return countItems(g);
    if (list)
      return applyFilter(list.items, facets, state, (el) =>
        recordSearchText(list.view.card(el), el),
      ).length;
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

  // Olho de privacidade em Dados gerais: o mesmo botão de contorno dos "Nova
  // …", com ícone e o nome da ação, que segue o estado; aria-pressed diz se
  // os dados estão ocultos. Fica antes das outras ações da seção, embaixo do
  // título e na barra fixa ao rolar.
  const privacyLabel = hideSensitive ? 'Mostrar dados pessoais' : 'Ocultar dados pessoais';
  const privacyToggle = privacy ? (
    <button
      aria-label={privacyLabel}
      aria-pressed={hideSensitive}
      className="ghost mark-open privacy-toggle"
      title={privacyLabel}
      type="button"
      onClick={() => setHideSensitive(!hideSensitive)}
    >
      {hideSensitive ? <EyeOffIcon /> : <EyeIcon />}{' '}
      <span className="btn-label">{privacyLabel}</span>
    </button>
  ) : null;
  const headActions = (privacyToggle || actions) && (
    <>
      {privacyToggle}
      {section.groups.length > 0 && actions}
    </>
  );

  const head = (
    <>
      <div className="section-head">
        {/* tabIndex -1: o modo foco leva o foco aqui ao escolher a seção no painel. */}
        <h1 ref={titleRef} tabIndex={-1}>
          {section.label}
        </h1>
        {headActions && <span className="section-head-actions">{headActions}</span>}
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
          action={markButton || newButton(true)}
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
      <div ref={rootRef} className="section-layout reading">
        <StickyTitle
          // O que está no lugar das ações sob o título vai também para a barra
          // fixa: os mesmos botões (mesmo clique, mesmo fluxo), na versão compacta.
          actions={headActions && <span className="sticky-section-actions">{headActions}</span>}
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
                  <ReadingGroup
                    elements={g.elements}
                    filter={filter}
                    label={g.label}
                    list={lists[i] ?? null}
                    onEdit={onEdit}
                  />
                </section>
              ) : null,
            )}
          </div>
        </div>

        {/* Painel à direita: filtro e índices da seção e do item, fora da coluna de leitura. */}
        <aside aria-label="Filtro e índices da seção" className="section-panel">
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
          {itemOutline.length > 0 && (
            <div className="panel-block">
              <h2 className="panel-heading">Neste item</h2>
              <JumpBar
                focusTarget
                vertical
                entries={itemOutline}
                label="Partes do item aberto"
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
