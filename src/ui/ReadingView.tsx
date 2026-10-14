// Modo de leitura (protótipo, ?leitura): cada grupo da seção composto como
// texto, sem bordas de campo nem rótulos que repetem o título. A edição é a
// mesma composição com cada pedaço virando campo no lugar (ReadingBlock.tsx,
// InlineField.tsx); os campos vazios aparecem só na edição, no fim do bloco.
// A composição sem React está em reading-layout.ts e reading-reference.ts.

import type { CSSProperties } from 'react';

import { elementLabel } from '../labels/labels.ts';
import { isPendingImport, SEQ_ATTR } from '../model/production.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { hasReference } from '../print/references.ts';
import { useEditor } from './editor-context.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { applyFilter, cardText, type SectionFilter } from './facets.ts';
import { formatPeriod, itemMeta } from './item-meta.ts';
import { elementKey, type ListView } from './list-view.ts';
import { tabWidth, yearColumn } from './reading.ts';
import {
  addressLayout,
  fieldsLayout,
  lineText,
  recordLayout,
  resumoLayout,
} from './reading-layout.ts';
import { liveReference } from './reading-reference.ts';
import { EditableBlock } from './ReadingBlock.tsx';
import { CitationBody } from './ReadingCitation.tsx';
import { LineView, Sections, SectionView } from './ReadingParts.tsx';
import { useLayoutOptions } from './use-reading-options.ts';

/** O formulário de hoje com todos os campos; ainda serve aos testes e ao "Editar no formulário". */
export function EditForm({ depth, el, onEdit }: { depth?: number; el: XElement; onEdit: EditFn }) {
  return <ElementView depth={depth} el={el} showEmpty={true} onEdit={onEdit} />;
}

/** Bloco de campos (resumo, identificação, endereço, outras informações). */
function FieldsBlock({ el, label, onEdit }: { el: XElement; label: string; onEdit: EditFn }) {
  const opts = useLayoutOptions();
  const sections =
    el.name === 'RESUMO-CV'
      ? resumoLayout(el, opts)
      : el.name === 'ENDERECO'
        ? addressLayout(el, opts)
        : fieldsLayout(el, opts);
  const missingEnglish =
    el.name === 'RESUMO-CV' && !getAttr(el, 'TEXTO-RESUMO-CV-RH-EN')?.trim()
      ? 'Adicionar resumo em inglês'
      : undefined;
  return (
    <EditableBlock
      addLabel={missingEnglish}
      className={el.name === 'RESUMO-CV' ? 'reading-prose' : undefined}
      label={label}
      render={(editing) => <Sections editing={editing} hooks={{ onEdit }} sections={sections} />}
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
  const records = sorted.map((el) => {
    const citation = hasReference(el);
    const layout = citation ? undefined : recordLayout(el, academic, opts);
    const when = layout?.when ? lineText(layout.when) : formatPeriod(itemMeta(el));
    return { citation, el, layout, when };
  });
  const column = yearColumn(records.map((r) => r.when));
  // A coluna da esquerda tem a largura do texto mais longo dela.
  const tab = { '--read-tab': `${tabWidth(records.map((r) => r.when))}ch` } as CSSProperties;
  return (
    <ol className="reading-records" style={tab}>
      {records.map(({ citation, el, layout, when }, i) => {
        const seq = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
        const isNew = isPendingImport(el, loadedMax);
        const cell = column[i]!;
        // Na formação, o grau já diz o tipo do item.
        const kind = showKind && !academic ? elementLabel(el.name) : undefined;
        const title = citation
          ? liveReference(el, new Map(), opts).text.slice(0, 80)
          : lineText(layout!.lines[0]!) || elementLabel(el.name);
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
              label={title}
              render={(editing) => (
                <>
                  <span className="rr-when">
                    {editing && layout?.when ? (
                      <LineView editing={true} hooks={{ onEdit }} line={layout.when} />
                    ) : cell.shown ? (
                      layout?.when ? (
                        <LineView editing={false} hooks={{ onEdit }} line={layout.when} />
                      ) : (
                        cell.shown
                      )
                    ) : (
                      <span className="sr-only">{when}</span>
                    )}
                  </span>
                  <div className="rr-body">
                    {isNew && <span className="tag new">novo</span>}
                    {citation ? (
                      <CitationBody editing={editing} el={el} kind={kind} onEdit={onEdit} />
                    ) : (
                      <>
                        {kind && <span className="rr-kind">{kind}</span>}
                        <SectionView
                          editing={editing}
                          hooks={{ onEdit }}
                          section={{ ...layout!, when: undefined }}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
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
 * preenchido e esconde os vazios; a edição é a mesma composição, editável,
 * com os vazios no fim. O ⚙ "Mostrar campos vazios" não vale aqui.
 */
export function ReadingGroup({ elements, filter, label, list, onEdit }: GroupProps) {
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
