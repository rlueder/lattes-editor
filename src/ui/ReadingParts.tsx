// Peças do modo de leitura: linhas de texto, rótulos e valores, campos vazios
// e seções. Cada uma se compõe igual na leitura e na edição; na edição, os
// valores viram campos no mesmo lugar (InlineField.tsx).

import { attributeLabelIn } from '../labels/labels.ts';
import type { EditFn } from './ElementView.tsx';
import { InlineField } from './InlineField.tsx';
import { curlyQuotes, hiddenNote, paragraphs } from './reading.ts';
import {
  isRequired,
  type Line,
  lineVisible,
  type Part,
  partText,
  type Section,
  shownParts,
} from './reading-layout.ts';

export interface FieldHooks {
  onActive?: (key: string | null) => void;
  onDraft?: (key: string, value: string) => void;
  onEdit: EditFn;
}

/** O valor lido de um pedaço, marcado para o clique saber onde caiu. */
function PartText({ part, text }: { part: Part; text: string }) {
  const url = /^(HOME-PAGE|ORCID-ID)/.test(part.attr) && /^https?:\/\//.test(text) ? text : '';
  return (
    <span data-part={part.key}>
      {url ? (
        <a href={url} rel="noreferrer" target="_blank">
          {text.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
        </a>
      ) : (
        text
      )}
    </span>
  );
}

/** Uma linha de texto; na edição, cada pedaço preenchido vira campo no mesmo lugar. */
export function LineView({
  editing,
  hooks,
  line,
}: {
  editing: boolean;
  hooks: FieldHooks;
  line: Line;
}) {
  const shown = shownParts(line);
  if (!lineVisible(line) || (shown.length === 0 && !line.always)) return null;
  const Tag = line.kind === 'when' ? 'span' : 'p';
  if (line.kind === 'para' || line.kind === 'translation') {
    const part = shown[0]!.part;
    return (
      <div className={`rl rl-${line.kind}`} lang={line.kind === 'translation' ? 'en' : undefined}>
        {line.label && <span className="reading-label">{line.label}</span>}
        {editing ? (
          <InlineField {...hooks} part={part} />
        ) : (
          <div data-part={part.key}>
            {paragraphs(shown[0]!.text).map((p, i) => (
              <p key={i} className="reading-p">
                {curlyQuotes(p)}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }
  // Pedaço sozinho na linha vira campo do tamanho da linha; vários, campos na frase.
  const inline = shown.length > 1 || Boolean(line.prefix || line.suffix) || line.kind === 'when';
  return (
    <Tag className={`rl rl-${line.kind}`}>
      {line.prefix}
      {shown.map((s) => (
        <span key={s.part.key}>
          {s.before}
          {editing ? (
            <InlineField {...hooks} inline={inline} part={s.part} />
          ) : (
            <PartText part={s.part} text={s.text} />
          )}
        </span>
      ))}
      {line.suffix}
    </Tag>
  );
}

/** Rótulo e valor; na edição, o valor vira campo e o rótulo fica onde estava. */
export function Rows({
  editing,
  hooks,
  parts,
  quiet,
}: {
  editing: boolean;
  hooks: FieldHooks;
  parts: Part[];
  quiet: boolean;
}) {
  if (parts.length === 0) return null;
  return (
    <dl className={quiet ? 'reading-fields is-quiet' : 'reading-fields'}>
      {parts.map((p) => (
        <div key={p.key} className="reading-field">
          <dt>{attributeLabelIn(p.el.name, p.attr)}</dt>
          <dd>
            {editing ? (
              <InlineField {...hooks} part={p} />
            ) : (
              <PartText part={p} text={partText(p)} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Os campos vazios, só na edição: depois de um fio, obrigatórios primeiro e marcados. */
export function EmptyGroup({ hooks, parts }: { hooks: FieldHooks; parts: Part[] }) {
  if (parts.length === 0) return null;
  return (
    <div className="reading-empty">
      <p className="reading-empty-caption">Campos vazios</p>
      <dl className="reading-fields is-quiet">
        {parts.map((p) => (
          <div key={p.key} className="reading-field">
            <dt>
              {attributeLabelIn(p.el.name, p.attr)}
              {isRequired(p.el, p.attr) && <span className="reading-required">obrigatório</span>}
            </dt>
            <dd>
              <InlineField {...hooks} part={p} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function hasContent(s: Section): boolean {
  return s.hidden || s.masked > 0 || s.rows.length > 0 || s.lines.some(lineVisible);
}

/** Uma seção do bloco: título, linhas, rótulos e, na edição, os vazios. */
export function SectionView({
  editing,
  hooks,
  section,
}: {
  editing: boolean;
  hooks: FieldHooks;
  section: Section;
}) {
  if (!hasContent(section) && !(editing && section.empty.length > 0)) return null;
  const body = (
    <>
      {section.hidden ? (
        <p className="reading-none">Oculto pelo modo de privacidade.</p>
      ) : (
        <>
          {section.lines.map((line, i) => (
            <LineView key={i} editing={editing} hooks={hooks} line={line} />
          ))}
          <Rows editing={editing} hooks={hooks} parts={section.rows} quiet={section.quietRows} />
          {section.masked > 0 && (
            <p className="reading-none reading-hidden">{hiddenNote(section.masked)}</p>
          )}
          {editing && <EmptyGroup hooks={hooks} parts={section.empty} />}
        </>
      )}
    </>
  );
  if (!section.heading) return body;
  return (
    <section className="reading-sub">
      {section.minor ? (
        <p className="reading-sublabel">{section.heading}</p>
      ) : (
        <h3>{section.heading}</h3>
      )}
      {body}
    </section>
  );
}

export function Sections({
  editing,
  hooks,
  sections,
}: {
  editing: boolean;
  hooks: FieldHooks;
  sections: Section[];
}) {
  if (!editing && !sections.some(hasContent)) {
    return <p className="reading-none">Nada preenchido.</p>;
  }
  return sections.map((s, i) => (
    <SectionView key={i} editing={editing} hooks={hooks} section={s} />
  ));
}
