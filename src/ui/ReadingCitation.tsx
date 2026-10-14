// Produção no modo de leitura: a referência da NBR 6023 e, na edição, a mesma
// referência viva no topo, que acompanha o que se digita. Cada campo acende o
// trecho dele, e clicar num trecho leva ao campo.

import { useState } from 'react';

import { attributeLabelIn } from '../labels/labels.ts';
import type { XElement } from '../model/xml.ts';
import type { EditFn } from './ElementView.tsx';
import { InlineField } from './InlineField.tsx';
import { curlyQuotes } from './reading.ts';
import {
  citationFields,
  highlightMatches,
  liveReference,
  outsideReference,
  type Piece,
} from './reading-reference.ts';
import { EmptyGroup, type FieldHooks, Rows } from './ReadingParts.tsx';
import { useLayoutOptions } from './use-reading-options.ts';

/** A referência em trechos; cada trecho sabe de que campo veio. */
function ReferenceText({
  active,
  onPick,
  pieces,
}: {
  active?: string | null;
  onPick?: (key: string, from: Element) => void;
  pieces: Piece[];
}) {
  return pieces.map((p, i) => {
    const text = curlyQuotes(p.text);
    const body = p.strong ? <em>{text}</em> : text;
    if (!p.key) return <span key={i}>{body}</span>;
    const lit = active != null && highlightMatches(p.key, active);
    return (
      // O trecho é um atalho de mouse para o campo, que segue alcançável pelo Tab.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <span
        key={i}
        className={lit ? 'ref-piece is-lit' : 'ref-piece'}
        data-part={p.key}
        onClick={onPick ? (e) => onPick(p.key!, e.currentTarget) : undefined}
      >
        {body}
      </span>
    );
  });
}

/** Leva o foco ao campo de um trecho da referência ("3:*" é o primeiro campo do autor). */
function focusField(from: Element, key: string) {
  const block = from.closest('.reading-block');
  const selector = key.endsWith(':*')
    ? `[data-field^="${CSS.escape(key.slice(0, -1))}"]`
    : `[data-field="${CSS.escape(key)}"]`;
  block?.querySelector<HTMLElement>(selector)?.focus();
}

/** Produção: a referência da NBR 6023, viva na edição, com os campos na ordem da citação. */
export function CitationBody({
  editing,
  el,
  kind,
  onEdit,
}: {
  editing: boolean;
  el: XElement;
  kind?: string;
  onEdit: EditFn;
}) {
  const opts = useLayoutOptions();
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [active, setActive] = useState<string | null>(null);
  const ref = liveReference(el, editing ? drafts : new Map(), opts);
  const hooks: FieldHooks = {
    onActive: setActive,
    onDraft: (key, value) => setDrafts((prev) => new Map(prev).set(key, value)),
    onEdit,
  };
  const kindLine = kind && <span className="rr-kind">{kind}</span>;
  if (!editing) {
    return (
      <>
        <p className="rr-text rr-ref">
          {kindLine}
          <ReferenceText pieces={ref.pieces} />
        </p>
        <Rows editing={false} hooks={hooks} parts={outsideReference(el, opts)} quiet={true} />
      </>
    );
  }
  const fields = citationFields(el, opts);
  return (
    <>
      <p aria-live="polite" className="rr-text rr-ref is-live">
        {kindLine}
        <ReferenceText
          active={active}
          pieces={ref.pieces}
          onPick={(key, from) => focusField(from, key)}
        />
      </p>
      {fields.authors.length > 0 && (
        <dl className="reading-fields is-quiet reading-authors">
          {fields.authors.map((a, n) => (
            <div key={a.index} className="reading-field">
              <dt>{`Autor ${n + 1}`}</dt>
              <dd className="reading-author">
                {a.parts.map((p) => (
                  <span key={p.key} className="reading-author-part">
                    <span className="reading-caption">{attributeLabelIn(p.el.name, p.attr)}</span>
                    <InlineField {...hooks} part={p} />
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Rows editing={true} hooks={hooks} parts={fields.filled} quiet={true} />
      <EmptyGroup hooks={hooks} parts={fields.empty} />
    </>
  );
}
