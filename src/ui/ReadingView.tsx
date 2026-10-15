// Modo de leitura (protótipo, ?leitura): cada grupo da seção composto como
// texto, sem bordas de campo nem rótulos que repetem o título. Na edição, o
// texto fica no topo como prévia e os campos vêm abaixo (ReadingBlock.tsx).
// A composição sem React está em reading-layout.ts e reading-reference.ts.

import { type CSSProperties, useMemo } from 'react';

import { elementLabel } from '../labels/labels.ts';
import { isPendingImport, SEQ_ATTR } from '../model/production.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { referenceText } from '../print/abnt.ts';
import { hasReference, referenceFor } from '../print/references.ts';
import { FieldSlotContext } from './draft-context.ts';
import { useEditor } from './editor-context.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { applyFilter, cardText, type SectionFilter } from './facets.ts';
import { useFieldOrder } from './field-order.ts';
import { formatPeriod, itemMeta } from './item-meta.ts';
import { ItemList } from './ItemList.tsx';
import { elementKey, type ListView, yearView } from './list-view.ts';
import { type PreviewKind, previewSlots } from './preview-order.ts';
import { tabWidth, yearColumn } from './reading.ts';
import {
  addressLayout,
  fieldsLayout,
  type LayoutOptions,
  lineText,
  resumoLayout,
} from './reading-layout.ts';
import { recordLayout, recordWhen } from './reading-records.ts';
import { EditableBlock } from './ReadingBlock.tsx';
import { CitationReading } from './ReadingCitation.tsx';
import { LineView, Sections, SectionView } from './ReadingParts.tsx';
import { useLayoutOptions } from './use-reading-options.ts';

/** O formulário de hoje com todos os campos; ainda serve aos testes e ao "Editar no formulário". */
export function EditForm({ depth, el, onEdit }: { depth?: number; el: XElement; onEdit: EditFn }) {
  return <ElementView depth={depth} el={el} showEmpty={true} onEdit={onEdit} />;
}

/**
 * Os campos do bloco em edição, na ordem que o ⚙ pede: como na prévia (o
 * padrão, preview-order.ts) ou como no formulário do Lattes (form-order.ts).
 */
function OrderedForm({
  depth,
  el,
  kind,
  onEdit,
}: {
  depth?: number;
  el: XElement;
  kind: PreviewKind;
  onEdit: EditFn;
}) {
  const order = useFieldOrder();
  const slots = useMemo(
    () => (order === 'previa' ? previewSlots(el, kind) : null),
    [el, kind, order],
  );
  return (
    <FieldSlotContext.Provider value={slots}>
      <EditForm depth={depth} el={el} onEdit={onEdit} />
    </FieldSlotContext.Provider>
  );
}

/** Bloco de campos (resumo, identificação, endereço, outras informações). */
function FieldsBlock({ el, label, onEdit }: { el: XElement; label: string; onEdit: EditFn }) {
  const opts = useLayoutOptions();
  const sectionsOf = (x: XElement) =>
    x.name === 'RESUMO-CV'
      ? resumoLayout(x, opts)
      : x.name === 'ENDERECO'
        ? addressLayout(x, opts)
        : fieldsLayout(x, opts);
  const missingEnglish =
    el.name === 'RESUMO-CV' && !getAttr(el, 'TEXTO-RESUMO-CV-RH-EN')?.trim()
      ? 'Adicionar resumo em inglês'
      : undefined;
  return (
    <EditableBlock
      addLabel={missingEnglish}
      className={el.name === 'RESUMO-CV' ? 'reading-prose' : undefined}
      form={() => (
        <OrderedForm
          el={el}
          kind={el.name === 'RESUMO-CV' ? 'resumo' : el.name === 'ENDERECO' ? 'address' : 'fields'}
          onEdit={onEdit}
        />
      )}
      label={label}
      read={(x) => <Sections sections={sectionsOf(x)} />}
      root={el}
    />
  );
}

interface ListProps {
  /** Formação acadêmica: nível, curso, instituição e trabalho. */
  academic: boolean;
  filter?: SectionFilter;
  items: XElement[];
  view: ListView;
  onEdit: EditFn;
}

/**
 * Produção com autores: lida como referência da NBR 6023. Os outros itens com
 * dados básicos (evento, orientação, banca) leem como registro.
 */
function isCitation(el: XElement): boolean {
  return hasReference(el) && childElements(el).some((c) => c.name === 'AUTORES');
}

/** O texto da coluna da esquerda de um registro: período, ano ou idioma. */
function whenOf(el: XElement, academic: boolean, opts: LayoutOptions): string {
  const when = recordWhen(el, academic, opts);
  return (when && lineText(when)) || formatPeriod(itemMeta(el));
}

/** Um registro lido: a coluna da esquerda e o texto ao lado. */
function RecordRead({
  academic,
  cell,
  el,
  isNew,
  kind,
}: {
  academic: boolean;
  /** O ano mostrado na coluna (vazio quando repete o de cima) e o ano inteiro. */
  cell: { shown: string; value: string };
  el: XElement;
  isNew: boolean;
  kind?: string;
}) {
  const opts = useLayoutOptions();
  const citation = isCitation(el);
  const layout = citation ? undefined : recordLayout(el, academic, opts);
  // Cada ano com a chave do campo dele, para acender quando o campo está em foco.
  const when = recordWhen(el, academic, opts);
  const shownWhen = when && lineText(when) === cell.shown ? <LineView line={when} /> : cell.shown;
  return (
    <>
      <span className="rr-when">
        {cell.shown ? shownWhen : <span className="sr-only">{cell.value}</span>}
      </span>
      <div className="rr-body">
        {isNew && <span className="tag new">novo</span>}
        {citation ? (
          <CitationReading el={el} kind={kind} />
        ) : (
          <>
            {kind && <span className="rr-kind">{kind}</span>}
            <SectionView section={{ ...layout!, when: undefined }} />
          </>
        )}
      </div>
    </>
  );
}

/** Registros com o ano (ou o idioma) numa coluna à esquerda, sem cartões. */
function RecordList({ academic, filter, items, onEdit, view }: ListProps) {
  const { loadedMax, openItem } = useEditor();
  const opts = useLayoutOptions();
  const visible = filter
    ? applyFilter(items, filter.facets, filter.state, (el) => cardText(view.card(el)))
    : items;
  if (visible.length === 0) return null;
  const sorted = [...visible]
    .map((el, i) => ({ el, i, key: itemMeta(el).sortKey }))
    .sort((a, b) => b.key - a.key || a.i - b.i)
    .map((x) => x.el);
  const showKind = new Set(items.map((el) => el.name)).size > 1;
  const when = sorted.map((el) => whenOf(el, academic, opts));
  const column = yearColumn(when);
  // A coluna da esquerda tem a largura do texto mais longo dela.
  const tab = { '--read-tab': `${tabWidth(when)}ch` } as CSSProperties;
  return (
    <ol className="reading-records" style={tab}>
      {sorted.map((el, i) => {
        const seq = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
        const isNew = isPendingImport(el, loadedMax);
        // Na formação, o grau já diz o tipo do item.
        const kind = showKind && !academic ? elementLabel(el.name) : undefined;
        const title = isCitation(el)
          ? referenceText(referenceFor(el)).slice(0, 80)
          : lineText(recordLayout(el, academic, opts).lines[0]!) || elementLabel(el.name);
        return (
          <li key={elementKey(el)} className="reading-record">
            <EditableBlock
              className="rr"
              editExtra={
                isNew && (
                  <button className="ghost" type="button" onClick={() => openItem(seq)}>
                    Editar no formulário
                  </button>
                )
              }
              form={() => (
                <OrderedForm
                  depth={1}
                  el={el}
                  kind={isCitation(el) ? 'citation' : academic ? 'academic' : 'record'}
                  onEdit={onEdit}
                />
              )}
              label={title}
              read={(x, editing) => (
                <RecordRead
                  academic={academic}
                  // Na edição, a prévia mostra o ano inteiro, com o rascunho.
                  cell={
                    editing
                      ? { shown: whenOf(x, academic, opts), value: whenOf(x, academic, opts) }
                      : column[i]!
                  }
                  el={x}
                  isNew={isNew}
                  kind={kind}
                />
              )}
              root={el}
            />
          </li>
        );
      })}
    </ol>
  );
}

interface GroupProps {
  elements: XElement[];
  filter?: SectionFilter;
  /** Rótulo do grupo (Resumo, Identificação), para o botão e o painel de edição. */
  label: string;
  /** Os itens de lista do grupo; null quando o grupo é um bloco de campos. */
  list: { container?: XElement; items: XElement[]; view: ListView } | null;
  onEdit: EditFn;
}

/**
 * Um grupo da seção no modo de leitura. A leitura mostra todo campo
 * preenchido e esconde os vazios; na edição, o texto fica no topo como prévia
 * e os campos, todos, vêm abaixo, com os vazios no fim de cada grupo. O ⚙
 * "Mostrar campos vazios" não vale aqui.
 */
export function ReadingGroup({ elements, filter, label, list, onEdit }: GroupProps) {
  // Tabelas de apoio (instituições, cursos em "Outros dados") têm visão própria,
  // com "Onde aparece": continuam como lista de cartões.
  if (list && list.view !== yearView) {
    return (
      <ItemList
        filter={filter}
        items={list.items}
        showEmpty={false}
        view={list.view}
        onEdit={onEdit}
      />
    );
  }
  if (list) {
    const container = list.container?.name ?? elements[0]?.name;
    return (
      <RecordList
        academic={container === 'FORMACAO-ACADEMICA-TITULACAO'}
        filter={filter}
        items={list.items}
        view={list.view}
        onEdit={onEdit}
      />
    );
  }
  return elements.map((el, i) => <FieldsBlock key={i} el={el} label={label} onEdit={onEdit} />);
}
