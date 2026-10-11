// Lista de itens repetidos agrupada por uma ListView: por ano (atuações,
// formações, produções, eventos…) ou por outra chave (país das instituições,
// área dos cursos). Com mais de um grupo, a barra de atalhos (JumpBar) aparece.

import { useId } from 'react';

import { elementLabel, slugify } from '../labels/labels.ts';
import { SEQ_ATTR } from '../model/production.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { useEditor } from './editor-context.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { applyFilter, cardText, type SectionFilter } from './facets.ts';
import { JumpBar } from './JumpBar.tsx';
import { type CardInfo, type ListView, yearView } from './list-view.ts';

interface Props {
  /** Âncora do grupo da seção; com ela, os anos viram links legíveis ("…/2020"). */
  anchorBase?: string;
  depth?: number;
  filter?: SectionFilter;
  items: XElement[];
  showEmpty: boolean;
  view?: ListView;
  onEdit: EditFn;
}

export function ItemList({
  anchorBase,
  depth = 0,
  filter,
  items,
  onEdit,
  showEmpty,
  view = yearView,
}: Props) {
  const listId = useId();
  // O filtro mora na seção (barra única no topo); a lista só aplica.
  const visible = filter
    ? applyFilter(items, filter.facets, filter.state, (el) => cardText(view.card(el)))
    : items;
  const groups = view.groups(visible);
  const mixedKinds = new Set(items.map((el) => el.name)).size > 1;
  // Listas aninhadas (dentro de um cartão) não entram na URL; usam ids internos.
  const anchor = (key: string, label: string) =>
    anchorBase ? `${anchorBase}/${slugify(label)}` : `${listId}-${key}`;

  const cards = (els: XElement[]) =>
    els.map((el, i) => (
      <ItemCard
        key={i}
        depth={depth}
        el={el}
        info={view.card(el)}
        showEmpty={showEmpty}
        showKind={mixedKinds}
        onEdit={onEdit}
      />
    ));

  // Sem resultado, a seção esconde o grupo inteiro.
  if (visible.length === 0) return null;

  // Nada para dividir: só o grupo "sem ano/país/área".
  if (groups.length === 1 && groups[0]!.key === view.ungroupedKey) {
    return <div className="item-list">{cards(groups[0]!.items)}</div>;
  }

  return (
    <div className="item-list">
      {groups.length > 1 && (
        <JumpBar
          entries={groups.map((g) => ({
            count: g.items.length,
            id: anchor(g.key, g.label),
            label: g.label,
          }))}
          label="Divisões da lista"
          level="year"
          linkable={anchorBase !== undefined}
        />
      )}
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={anchor(g.key, g.label)} className="year-group">
          <h3 className="year-head" id={anchor(g.key, g.label)}>
            {g.label}
            <span className="count">{g.items.length}</span>
          </h3>
          {cards(g.items)}
        </section>
      ))}
    </div>
  );
}

function ItemCard({
  depth,
  el,
  info,
  onEdit,
  showEmpty,
  showKind,
}: {
  depth: number;
  el: XElement;
  info: CardInfo;
  onEdit: EditFn;
  showEmpty: boolean;
  showKind: boolean;
}) {
  const { loadedMax, openItem } = useEditor();
  const seq = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
  const isNew = Number.isFinite(seq) && seq > loadedMax;
  return (
    <details className={isNew ? 'item card is-new' : 'item card'}>
      <summary>
        <span className="card-main">
          {showKind && <span className="item-kind">{elementLabel(el.name)}</span>}
          <span className="card-title">
            {isNew && <span className="tag new">novo</span>}
            {info.title || elementLabel(el.name)}
          </span>
          {info.subtitle && <span className="card-subtitle">{info.subtitle}</span>}
        </span>
        {info.aside && (
          <span className="card-period">
            <span className={info.asideStrong ? 'period current' : 'period'}>{info.aside}</span>
            {info.asideSub && <span className="duration">{info.asideSub}</span>}
          </span>
        )}
      </summary>
      {isNew && (
        <div className="card-actions">
          <span className="muted">
            Ainda não está no Lattes: entra no próximo arquivo de importação.
          </span>
          <button className="ghost" type="button" onClick={() => openItem(seq)}>
            Editar no formulário
          </button>
        </div>
      )}
      {info.usages && info.usages.length > 0 && (
        <div className="usages">
          <h4>Onde aparece</h4>
          <ul>
            {info.usages.map((u, i) => (
              <li key={i}>
                <span className="item-kind">{u.kind}</span>
                <span className="usage-title">{u.title || '(sem título)'}</span>
                {u.period && <span className="usage-period">{u.period}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ElementView depth={depth + 1} el={el} showEmpty={showEmpty} onEdit={onEdit} />
    </details>
  );
}
