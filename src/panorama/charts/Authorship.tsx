import { authorship, type Period, POSITIONS, range } from '../aggregate.ts';
import { type CvData, PRODUCTION_GROUPS, type ProductionGroup } from '../model.ts';
import { SERIES } from './geometry.ts';
import { Insight, Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  groups: ProductionGroup[];
  period: Period;
}

const W = 760;
const L = 100;
const ROW = 40;

export function Authorship({ cv, groups, period }: Props) {
  const points = authorship(cv, period, groups);
  if (points.length === 0)
    return <p className="pano-note">Nenhuma produção com autores no período.</p>;
  const years = range(Math.min(...points.map((p) => p.item.year!)), period.to);
  const bw = (W - L) / years.length;
  const H = POSITIONS.length * ROW + 24;
  const color = (g: ProductionGroup) => SERIES[PRODUCTION_GROUPS.findIndex((x) => x.key === g)]!;
  const count = (i: number) => points.filter((p) => p.position === i).length;
  const seen = new Map<string, number>();
  return (
    <>
      <Insight>
        Primeira posição ou autoria única em <b>{count(0) + count(1)}</b> de {points.length}{' '}
        produções; última posição em <b>{count(3)}</b>.
      </Insight>
      <Legend
        items={PRODUCTION_GROUPS.map((g, i) => ({ color: SERIES[i]!, label: g.label })).filter(
          (_, i) => points.some((p) => p.item.group === PRODUCTION_GROUPS[i]!.key),
        )}
      />
      <svg aria-label="Posição na lista de autores, por ano" role="img" viewBox={`0 0 ${W} ${H}`}>
        {POSITIONS.map((label, i) => (
          <g key={label}>
            <line
              className="pano-grid"
              x1={L}
              x2={W}
              y1={i * ROW + ROW / 2}
              y2={i * ROW + ROW / 2}
            />
            <text className="pano-lane" x="0" y={i * ROW + ROW / 2 + 4}>
              {label}
            </text>
          </g>
        ))}
        {years.map((y, j) =>
          years.length <= 14 || j % 2 === 0 ? (
            <text
              key={y}
              className="pano-axis-label"
              textAnchor="middle"
              x={L + j * bw + bw / 2}
              y={H - 4}
            >
              {years.length > 10 ? String(y).slice(2) : y}
            </text>
          ) : null,
        )}
        {points.map(({ item, position }) => {
          const key = `${item.year}|${position}`;
          const n = seen.get(key) ?? 0;
          seen.set(key, n + 1);
          const offset = n === 0 ? 0 : (n % 2 ? 13 : -13) * Math.ceil(n / 2);
          const cx = L + (item.year! - years[0]!) * bw + bw / 2 + offset;
          const cy = position * ROW + ROW / 2;
          const pos = POSITIONS[position]!.toLowerCase();
          return (
            <Mark
              key={`${item.title}-${item.year}`}
              label={`${item.year}, ${pos} de ${item.authors.length}: ${item.title}`}
              selection={{ items: [item], label: item.title }}
              tip={
                <>
                  <b>{item.year}</b> · {pos} de {item.authors.length}
                  <br />
                  {item.title}
                </>
              }
            >
              <circle className="pano-dot" cx={cx} cy={cy} fill={color(item.group)} r="6" />
            </Mark>
          );
        })}
      </svg>
      <p className="pano-note">
        Em algumas áreas a ordem dos autores é alfabética, e o XML não diz qual é o caso.
      </p>
    </>
  );
}
