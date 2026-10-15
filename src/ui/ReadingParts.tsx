// Peças do modo de leitura: linhas de texto, rótulos e valores e seções,
// compostas a partir de reading-layout.ts. Servem à leitura e à prévia no topo
// do bloco em edição, que é a mesma composição com os rascunhos dos campos.

import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { attributeLabelIn } from '../labels/labels.ts';
import { getAttr } from '../model/xml.ts';
import { parseEmails, parseSocial } from './contacts.ts';
import { isEnglishAttr } from './form-order.ts';
import { isDoiAttr, linkHref, linkPieces, shortUrl } from './link-fields.ts';
import {
  actionWord,
  collapsedText,
  mustExpand,
  rememberedNested,
  rememberNested,
  startsCollapsed,
  useNestedContext,
} from './nested-collapse.ts';
import { useHideSensitive } from './privacy.ts';
import { cellSpan, curlyQuotes, hiddenNote, paragraphs } from './reading.ts';
import {
  type Line,
  lineVisible,
  type NestedGroup,
  type Part,
  partText,
  type Section,
  shownParts,
} from './reading-layout.ts';

/** Link para fora: aba nova no navegador; no app, o navegador do sistema (external-links.ts). */
export function ExternalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a href={href} rel="noreferrer noopener" target="_blank">
      {children}
    </a>
  );
}

/** Texto corrido com os endereços e e-mails que ele traz como links. */
export function LinkedText({ text }: { text: string }) {
  return linkPieces(text).map((p, i) =>
    p.href ? (
      <ExternalLink key={i} href={p.href}>
        {p.text}
      </ExternalLink>
    ) : (
      p.text
    ),
  );
}

/**
 * O valor lido de um pedaço. DOI, endereço, ORCID e e-mail viram link
 * (link-fields.ts); o texto é o guardado, com o endereço encurtado.
 */
function PartText({ part, text }: { part: Part; text: string }) {
  const href = linkHref(part.attr, text);
  if (href) {
    const shown = href.startsWith('http') && !isDoiAttr(part.attr) ? shortUrl(text) : text;
    return <ExternalLink href={href}>{shown}</ExternalLink>;
  }
  if (part.attr === 'ELETRONICO' || part.attr === 'REDE-SOCIAL') return <Contacts part={part} />;
  return text;
}

/**
 * Contatos que a exportação traz num texto só (contacts.ts): cada e-mail com
 * o nome do campo do Lattes e o endereço como link de e-mail; cada rede pelo
 * nome, como link. O código interno da rede nunca aparece. Sem nada que se
 * leia, o texto como veio, com os endereços como link.
 */
function Contacts({ part }: { part: Part }) {
  const hideSensitive = useHideSensitive();
  const raw = getAttr(part.el, part.attr) ?? '';
  if (part.attr === 'ELETRONICO') {
    const all = parseEmails(raw);
    if (all.length === 0) return <LinkedText text={raw} />;
    // O e-mail alternativo é o do bloco residencial, que o Lattes deixa
    // privado: o modo de privacidade o esconde, como o endereço residencial.
    const emails = hideSensitive ? all.filter((c) => c.address !== 'E-mail alternativo') : all;
    const masked = all.length - emails.length;
    return (
      <span className="reading-contacts">
        {masked > 0 && <span className="reading-none">{hiddenNote(masked)}</span>}
        {emails.map((c) => (
          <span key={c.email} className="reading-contact">
            {c.address && <span className="reading-contact-kind">{c.address}: </span>}
            <ExternalLink href={`mailto:${c.email}`}>{c.email}</ExternalLink>
          </span>
        ))}
      </span>
    );
  }
  const networks = parseSocial(raw);
  if (networks.length === 0) return <LinkedText text={raw} />;
  return (
    <span className="reading-contacts">
      {networks.map((c) => (
        <span key={c.url} className="reading-contact">
          <ExternalLink href={c.url}>{c.name}</ExternalLink>
        </span>
      ))}
    </span>
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
            {/* Versão em inglês com o idioma certo: hifeniza em inglês. */}
            <dd lang={isEnglishAttr(p.attr) ? 'en' : undefined}>
              <PartText part={p} text={partText(p)} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function hasContent(s: Section): boolean {
  return (
    s.hidden ||
    s.masked > 0 ||
    s.rows.length > 0 ||
    s.lines.some(lineVisible) ||
    s.nested.some((g) => g.items.some(hasContent))
  );
}

/**
 * As listas de filhos de um registro (vínculos, integrantes, participantes):
 * um rótulo curto e cada item como um registro pequeno, recuado, com o
 * período antes do título. Do segundo nível para baixo, a lista começa
 * fechada numa linha de texto que abre no lugar (nested-collapse.ts).
 */
function NestedList({ group, level }: { group: NestedGroup; level: number }) {
  const items = group.items.filter(hasContent);
  const { focusPart, query, scope } = useNestedContext();
  const collapsible = startsCollapsed(level);
  const [open, setOpen] = useState(
    () => !collapsible || (rememberedNested(scope, group.id) ?? false),
  );
  const bodyId = useId();
  const bodyRef = useRef<HTMLUListElement>(null);
  const forced = collapsible && !open && mustExpand(group, focusPart, query);
  const shown = open || forced;
  // Fechada, a lista fica no documento, escondida até a busca do navegador
  // (⌘F) achar algo nela: hidden="until-found". O React só escreve hidden
  // vazio; o valor muda antes da pintura. Onde não há until-found, vale como
  // hidden.
  useLayoutEffect(() => {
    if (!shown) bodyRef.current?.setAttribute('hidden', 'until-found');
  }, [shown]);
  // A busca do navegador achou texto na lista fechada: ela abre.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || shown) return;
    const onMatch = () => {
      rememberNested(scope, group.id, true);
      setOpen(true);
    };
    body.addEventListener('beforematch', onMatch);
    return () => body.removeEventListener('beforematch', onMatch);
  }, [shown, scope, group.id]);
  if (items.length === 0) return null;
  const list = (
    <ul ref={bodyRef} hidden={!shown} id={bodyId}>
      {items.map((item, i) => (
        <li key={i}>
          {item.when && lineVisible(item.when) && (
            <p className="rl rl-meta rl-nested-when">
              <LineView line={item.when} />
            </p>
          )}
          <SectionView level={level} section={{ ...item, when: undefined }} />
        </li>
      ))}
    </ul>
  );
  if (!collapsible) {
    return (
      <div className="reading-nested">
        <p className="reading-nested-label">{group.label}</p>
        {list}
      </div>
    );
  }
  const text = shown ? group.label : collapsedText(group, items);
  const hasTitle = text.startsWith(`${group.label}: `);
  return (
    <div className={`reading-nested is-collapsible${shown ? ' is-open' : ''}`}>
      {/* Botão de verdade: Enter e espaço abrem, e o clique não abre a edição do bloco. */}
      <button
        aria-controls={bodyId}
        aria-expanded={shown}
        className="reading-nested-toggle"
        type="button"
        onClick={() => {
          rememberNested(scope, group.id, !shown);
          setOpen(!shown);
        }}
      >
        <span className="reading-nested-text">{text}</span>
        <span className="reading-nested-action">
          {' · '}
          <span className="reading-nested-verb">{actionWord(shown, items, hasTitle)}</span>
        </span>
      </button>
      {list}
    </div>
  );
}

/**
 * Uma seção do bloco: título, linhas e rótulos. `level` conta as listas por
 * cima dela: 0 no registro, 1 num item de uma lista dele, e assim por diante.
 */
export function SectionView({ level = 0, section }: { level?: number; section: Section }) {
  if (!hasContent(section)) return null;
  const body = section.hidden ? (
    <p className="reading-none">Oculto pelo modo de privacidade.</p>
  ) : (
    <>
      {section.lines.map((line, i) => (
        <LineView key={i} line={line} />
      ))}
      <Rows parts={section.rows} quiet={section.quietRows} />
      {section.nested.map((g, i) => (
        <NestedList key={i} group={g} level={level + 1} />
      ))}
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
