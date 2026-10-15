// A lista do gráfico Pessoas: uma seção por papel (orientadores, orientandos,
// coautores, equipe de projeto) e, no fim, as bancas do período, cada uma com
// o ano, o tipo e quem mais participou.

import { committeeKind, committeesByYear, levelBadge, type Period, within } from '../aggregate.ts';
import type { Committee, CvData, Level } from '../model.ts';
import { byRole, type Person, personItems, roleOf, type Tie } from '../people.ts';
import { useChart } from '../use-chart.ts';
import { topRound } from './geometry.ts';
import { Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  level?: Level;
  list: Person[];
  period: Period;
  tie?: Tie;
}

const span = (years: number[]) => {
  if (years.length === 0) return '';
  const a = Math.min(...years);
  const b = Math.max(...years);
  return a === b ? `${a}` : `${a}–${b}`;
};

/** Selos da linha: nível e situação de cada orientação, e os outros laços. */
function badges(p: Person): string[] {
  const out: string[] = [];
  if (roleOf(p) === 'Orientandos')
    for (const s of p.supervisions)
      out.push(levelBadge(s.level), s.ongoing ? 'em andamento' : 'concluída');
  if (p.committees.length)
    out.push(p.committees.length > 1 ? `banca ×${p.committees.length}` : 'banca');
  if (p.projects.length && roleOf(p) !== 'Projetos') out.push('projeto');
  return out;
}

function PersonRow({ max, p }: { max: number; p: Person }) {
  const { pick } = useChart();
  return (
    <li>
      <button
        className="pano-row"
        type="button"
        onClick={() =>
          pick({
            items: personItems(p),
            label: p.name,
            person: p.name,
          })
        }
      >
        <span className="pano-row-name">
          {p.name}
          <small>{span(p.years)}</small>
          {badges(p).map((t, i) => (
            <span key={`${t}-${i}`} className="tag pano-tie">
              {t}
            </span>
          ))}
        </span>
        <span aria-hidden="true" className="pano-row-bar">
          {p.productions.length > 0 && (
            <i style={{ width: `${(p.productions.length / max) * 100}%` }} />
          )}
        </span>
        <span className="pano-row-n">{p.productions.length || ''}</span>
      </button>
    </li>
  );
}

/** Faixa pequena de bancas por ano, no cabeçalho da seção. */
function CommitteeStrip({ cv, period }: { cv: CvData; period: Period }) {
  const years = committeesByYear(cv, period);
  if (years.length < 2) return null;
  const max = Math.max(1, ...years.map((y) => y.items.length));
  const W = years.length * 14;
  return (
    <svg
      aria-label="Bancas por ano"
      className="pano-strip"
      role="img"
      style={{ width: W + 60 }}
      viewBox={`0 0 ${W + 60} 26`}
    >
      <text className="pano-axis-label" textAnchor="end" x="26" y="20">
        {years[0]!.year}
      </text>
      {years.map((y, i) =>
        y.items.length ? (
          <Mark
            key={y.year}
            label={`${y.year}: ${y.items.length} ${y.items.length === 1 ? 'banca' : 'bancas'}`}
            selection={{
              items: y.items,
              label: `Bancas de ${y.year}`,
              years: { from: y.year, to: y.year },
            }}
          >
            <path
              className="pano-bar-1"
              d={topRound(
                30 + i * 14,
                22 - (y.items.length / max) * 18,
                10,
                (y.items.length / max) * 18,
                0,
              )}
            />
          </Mark>
        ) : (
          <rect key={y.year} className="pano-empty" height="1" width="10" x={30 + i * 14} y="21" />
        ),
      )}
      <text className="pano-axis-label" x={W + 34} y="20">
        {years.at(-1)!.year}
      </text>
    </svg>
  );
}

function CommitteeRow({ c, cv }: { c: Committee; cv: CvData }) {
  const { pick } = useChart();
  const others = c.members.filter((m) => m.full && !cv.isOwner(m.full, m.cit)).map((m) => m.full);
  return (
    <li>
      <button
        className="pano-row pano-committee"
        type="button"
        onClick={() => pick({ items: [c], label: c.title })}
      >
        <span className="pano-committee-year">{c.year ?? '–'}</span>
        <span className="pano-row-name">
          {c.candidate || c.title}
          <span className="tag pano-tie">{committeeKind(c.el.name)}</span>
          {others.length > 0 && <small>com {others.join(', ')}</small>}
        </span>
      </button>
    </li>
  );
}

export function PeopleList({ cv, level, list, period, tie }: Props) {
  const max = Math.max(1, ...list.map((p) => p.productions.length));
  const groups = byRole(list)
    .map((g) =>
      g.role === 'Orientandos' && level
        ? { ...g, people: g.people.filter((p) => p.supervisions.some((s) => s.level === level)) }
        : g,
    )
    .filter((g) => g.people.length > 0);
  const committees =
    !tie || tie === 'banca'
      ? within(cv.committees, period).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      : [];
  if (groups.length === 0 && committees.length === 0)
    return <p className="pano-note">Ninguém com esse laço no período.</p>;
  return (
    <ul className="pano-check-groups">
      {groups.map((g) => (
        <li key={g.role} className="pano-check-group">
          <h3 className="pano-group-label">{g.role}</h3>
          <ul className="pano-rows">
            {g.people.slice(0, 20).map((p) => (
              <PersonRow key={p.key} max={max} p={p} />
            ))}
          </ul>
        </li>
      ))}
      {committees.length > 0 && (
        <li className="pano-check-group">
          <div className="pano-group-head">
            <h3 className="pano-group-label">Bancas</h3>
            <CommitteeStrip cv={cv} period={period} />
          </div>
          <ul className="pano-rows">
            {committees.map((c, i) => (
              <CommitteeRow key={`${c.title}-${c.year}-${i}`} c={c} cv={cv} />
            ))}
          </ul>
        </li>
      )}
    </ul>
  );
}
