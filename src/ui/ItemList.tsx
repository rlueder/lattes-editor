// Lista de itens repetidos agrupada por uma ListView: por ano (atuações,
// formações, produções, eventos…) ou por outra chave (país das instituições,
// área dos cursos). Com mais de um grupo, a barra de atalhos (JumpBar) aparece.

import { useId, useState } from 'react';

import { elementLabel, slugify } from '../labels/labels.ts';
import { goesByChanges, isNewProduction, SEQ_ATTR } from '../model/production.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { useEditor } from './editor-context.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { applyFilter, recordSearchText, type SectionFilter } from './facets.ts';
import { ChevronIcon } from './icons.tsx';
import { JumpBar } from './JumpBar.tsx';
import { formReadNote } from './lattes-refresh.ts';
import { type CardInfo, elementKey, type ListView, type Usage, yearView } from './list-view.ts';
import { groupUsages } from './reference-tables.ts';

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
    ? applyFilter(items, filter.facets, filter.state, (el) => recordSearchText(view.card(el), el))
    : items;
  const groups = view.groups(visible);
  const mixedKinds = new Set(items.map((el) => el.name)).size > 1;
  // Listas aninhadas (dentro de um cartão) não entram na URL; usam ids internos.
  const anchor = (key: string, label: string) =>
    anchorBase ? `${anchorBase}/${slugify(label)}` : `${listId}-${key}`;

  // O ano à direita repete o cabeçalho do grupo; some quando é só ele.
  // Períodos (jan 2011 – dez 2012) e durações continuam.
  const withoutRepeatedYear = (info: CardInfo, groupLabel?: string): CardInfo =>
    groupLabel && info.aside === groupLabel && !info.asideSub
      ? { ...info, aside: undefined }
      : info;

  const cards = (els: XElement[], groupLabel?: string) =>
    els.map((el) => (
      <ItemCard
        key={elementKey(el)}
        depth={depth}
        el={el}
        info={withoutRepeatedYear(view.card(el), groupLabel)}
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
          entries={groups.map((g) => ({ id: anchor(g.key, g.label), label: g.label }))}
          label="Divisões da lista"
          level="year"
          linkable={anchorBase !== undefined}
        />
      )}
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={anchor(g.key, g.label)} className="year-group">
          <h3 className="year-head" id={anchor(g.key, g.label)}>
            {g.label}
            {g.items.length > 1 && <span className="count">{g.items.length}</span>}
          </h3>
          {cards(g.items, g.label)}
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
  const { formRead, loadedMax, openItem, root } = useEditor();
  // Ids dos títulos de subseção, para o índice do item no painel lateral.
  const outlineBase = useId();
  const seq = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
  // Novo também quando vai pela lista de alterações (inclusão pelo conector).
  const isNew = isNewProduction(el, loadedMax);
  const byChanges = goesByChanges(el, loadedMax, undefined, root);
  // Lido dos formulários do Lattes, e não da exportação (form-read.ts).
  const read = formRead?.get(getAttr(el, SEQ_ATTR) ?? '');
  return (
    <details className={isNew ? 'item card is-new' : 'item card'}>
      <summary>
        <span className="card-main">
          {showKind && <span className="item-kind">{elementLabel(el.name)}</span>}
          <span className="card-title">
            {isNew && <span className="tag new">novo</span>}
            {read && (
              <span className="tag warn" title={formReadNote(read)}>
                lido do Lattes
              </span>
            )}
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
            {byChanges
              ? 'Ainda não está no Lattes: vai por "Enviar ao Lattes".'
              : 'Ainda não está no Lattes: entra no próximo arquivo de importação.'}
          </span>
          <button className="ghost" type="button" onClick={() => openItem(seq)}>
            Editar no formulário
          </button>
        </div>
      )}
      {info.usages && info.usages.length > 0 && (
        <Usages label={info.aside ?? 'Onde aparece'} usages={info.usages} />
      )}
      <ElementView
        depth={depth + 1}
        el={el}
        outlineBase={outlineBase}
        showEmpty={showEmpty}
        onEdit={onEdit}
      />
    </details>
  );
}

/**
 * Itens que usam uma entrada das tabelas de apoio: um título com a contagem
 * ("usada em 50 itens") e um grupo por contêiner com a sua contagem, cada um
 * fechado até ser pedido.
 */
function Usages({ label, usages }: { label: string; usages: Usage[] }) {
  const id = useId();
  return (
    <div className="usages">
      <h4 className="usages-head" id={id}>
        <span className="usages-label">Onde aparece</span>
        <span className="usages-count">{label}</span>
      </h4>
      <ul aria-labelledby={id} className="usage-groups">
        {groupUsages(usages).map((g) => (
          <UsageGroupRow key={g.label} {...g} />
        ))}
      </ul>
    </div>
  );
}

function UsageGroupRow({
  label,
  mixedKinds,
  usages,
}: {
  label: string;
  mixedKinds: boolean;
  usages: Usage[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="usage-group">
      <button
        aria-controls={id}
        aria-expanded={open}
        className="usage-group-toggle"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronIcon />
        <span className="usage-group-label">{label}</span>
        <span className="count">
          {usages.length}
          <span className="sr-only">{usages.length === 1 ? ' item' : ' itens'}</span>
        </span>
      </button>
      <ul className="usage-items" hidden={!open} id={id}>
        {usages.map((u, i) => (
          <li key={i}>
            <span className="usage-main">
              {mixedKinds && <span className="item-kind">{u.kind}</span>}
              <span className="usage-title">{u.title || '(sem título)'}</span>
            </span>
            {u.period && <span className="usage-period">{u.period}</span>}
          </li>
        ))}
      </ul>
    </li>
  );
}
