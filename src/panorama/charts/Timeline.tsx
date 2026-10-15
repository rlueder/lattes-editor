import type { Period } from '../aggregate.ts';
import type { CvData } from '../model.ts';
import { LANES, pack, timelineEntries } from '../timeline.ts';
import { Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  now: number;
  period: Period;
}

const W = 760;
const L = 92;
const ROW = 22;
const CHAR = 5.9;

export function Timeline({ cv, now, period }: Props) {
  const entries = timelineEntries(cv);
  if (entries.length === 0) return <p className="pano-note">Nada com período neste currículo.</p>;
  const a = entries[0]!.start;
  const span = now + 1 - a;
  const sx = (year: number) => L + ((year - a) / span) * (W - L - 4);
  const lanes = LANES.filter((l) => entries.some((e) => e.lane === l));
  let top = 6;
  const layout = lanes.map((lane) => {
    const list = entries.filter((e) => e.lane === lane);
    const geo = list.map((e) => {
      const x0 = sx(e.start);
      const x1 = e.point ? x0 + 14 : Math.max(sx((e.end ?? now) + 1), x0 + 6);
      const inside = !e.point && (x1 - x0 - 12) / CHAR >= 10;
      const labelEnd = inside ? x1 : x1 + 6 + Math.min(e.label.length, 44) * CHAR;
      const flip = labelEnd > W && e.point;
      return { e, extent: flip ? x1 : labelEnd, flip, inside, x0, x1 };
    });
    const rows = pack(
      geo,
      (g) => (g.flip ? g.x0 - 6 - Math.min(g.e.label.length, 44) * CHAR : g.x0),
      (g) => g.extent,
    );
    const block = { geo, lane, rows, top };
    top += Math.max(1, ...rows.map((r) => r + 1)) * ROW + 12;
    return block;
  });
  const H = top + 16;
  const step = span > 20 ? 5 : 2;
  const ticks: number[] = [];
  for (let t = a; t <= now; t++) if ((t - a) % step === 0 || t === now) ticks.push(t);
  const shadeFrom = sx(Math.max(a, period.from));
  const shadeTo = sx(Math.min(now, period.to) + 1);

  return (
    <>
      <Legend
        items={[
          { color: 'var(--pano-1)', label: 'Concluído' },
          { color: 'var(--pano-1)', label: 'Em andamento, até hoje', shape: 'ring' },
          { color: 'var(--pano-1)', label: 'Ponto: orientação concluída ou prêmio' },
        ]}
      />
      <svg aria-label="Linha do tempo da carreira" role="img" viewBox={`0 0 ${W} ${H}`}>
        {shadeTo > shadeFrom && (
          <rect
            className="pano-shade"
            height={H - 16}
            width={shadeTo - shadeFrom}
            x={shadeFrom}
            y="0"
          />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line className="pano-grid faint" x1={sx(t)} x2={sx(t)} y1="0" y2={H - 16} />
            <text className="pano-axis-label" x={sx(t) + 2} y={H - 3}>
              {t}
            </text>
          </g>
        ))}
        {layout.map(({ geo, lane, rows, top: y0 }) => (
          <g key={lane}>
            <line className="pano-grid" x1="0" x2={W} y1={y0 - 4} y2={y0 - 4} />
            <text className="pano-lane" x="0" y={y0 + 13}>
              {lane}
            </text>
            {geo.map((g, i) => {
              const y = y0 + rows[i]! * ROW;
              const { e } = g;
              const period = e.point ? `${e.start}` : `${e.start}–${e.end ?? 'atual'}`;
              const short = e.label.length > 44 ? `${e.label.slice(0, 43)}…` : e.label;
              const room = Math.floor((g.x1 - g.x0 - 12) / CHAR);
              return (
                <Mark
                  key={`${e.label}-${e.start}`}
                  label={`${e.label}, ${period}`}
                  selection={{ items: [e.item], label: e.label }}
                  tip={
                    <>
                      <b>{e.label}</b>
                      <br />
                      {period}
                    </>
                  }
                >
                  {e.point ? (
                    <path className="pano-diamond" d={`M${g.x0 + 6},${y + 3} l6,6 l-6,6 l-6,-6z`} />
                  ) : (
                    <rect
                      className={e.end ? 'pano-span done' : 'pano-span open'}
                      height="14"
                      rx="4"
                      width={g.x1 - g.x0 - 2}
                      x={g.x0 + 1}
                      y={y + 2}
                    />
                  )}
                  {g.inside ? (
                    <text
                      className={e.end ? 'pano-span-label on-fill' : 'pano-span-label'}
                      x={g.x0 + 7}
                      y={y + 13}
                    >
                      {e.label.length > room ? `${e.label.slice(0, room - 1)}…` : e.label}
                    </text>
                  ) : (
                    <text
                      className="pano-span-label"
                      textAnchor={g.flip ? 'end' : 'start'}
                      x={g.flip ? g.x0 - 2 : g.x1 + 5}
                      y={y + 13}
                    >
                      {short}
                    </text>
                  )}
                </Mark>
              );
            })}
          </g>
        ))}
      </svg>
      <p className="pano-note">O fundo azul marca o período escolhido no painel.</p>
    </>
  );
}
