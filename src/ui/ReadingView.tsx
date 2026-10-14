// Modo de leitura (protótipo, ?leitura): cada grupo da seção composto como
// texto, sem bordas de campo nem rótulos que repetem o título. Cada bloco (um
// registro, a identificação, o resumo) vira o formulário de hoje quando a
// pessoa pede (ReadingBlock.tsx). A lógica sem React está em reading.ts.

import { elementLabel } from '../labels/labels.ts';
import { isPendingImport, SEQ_ATTR } from '../model/production.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import type { Segment } from '../print/abnt.ts';
import { languageLine, listEntry, newestFirst } from '../print/entries.ts';
import { hasReference, referenceFor } from '../print/references.ts';
import { useEditor } from './editor-context.ts';
import { type EditFn, ElementView } from './ElementView.tsx';
import { applyFilter, cardText, type SectionFilter } from './facets.ts';
import { elementKey, type ListView } from './list-view.ts';
import { isSensitiveAttr, useHideSensitive } from './privacy.ts';
import {
  ADDRESS_LINE_ATTRS,
  addressLines,
  curlyQuotes,
  formationEntry,
  hiddenNote,
  paragraphs,
  type ReadingField,
  readingFields,
  yearColumn,
} from './reading.ts';
import { EditableBlock } from './ReadingBlock.tsx';
import { useShowCodes } from './show-codes.ts';

/** Lista de rótulo e valor (identificação, contatos), na mesma tabulação dos anos. */
function FieldList({ fields }: { fields: ReadingField[] }) {
  // No modo de privacidade, os dados escondidos viram uma linha só, em vez de
  // uma fila de máscaras; o valor nunca chega à tela.
  const shown = fields.filter((f) => !f.masked);
  const hidden = fields.length - shown.length;
  if (fields.length === 0) return null;
  return (
    <>
      {shown.length > 0 && (
        <dl className="reading-fields">
          {shown.map((f) => (
            <div key={f.attr} className="reading-field">
              <dt>{f.label}</dt>
              <dd>
                {f.url ? (
                  <a href={f.url} rel="noreferrer" target="_blank">
                    {f.text.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                ) : (
                  f.text
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {hidden > 0 && <p className="reading-none reading-hidden">{hiddenNote(hidden)}</p>}
    </>
  );
}

function Paragraphs({ lang, text }: { lang?: string; text: string }) {
  return paragraphs(text).map((p, i) => (
    <p key={i} className="reading-p" lang={lang}>
      {curlyQuotes(p)}
    </p>
  ));
}

function useReadingOptions() {
  return { hideSensitive: useHideSensitive(), showCodes: useShowCodes() };
}

/** Resumo: o texto corrido e, abaixo, a versão em inglês com um rótulo curto. */
function ResumoReading({ el }: { el: XElement }) {
  const pt = getAttr(el, 'TEXTO-RESUMO-CV-RH')?.trim() ?? '';
  const en = getAttr(el, 'TEXTO-RESUMO-CV-RH-EN')?.trim() ?? '';
  return (
    <>
      {pt ? <Paragraphs text={pt} /> : <p className="reading-none">Sem resumo em português.</p>}
      {en && (
        <div className="reading-translation">
          <span className="reading-label">Em inglês</span>
          <Paragraphs lang="en" text={en} />
        </div>
      )}
    </>
  );
}

/** Endereço composto em linhas; telefones e outros campos numa lista curta. */
function AddressReading({ el }: { el: XElement }) {
  const opts = useReadingOptions();
  const parts = childElements(el).filter((c) => c.attrs.some((a) => a.value.trim()));
  const own = readingFields(el, opts);
  return (
    <>
      {parts.map((part) => {
        const hidden = opts.hideSensitive && isSensitiveAttr(part.name, '');
        return (
          <section key={part.name} className="reading-sub">
            <h3>{elementLabel(part.name)}</h3>
            {hidden ? (
              <p className="reading-none">Oculto pelo modo de privacidade.</p>
            ) : (
              <>
                <address className="reading-address">
                  {addressLines(part).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </address>
                <FieldList fields={readingFields(part, { ...opts, except: ADDRESS_LINE_ATTRS })} />
              </>
            )}
          </section>
        );
      })}
      {own.length > 0 && (
        <section className="reading-sub">
          <h3>Contatos e preferência</h3>
          <FieldList fields={own} />
        </section>
      )}
    </>
  );
}

const IDENTIFICATION_ELSEWHERE = new Set(['TEXTO-RESUMO-CV-RH', 'OUTRAS-INFORMACOES-RELEVANTES']);

/** Campos de qualquer bloco: um texto só vira parágrafo; vários, lista de rótulos. */
function GenericReading({ depth = 0, el }: { depth?: number; el: XElement }) {
  const opts = useReadingOptions();
  const except = el.name === 'DADOS-GERAIS' ? IDENTIFICATION_ELSEWHERE : undefined;
  const fields = readingFields(el, { ...opts, except });
  const kids = childElements(el).filter((c) => c.attrs.some((a) => a.value.trim()));
  const single = fields.length === 1 && kids.length === 0 && !fields[0]!.masked;
  if (fields.length === 0 && kids.length === 0) {
    return <p className="reading-none">Nada preenchido.</p>;
  }
  return (
    <>
      {single ? <Paragraphs text={fields[0]!.text} /> : <FieldList fields={fields} />}
      {kids.map((kid, i) =>
        depth === 0 ? (
          <section key={i} className="reading-sub">
            <h3>{elementLabel(kid.name)}</h3>
            <GenericReading depth={1} el={kid} />
          </section>
        ) : (
          <FieldList key={i} fields={readingFields(kid, opts)} />
        ),
      )}
    </>
  );
}

function Reference({ segments }: { segments: Segment[] }) {
  return segments.map((s, i) =>
    s.strong ? <strong key={i}>{curlyQuotes(s.text)}</strong> : curlyQuotes(s.text),
  );
}

/** O corpo de um registro: formação, idioma, referência ABNT ou título e apoio. */
function RecordBody({
  academic,
  el,
  showKind,
}: {
  academic: boolean;
  el: XElement;
  showKind: boolean;
}) {
  if (el.name === 'IDIOMA') {
    const { detail } = languageLine(el, false);
    return detail ? (
      <p className="rr-text">{`${detail[0]!.toUpperCase()}${detail.slice(1)}.`}</p>
    ) : null;
  }
  if (academic) {
    const f = formationEntry(el, elementLabel(el.name));
    return (
      <>
        <p className="rr-title">{f.degree}</p>
        {f.institution && <p className="rr-text">{f.institution}</p>}
        {f.work && <p className="rr-text rr-work">{f.work}</p>}
        {f.notes.map((n) => (
          <p key={n} className="rr-meta">
            {n}
          </p>
        ))}
      </>
    );
  }
  const kind = showKind && <span className="rr-kind">{elementLabel(el.name)}</span>;
  if (hasReference(el)) {
    return (
      <p className="rr-text rr-ref">
        {kind}
        <Reference segments={referenceFor(el)} />
      </p>
    );
  }
  const entry = listEntry(el);
  return (
    <>
      <p className="rr-title">
        {kind}
        {curlyQuotes(entry.title || elementLabel(el.name))}
      </p>
      {entry.subtitle && <p className="rr-meta">{curlyQuotes(entry.subtitle)}</p>}
    </>
  );
}

interface ListProps {
  /** Formação acadêmica: nível, curso, instituição e trabalho. */
  academic: boolean;
  filter?: SectionFilter;
  items: XElement[];
  showEmpty: boolean;
  view: ListView;
  onEdit: EditFn;
}

/** Registros com o ano (ou o idioma) numa coluna à esquerda, sem cartões. */
function RecordList({ academic, filter, items, onEdit, showEmpty, view }: ListProps) {
  const { loadedMax, openItem } = useEditor();
  const visible = filter
    ? applyFilter(items, filter.facets, filter.state, (el) => cardText(view.card(el)))
    : items;
  if (visible.length === 0) return null;
  const sorted = newestFirst(visible);
  const showKind = new Set(items.map((el) => el.name)).size > 1;
  const when = sorted.map((el) =>
    el.name === 'IDIOMA' ? languageLine(el, false).name : (view.card(el).aside ?? ''),
  );
  const column = yearColumn(when);
  return (
    <ol className="reading-records">
      {sorted.map((el, i) => {
        const seq = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
        const isNew = isPendingImport(el, loadedMax);
        const cell = column[i]!;
        const title = listEntry(el).title || elementLabel(el.name);
        return (
          <li key={elementKey(el)} className="reading-record">
            <EditableBlock
              className="rr"
              edit={(all) => (
                <ElementView depth={1} el={el} showEmpty={all || showEmpty} onEdit={onEdit} />
              )}
              editExtra={
                isNew && (
                  <button className="ghost" type="button" onClick={() => openItem(seq)}>
                    Editar no formulário
                  </button>
                )
              }
              label={title}
            >
              <span className="rr-when">
                {cell.shown ? cell.shown : <span className="sr-only">{cell.value}</span>}
              </span>
              <div className="rr-body">
                {isNew && <span className="tag new">novo</span>}
                <RecordBody academic={academic} el={el} showKind={showKind} />
              </div>
            </EditableBlock>
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
  showEmpty: boolean;
  onEdit: EditFn;
}

/** Um grupo da seção no modo de leitura. */
export function ReadingGroup({ elements, filter, label, list, onEdit, showEmpty }: GroupProps) {
  if (list) {
    const container = list.container?.name ?? elements[0]?.name;
    return (
      <RecordList
        academic={container === 'FORMACAO-ACADEMICA-TITULACAO'}
        filter={filter}
        items={list.items}
        showEmpty={showEmpty}
        view={list.view}
        onEdit={onEdit}
      />
    );
  }
  return elements.map((el, i) => {
    const edit = (all: boolean) => (
      <ElementView el={el} showEmpty={all || showEmpty} onEdit={onEdit} />
    );
    if (el.name === 'RESUMO-CV') {
      const hasEnglish = Boolean(getAttr(el, 'TEXTO-RESUMO-CV-RH-EN')?.trim());
      return (
        <EditableBlock
          key={i}
          addLabel={hasEnglish ? undefined : 'Adicionar resumo em inglês'}
          className="reading-prose"
          edit={edit}
          label={label}
        >
          <ResumoReading el={el} />
        </EditableBlock>
      );
    }
    return (
      <EditableBlock key={i} edit={edit} label={label}>
        {el.name === 'ENDERECO' ? <AddressReading el={el} /> : <GenericReading el={el} />}
      </EditableBlock>
    );
  });
}
