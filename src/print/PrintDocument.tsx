// O currículo composto para papel A4: cabeçalho com nome, endereço público e
// data do arquivo, depois as seções marcadas. O mesmo componente serve à
// pré-visualização do diálogo e à página que vai para a impressora.

import { formatLattesDate } from '../ui/format.ts';
import type { Profile } from '../ui/profile.ts';
import { QrCode } from '../ui/QrCode.tsx';
import type { Segment } from './abnt.ts';
import {
  languageLine,
  listEntry,
  newestFirst,
  paragraphText,
  professionalAddress,
} from './entries.ts';
import {
  groupLabel,
  type PrintGroup,
  type PrintOptions,
  type PrintSection,
  sectionLabel,
} from './print-model.ts';
import { hasReference, referenceFor } from './references.ts';

interface Props {
  /** Nome em citações do Lattes (NOME-EM-CITACOES-BIBLIOGRAFICAS). */
  citationNames?: string;
  options: PrintOptions;
  outline: PrintSection[];
  profile: Profile;
}

function Reference({ segments }: { segments: Segment[] }) {
  return <>{segments.map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : s.text))}</>;
}

function Group({ group, options }: { group: PrintGroup; options: PrintOptions }) {
  const { english } = options;
  if (group.kind === 'text') {
    const paragraphs = group.items.map((el) => paragraphText(el, english)).filter(Boolean);
    return paragraphs.map((text, i) => (
      <p key={i} className="pd-text">
        {text}
      </p>
    ));
  }
  if (group.kind === 'address') {
    const prof = group.items.find((el) => el.name === 'ENDERECO-PROFISSIONAL');
    return (
      <address className="pd-address">
        {(prof ? professionalAddress(prof) : []).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </address>
    );
  }
  if (group.items.every(hasReference)) {
    return (
      <ol className="pd-references">
        {newestFirst(group.items).map((el, i) => (
          <li key={i}>
            <Reference segments={referenceFor(el, { english, etAl: options.etAl })} />
          </li>
        ))}
      </ol>
    );
  }
  if (group.key === 'IDIOMAS') {
    return (
      <ul className="pd-short">
        {group.items.map((el, i) => {
          const { detail, name } = languageLine(el, english);
          return (
            <li key={i}>
              <span className="pd-term">{name}</span>
              {detail && `: ${detail}.`}
            </li>
          );
        })}
      </ul>
    );
  }
  const entries = newestFirst(group.items).map(listEntry);
  return (
    <ul className={group.kind === 'short' ? 'pd-short' : 'pd-list'}>
      {entries.map((e, i) => (
        <li key={i}>
          {group.kind !== 'short' && (
            <span className="pd-period">
              {e.current && english ? e.period.replace('atual', 'present') : e.period}
            </span>
          )}
          <span className="pd-body">
            <span className="pd-term">{e.title}</span>
            {group.kind === 'short' && e.period && ` (${e.period})`}
            {e.subtitle && <span className="pd-sub">{e.subtitle}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Rodapé das páginas pela regra @page (Chrome 131 em diante desenha as caixas de margem). */
function pageFooterCss(name: string): string {
  const safe = name.replace(/["\\\n]/g, ' ');
  return `@page { @bottom-left { content: "${safe}"; } }`;
}

export function PrintDocument({ citationNames, options, outline, profile }: Props) {
  const { english } = options;
  const date = formatLattesDate(profile.date);
  const url = profile.lattesId ? `lattes.cnpq.br/${profile.lattesId}` : undefined;
  const sections = outline
    .map((s) => ({ ...s, groups: s.groups.filter((g) => options.selected.has(g.id)) }))
    .filter((s) => s.groups.length > 0);
  return (
    <article className="print-doc" lang={english ? 'en' : 'pt-BR'}>
      <style>{pageFooterCss(profile.name)}</style>
      <header className="pd-header">
        {options.qr && profile.lattesId && (
          <QrCode
            className="pd-qr"
            label={english ? 'QR code of the Lattes CV' : 'Código QR do Currículo Lattes'}
            text={`https://lattes.cnpq.br/${profile.lattesId}`}
          />
        )}
        <h1>{profile.name}</h1>
        {citationNames && (
          <p className="pd-meta">
            {english ? 'Citation names' : 'Nome em citações'}: {citationNames}
          </p>
        )}
        <p className="pd-meta">
          {url && (
            <span>
              {english ? 'Lattes CV' : 'Currículo Lattes'}: {url}
            </span>
          )}
          {date && (
            <span>
              {english ? 'File dated' : 'Arquivo de'} {date}
            </span>
          )}
        </p>
      </header>
      {sections.map((s) => {
        // Seção de um grupo só, com o mesmo nome, não repete o título.
        const single = s.groups.length === 1;
        return (
          <section key={s.id} className="pd-section">
            <h2>{single ? groupLabel(s.groups[0]!, english) : sectionLabel(s, english)}</h2>
            {s.groups.map((g) => (
              <div key={g.id} className="pd-group">
                {!single && <h3>{groupLabel(g, english)}</h3>}
                <Group group={g} options={options} />
              </div>
            ))}
          </section>
        );
      })}
    </article>
  );
}
