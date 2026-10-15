import { type Period, supervisionFacts, within } from '../aggregate.ts';
import type { CvData, Level } from '../model.ts';
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
import { Segmented } from '../Segmented.tsx';
import { plural } from './geometry.ts';
import { PeopleList } from './PeopleList.tsx';
import { Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  /** Nível das orientações: filtra a seção Orientandos e as contagens. */
  level?: Level;
  period: Period;
  tie?: Tie;
  view: View;
  onView: (view: View) => void;
}

type View = 'lista' | 'rede';

const VIEWS = [
  { label: 'Lista', value: 'lista' },
  { label: 'Rede', value: 'rede' },
] as const;

export function People({ cv, level, onView, period, tie, view }: Props) {
  const all = people(cv, period);
  const stats = collaboration(cv, period, all);
  const list = tie ? all.filter((p) => hasTie(p, tie)) : all;
  const avg = stats.avgAuthors.toFixed(1).replace('.', ',');
  const supervision = supervisionFacts(cv, period, level);
  const committees = within(cv.committees, period).length;
  return (
    <>
      <div className="pano-chart-head">
        <ul className="pano-facts">
          <li>
            <b>
              {stats.withAuthors - stats.solo} de {stats.withAuthors}
            </b>{' '}
            produções em coautoria
          </li>
          <li>
            <b>{avg}</b> autores por produção
          </li>
          {stats.students > 0 && (
            <li>
              <b>{stats.studentsCoauthoring}</b>{' '}
              {stats.studentsCoauthoring === 1 ? 'orientando coautor' : 'orientandos coautores'}
            </li>
          )}
        </ul>
      </div>
      {(supervision.length > 0 || committees > 0) && (
        <ul className="pano-facts secondary">
          {supervision.map((f) => (
            <li key={f}>{f}</li>
          ))}
          {committees > 0 && <li>{committees === 1 ? '1 banca' : `${committees} bancas`}</li>}
        </ul>
      )}
      <div className="pano-view-switch">
        <Segmented label="Vista" options={VIEWS} value={view} onChange={onView} />
      </div>
      {view === 'lista' ? (
        <PeopleList cv={cv} level={level} list={list} period={period} tie={tie} />
      ) : (
        <Network cv={cv} list={list} period={period} />
      )}
    </>
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
                items: personItems(n),
                label: n.name,
                person: n.name,
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
        Tamanho do círculo: produções em comum. Curvas: coautores que assinaram juntos.
      </p>
    </>
  );
}
