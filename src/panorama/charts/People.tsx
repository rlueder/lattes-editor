import type { Period } from '../aggregate.ts';
import type { CvData } from '../model.ts';
import {
  coauthorEdges,
  collaboration,
  hasTie,
  people,
  type Person,
  personItems,
  shortName,
  type Tie,
} from '../people.ts';
import { useChart } from '../use-chart.ts';
import { plural } from './geometry.ts';
import { Insight, Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  period: Period;
  tie?: Tie;
  view: 'lista' | 'rede';
}

const span = (years: number[]) => {
  if (years.length === 0) return '';
  const a = Math.min(...years);
  const b = Math.max(...years);
  return a === b ? `${a}` : `${a}–${b}`;
};

function tags(p: Person): string[] {
  const out: string[] = [];
  if (p.supervisions.length)
    out.push(p.supervisions.some((s) => s.ongoing) ? 'orientando(a)' : 'ex-orientando(a)');
  if (p.degrees.length) out.push('orientou você');
  if (p.committees.length) out.push(`banca ×${p.committees.length}`);
  if (p.projects.length) out.push('projeto');
  return out;
}

export function People({ cv, period, tie, view }: Props) {
  const all = people(cv, period);
  const stats = collaboration(cv, period, all);
  const list = tie ? all.filter((p) => hasTie(p, tie)) : all;
  const avg = stats.avgAuthors.toFixed(1).replace('.', ',');
  return (
    <>
      <Insight>
        <b>
          {stats.withAuthors - stats.solo} de {stats.withAuthors}
        </b>{' '}
        produções em colaboração, {stats.solo} sem coautor; média de {avg} autores.
        {stats.students > 0 &&
          ` ${stats.studentsCoauthoring} de ${plural(stats.students, 'pessoa orientada assina', 'pessoas orientadas assinam')} produções com você.`}
      </Insight>
      {view === 'lista' ? (
        <PeopleList list={list} />
      ) : (
        <Network cv={cv} list={list} period={period} />
      )}
    </>
  );
}

function PeopleList({ list }: { list: Person[] }) {
  const { pick } = useChart();
  const shown = list.slice(0, 20);
  const max = Math.max(1, ...shown.map((p) => p.productions.length));
  if (shown.length === 0) return <p className="pano-note">Ninguém com esse laço no período.</p>;
  return (
    <ul className="pano-rows">
      {shown.map((p) => (
        <li key={p.key}>
          <button
            className="pano-row"
            type="button"
            onClick={() =>
              pick({
                items: personItems(p),
                label: p.name,
                person: p.name,
                soon: 'A pessoa em todas as seções',
              })
            }
          >
            <span className="pano-row-name">
              {p.name}
              <small>{span(p.years)}</small>
              {tags(p).map((t) => (
                <span key={t} className="pano-tag">
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
      ))}
    </ul>
  );
}

function Network({ cv, list, period }: { cv: CvData; list: Person[]; period: Period }) {
  const nodes = list.filter((p) => p.productions.length > 0).slice(0, 18);
  if (nodes.length === 0) return <p className="pano-note">Nenhuma coautoria no período.</p>;
  const W = 760;
  const H = 420;
  const cx = W / 2;
  const cy = H / 2;
  const R = 150;
  const pos = new Map(
    nodes.map((n, i) => {
      const ang = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      return [n.key, { ang, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) }];
    }),
  );
  const edges = coauthorEdges(cv, period, new Set(nodes.map((n) => n.key)));
  return (
    <>
      <Legend
        items={[
          { color: 'var(--pano-1)', label: 'Coautor(a)' },
          { color: 'var(--pano-2)', label: 'Coautor(a) que você orienta ou orientou' },
        ]}
      />
      <svg aria-label="Rede de coautoria" role="img" viewBox={`0 0 ${W} ${H}`}>
        {nodes.map((n) => {
          const p = pos.get(n.key)!;
          return (
            <line
              key={n.key}
              className="pano-spoke"
              strokeWidth={1 + n.productions.length * 0.7}
              x1={cx}
              x2={p.x}
              y1={cy}
              y2={p.y}
            />
          );
        })}
        {edges.map((e) => {
          const a = pos.get(e.a)!;
          const b = pos.get(e.b)!;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <path
              key={`${e.a}|${e.b}`}
              className="pano-edge"
              d={`M${a.x},${a.y} Q${mx + (cx - mx) * 0.45},${my + (cy - my) * 0.45} ${b.x},${b.y}`}
              strokeWidth={0.8 + e.items.length}
            />
          );
        })}
        <circle className="pano-ego" cx={cx} cy={cy} r="15" />
        <text className="pano-lane" textAnchor="middle" x={cx} y={cy + 32}>
          você
        </text>
        {nodes.map((n) => {
          const p = pos.get(n.key)!;
          const r = 6 + Math.sqrt(n.productions.length) * 4;
          const right = Math.cos(p.ang) >= -0.01;
          return (
            <Mark
              key={n.key}
              label={`${n.name}: ${plural(n.productions.length, 'produção', 'produções')} juntos`}
              selection={{
                items: n.productions,
                label: `Coautoria com ${n.name}`,
                person: n.name,
                soon: 'Recorte por coautor',
              }}
            >
              <circle
                className={n.supervisions.length ? 'pano-node student' : 'pano-node'}
                cx={p.x}
                cy={p.y}
                r={r}
              />
              <text
                className="pano-lane"
                textAnchor={right ? 'start' : 'end'}
                x={p.x + (right ? r + 6 : -r - 6)}
                y={p.y + 4}
              >
                {shortName(n.name)}
              </text>
            </Mark>
          );
        })}
      </svg>
      <p className="pano-note">
        Raio do nó: produções em comum. As curvas ligam coautores que assinaram juntos, o que mostra
        grupos dentro da rede.
      </p>
    </>
  );
}
