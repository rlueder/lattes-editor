// Lista de itens repetidos agrupada por uma ListView: por ano (atuações,
// formações, produções, eventos…) ou por outra chave (país das instituições,
// área dos cursos). Com mais de um grupo, a barra de atalhos (JumpBar) aparece.

import { useId } from 'react';

import { elementLabel } from '../labels/labels.ts';
import type { XElement } from '../model/xml.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { JumpBar } from './JumpBar.tsx';
import { type CardInfo, type ListView, yearView } from './list-view.ts';

interface Props {
  depth?: number;
  items: XElement[];
  showEmpty: boolean;
  view?: ListView;
  onEdit: EditFn;
}

export function ItemList({ depth = 0, items, onEdit, showEmpty, view = yearView }: Props) {
  const listId = useId();
  const groups = view.groups(items);
  const mixedKinds = new Set(items.map((el) => el.name)).size > 1;
  const anchor = (key: string) => `${listId}-${key}`;

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
            id: anchor(g.key),
            label: g.label,
          }))}
          label="Divisões da lista"
          level="year"
        />
      )}
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={anchor(g.key)} className="year-group">
          <h3 className="year-head" id={anchor(g.key)}>
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
  return (
    <details className="item card">
      <summary>
        <span className="card-main">
          {showKind && <span className="item-kind">{elementLabel(el.name)}</span>}
          <span className="card-title">{info.title || elementLabel(el.name)}</span>
          {info.subtitle && <span className="card-subtitle">{info.subtitle}</span>}
        </span>
        {info.aside && (
          <span className="card-period">
            <span className={info.asideStrong ? 'period current' : 'period'}>{info.aside}</span>
            {info.asideSub && <span className="duration">{info.asideSub}</span>}
          </span>
        )}
      </summary>
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
