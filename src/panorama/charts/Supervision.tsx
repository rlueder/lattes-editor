import { committeesByYear, type Period, range, supervisionRows } from '../aggregate.ts';
import type { CvData, Level } from '../model.ts';
import { people } from '../people.ts';
import { rightRound, topRound } from './geometry.ts';
import { Insight, Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  level?: Level;
  now: number;
  period: Period;
}

const W = 760;
const L = 130;
const ROW = 32;

export function Supervision({ cv, level, now, period }: Props) {
  const rows = supervisionRows(cv, period, level);
  const years = [...cv.supervisions, ...cv.committees].flatMap((x) => (x.year ? [x.year] : []));
  const a = Math.max(period.from, Math.min(now, ...years));
  const b = period.to;
  const span = range(a, b);
  const sx = (y: number) => L + ((y - a) / (b + 1 - a)) * (W - L - 6);
  const cell = sx(a + 1) - sx(a);
  const committees = committeesByYear(cv, span);
  const maxC = Math.max(1, ...committees.map((c) => c.items.length));
  const barsTop = rows.length * ROW + 16;
  const H = barsTop + 58;
  const done = cv.supervisions.filter((s) => !s.ongoing).length;
  const ongoing = cv.supervisions.length - done;
  const list = people(cv, { from: 0, to: 9999 });
  const students = list.filter((p) => p.supervisions.length > 0);
  const coauthoring = students.filter((p) => p.productions.length > 0).length;
  return (
    <>
      <Insight>
        <b>{done}</b> {done === 1 ? 'concluída' : 'concluídas'} e <b>{ongoing}</b> em andamento;{' '}
        {coauthoring} de {students.length} pessoas orientadas assinam produções com você.
      </Insight>
      <Legend
        items={[
          { color: 'var(--pano-1)', label: 'Concluída' },
          { color: 'var(--pano-1)', label: 'Em andamento, desde o ano de início', shape: 'ring' },
          { color: 'var(--muted)', label: 'Bancas no ano' },
        ]}
      />
      <svg aria-label="Orientações por nível e bancas por ano" role="img" viewBox={`0 0 ${W} ${H}`}>
        {rows.map((r, i) => {
          const y = i * ROW + ROW / 2;
          const perYear = new Map<number, number>();
          return (
            <g key={r.level}>
              <line className="pano-grid" x1={L} x2={W} y1={y} y2={y} />
              <text className="pano-lane" x="0" y={y + 4}>
                {r.level}
              </text>
              {r.ongoing.map((s, k) => {
                const x0 = sx(Math.max(s.year ?? a, a));
                return (
                  <Mark
                    key={`${s.student}-${s.year}`}
                    label={`${s.student}, ${r.level}, desde ${s.year}`}
                    selection={{ items: [s], label: `${s.student} (${r.level})` }}
                  >
                    <path
                      className="pano-span open"
                      d={rightRound(x0, y - 6 + k * 4, sx(b + 1) - x0 - 4, 12, 6)}
                    />
                  </Mark>
                );
              })}
              {r.done.map((s) => {
                const n = perYear.get(s.year!) ?? 0;
                perYear.set(s.year!, n + 1);
                return (
                  <Mark
                    key={`${s.student}-${s.year}`}
                    label={`${s.student}, ${r.level}, concluída em ${s.year}`}
                    selection={{ items: [s], label: `${s.student} (${r.level})` }}
                  >
                    <circle
                      className="pano-dot fill-1"
                      cx={sx(s.year!) + cell / 2 + n * 14}
                      cy={y}
                      r="6"
                    />
                  </Mark>
                );
              })}
            </g>
          );
        })}
        <text className="pano-lane" x="0" y={barsTop + 20}>
          Bancas
        </text>
        {committees.map(({ items, year }) => {
          const h = (items.length / maxC) * 24;
          const w = Math.min(14, cell - 6);
          return items.length ? (
            <Mark
              key={year}
              label={`${year}: ${items.length} bancas`}
              selection={{ items, label: `Bancas de ${year}`, soon: 'Recorte por ano' }}
            >
              <path
                className="pano-bar-muted"
                d={topRound(sx(year) + (cell - w) / 2, barsTop + 28 - h, w, h, 3)}
              />
            </Mark>
          ) : null;
        })}
        <line className="pano-axis" x1={L} x2={W} y1={barsTop + 28} y2={barsTop + 28} />
        {span.map((y) =>
          span.length < 12 || (y - a) % 2 === 0 ? (
            <text
              key={y}
              className="pano-axis-label"
              textAnchor="middle"
              x={sx(y) + cell / 2}
              y={barsTop + 44}
            >
              {y}
            </text>
          ) : null,
        )}
      </svg>
    </>
  );
}
