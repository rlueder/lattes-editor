import { careerBands, type Period, productionsByYear } from '../aggregate.ts';
import { type CvData, PRODUCTION_GROUPS, type ProductionGroup } from '../model.ts';
import { SERIES, topRound } from './geometry.ts';
import { HatchDefs, Insight, Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  groups: ProductionGroup[];
  now: number;
  period: Period;
}

const W = 760;
const L = 26;
const TOP = 16;
const CH = 190;
const BAND_TOP = TOP + CH + 26;
const BAND_ROW = 14;

export function Productions({ cv, groups, now, period }: Props) {
  const { bars, gaps, max: rawMax } = productionsByYear(cv, period, now, groups);
  const { bands, rows } = careerBands(cv, period);
  const max = Math.max(2, rawMax);
  const step = max <= 6 ? 1 : max <= 12 ? 2 : 5;
  const y = (v: number) => TOP + CH - (v / max) * CH;
  const n = Math.max(1, bars.length);
  const bw = (W - L) / n;
  const w = Math.min(30, bw * 0.62);
  const first = bars[0]?.year ?? period.from;
  const sx = (year: number) => L + (year - first) * bw;
  const H = BAND_TOP + rows * BAND_ROW + 4;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const shown = PRODUCTION_GROUPS.map((g, i) => ({ ...g, color: SERIES[i]! })).filter(
    (g) => groups.includes(g.key) && cv.productions.some((p) => p.group === g.key),
  );
  const inStudy = gaps.filter((yr) =>
    cv.degrees.some(
      (d) => /MESTRADO|DOUTORADO/.test(d.level) && d.start && d.start <= yr && (d.end ?? now) >= yr,
    ),
  );

  return (
    <>
      {gaps.length > 0 && (
        <Insight>
          <b>
            {gaps.length} {gaps.length === 1 ? 'ano' : 'anos'} sem nenhuma produção
          </b>{' '}
          ({gaps.join(', ')}). O ano corrente não conta.
          {inStudy.length > 1 &&
            ' Vários caem no mestrado ou no doutorado: vale conferir se faltam resumos de congresso desses anos.'}
        </Insight>
      )}
      <Legend
        items={[
          ...shown.map((g) => ({ color: g.color, label: g.label })),
          { color: 'var(--muted)', label: 'Ano sem nenhuma produção', shape: 'hatch' as const },
        ]}
      />
      <svg aria-label="Produções por ano, por tipo" role="img" viewBox={`0 0 ${W} ${H}`}>
        <HatchDefs />
        {ticks.map((v) => (
          <g key={v}>
            <line className="pano-grid" x1={L} x2={W} y1={y(v)} y2={y(v)} />
            <text className="pano-axis-label" textAnchor="end" x={L - 8} y={y(v) + 4}>
              {v}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = L + i * bw + (bw - w) / 2;
          const parts = shown.filter((g) => b.byGroup[g.key].length > 0);
          let acc = 0;
          return (
            <g key={b.year}>
              {parts.map((g, j) => {
                const items = b.byGroup[g.key];
                const y0 = y(acc);
                acc += items.length;
                const top = y(acc);
                const last = j === parts.length - 1;
                const h = y0 - top - (last ? 0 : 2);
                return (
                  <Mark
                    key={g.key}
                    label={`${b.year}, ${g.label}: ${items.length}`}
                    selection={{ items, label: `${g.label} de ${b.year}`, soon: 'Recorte por ano' }}
                  >
                    {last ? (
                      <path d={topRound(x, top, w, h)} fill={g.color} />
                    ) : (
                      <rect fill={g.color} height={h} width={w} x={x} y={top} />
                    )}
                  </Mark>
                );
              })}
              {b.total > 0 && (
                <text className="pano-value" textAnchor="middle" x={x + w / 2} y={y(b.total) - 5}>
                  {b.total}
                </text>
              )}
              {gaps.includes(b.year) && (
                <Mark
                  label={`${b.year}: nenhuma produção`}
                  selection={{
                    items: [],
                    label: `${b.year}: nenhuma produção`,
                    soon: 'Procurar no OpenAlex o que falta neste ano',
                  }}
                >
                  <rect
                    fill="url(#pano-hatch)"
                    height={y(0) - y(max * 0.2)}
                    rx="3"
                    width={w}
                    x={x}
                    y={y(max * 0.2)}
                  />
                </Mark>
              )}
              <text className="pano-axis-label" textAnchor="middle" x={x + w / 2} y={TOP + CH + 15}>
                {n > 14 ? String(b.year).slice(2) : b.year}
              </text>
            </g>
          );
        })}
        <line className="pano-axis" x1={L} x2={W} y1={y(0)} y2={y(0)} />
        {bands.map((band) => {
          const x0 = sx(band.start) + 2;
          const width = Math.max(4, sx(band.end + 1) - sx(band.start) - 4);
          const room = Math.floor((width - 10) / 5.4);
          const text =
            band.label.length > room
              ? `${band.label.slice(0, Math.max(0, room - 1))}…`
              : band.label;
          return (
            <Mark
              key={`${band.label}-${band.start}`}
              label={`${band.label}, ${band.item.start}–${band.item.end ?? 'atual'}`}
              selection={{ items: [band.item], label: band.label }}
            >
              <rect
                className="pano-band"
                height="10"
                rx="5"
                width={width}
                x={x0}
                y={BAND_TOP + band.row * BAND_ROW}
              />
              {room > 2 && (
                <text className="pano-band-label" x={x0 + 6} y={BAND_TOP + band.row * BAND_ROW + 8}>
                  {text}
                </text>
              )}
            </Mark>
          );
        })}
      </svg>
      <p className="pano-note">
        A faixa cinza embaixo mostra mestrado, doutorado e vínculos, para ler a produção contra a
        fase da carreira.
      </p>
    </>
  );
}
