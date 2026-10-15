// Peças do modo de leitura: linhas de texto, rótulos e valores e seções,
// compostas a partir de reading-layout.ts. Servem à leitura e à prévia no topo
// do bloco em edição, que é a mesma composição com os rascunhos dos campos.

import { attributeLabelIn } from '../labels/labels.ts';
import { cellSpan, curlyQuotes, hiddenNote, paragraphs } from './reading.ts';
import {
  type Line,
  lineVisible,
  type Part,
  partText,
  type Section,
  shownParts,
} from './reading-layout.ts';

/** O valor lido de um pedaço; página e ORCID viram link. */
function PartText({ part, text }: { part: Part; text: string }) {
  const url = /^(HOME-PAGE|ORCID-ID)/.test(part.attr) && /^https?:\/\//.test(text) ? text : '';
  if (!url) return text;
  return (
    <a href={url} rel="noreferrer" target="_blank">
      {text.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
    </a>
  );
}

/** Uma linha de texto: prefixo, pedaços preenchidos com a ligação certa e sufixo. */
export function LineView({ line }: { line: Line }) {
  const shown = shownParts(line);
  if (!lineVisible(line)) return null;
  if (line.kind === 'para' || line.kind === 'translation') {
    return (
      <div
        className={`rl rl-${line.kind}`}
        data-part={shown[0]?.part.key}
        lang={line.kind === 'translation' ? 'en' : undefined}
      >
        {line.label && <span className="reading-label">{line.label}</span>}
        {paragraphs(shown[0]?.text ?? '').map((p, i) => (
          <p key={i} className="reading-p">
            {curlyQuotes(p)}
          </p>
        ))}
      </div>
    );
  }
  const Tag = line.kind === 'when' ? 'span' : 'p';
  return (
    <Tag className={`rl rl-${line.kind}`}>
      {line.prefix}
      {shown.map((s) => (
        <span key={s.part.key}>
          {s.before}
          <span data-part={s.part.key}>
            <PartText part={s.part} text={s.text} />
          </span>
        </span>
      ))}
      {line.suffix}
    </Tag>
  );
}

const labelOf = (p: Part) => attributeLabelIn(p.el.name, p.attr);

/**
 * Rótulo e valor em grade de três colunas (duas em tela estreita), o rótulo
 * pequeno, na sans, acima do valor. Um valor longo ocupa mais colunas em vez
 * de se espremer (cellSpan); a grade segue a ordem de leitura, sem
 * reacomodar valores curtos nos buracos que um longo deixa.
 */
export function Rows({ parts, quiet }: { parts: Part[]; quiet: boolean }) {
  if (parts.length === 0) return null;
  return (
    <dl className={quiet ? 'reading-fields is-quiet' : 'reading-fields'}>
      {parts.map((p) => {
        const span = cellSpan(partText(p));
        const classes = ['reading-field', span === 2 && 'span-2', span === 3 && 'span-all']
          .filter(Boolean)
          .join(' ');
        return (
          <div key={p.key} className={classes} data-part={p.key}>
            {/* Rótulo numa linha só; o nome inteiro no passar do mouse. */}
            <dt title={labelOf(p)}>{labelOf(p)}</dt>
            <dd>
              <PartText part={p} text={partText(p)} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function hasContent(s: Section): boolean {
  return s.hidden || s.masked > 0 || s.rows.length > 0 || s.lines.some(lineVisible);
}

/** Uma seção do bloco: título, linhas e rótulos. */
export function SectionView({ section }: { section: Section }) {
  if (!hasContent(section)) return null;
  const body = section.hidden ? (
    <p className="reading-none">Oculto pelo modo de privacidade.</p>
  ) : (
    <>
      {section.lines.map((line, i) => (
        <LineView key={i} line={line} />
      ))}
      <Rows parts={section.rows} quiet={section.quietRows} />
      {section.masked > 0 && (
        <p className="reading-none reading-hidden">{hiddenNote(section.masked)}</p>
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

export function Sections({ sections }: { sections: Section[] }) {
  if (!sections.some(hasContent)) return <p className="reading-none">Nada preenchido.</p>;
  return sections.map((s, i) => <SectionView key={i} section={s} />);
}
