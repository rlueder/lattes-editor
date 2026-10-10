// Lista de itens repetidos (atuações, formações, produções, eventos…) em
// linha do tempo: mais recente primeiro, separada por ano, com a barra de anos
// (JumpBar) quando há mais de um ano.

import { useId } from 'react';

import { elementLabel } from '../labels/labels.ts';
import type { XElement } from '../model/xml.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { formatDuration, formatPeriod, groupByYear, type ItemMeta } from './item-meta.ts';
import { JumpBar } from './JumpBar.tsx';

interface Props {
  depth?: number;
  items: XElement[];
  showEmpty: boolean;
  onEdit: EditFn;
}

export function ItemList({ depth = 0, items, onEdit, showEmpty }: Props) {
  const listId = useId();
  const groups = groupByYear(items);
  const dated = groups.some((g) => g.key !== 'sem-ano');
  const mixedKinds = new Set(items.map((el) => el.name)).size > 1;
  const anchor = (key: string) => `${listId}-${key}`;

  const cards = (entries: { el: XElement; meta: ItemMeta }[]) =>
    entries.map(({ el, meta }, i) => (
      <ItemCard
        key={i}
        depth={depth}
        el={el}
        meta={meta}
        showEmpty={showEmpty}
        showKind={mixedKinds}
        onEdit={onEdit}
      />
    ));

  if (!dated) return <div className="item-list">{cards(groups.flatMap((g) => g.items))}</div>;

  return (
    <div className="item-list">
      {groups.length > 1 && (
        <JumpBar
          entries={groups.map((g) => ({
            count: g.items.length,
            id: anchor(g.key),
            label: g.label,
          }))}
          label="Anos"
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
  meta,
  onEdit,
  showEmpty,
  showKind,
}: {
  depth: number;
  el: XElement;
  meta: ItemMeta;
  onEdit: EditFn;
  showEmpty: boolean;
  showKind: boolean;
}) {
  const period = formatPeriod(meta);
  const duration = formatDuration(meta);
  return (
    <details className="item card">
      <summary>
        <span className="card-main">
          {showKind && <span className="item-kind">{elementLabel(el.name)}</span>}
          <span className="card-title">{meta.title || elementLabel(el.name)}</span>
          {meta.subtitle && <span className="card-subtitle">{meta.subtitle}</span>}
        </span>
        {period && (
          <span className="card-period">
            <span className={meta.current ? 'period current' : 'period'}>{period}</span>
            {duration && <span className="duration">{duration}</span>}
          </span>
        )}
      </summary>
      <ElementView depth={depth + 1} el={el} showEmpty={showEmpty} onEdit={onEdit} />
    </details>
  );
}
