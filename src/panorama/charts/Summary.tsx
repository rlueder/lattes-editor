import { currentRole, type Period, productionsByYear, summaryTiles } from '../aggregate.ts';
import type { CvData } from '../model.ts';
import { useChart } from '../use-chart.ts';
import { topRound } from './geometry.ts';
import { Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  now: number;
  period: Period;
  /** O período cobre todos os anos: o editor mostra a lista inteira sem recorte. */
  whole: boolean;
}

export function Summary({ cv, now, period, whole }: Props) {
  const { pick } = useChart();
  const { doctorate, position } = currentRole(cv);
  const area = cv.areas[0];
  const role = [
    position && [position.title, position.inst].filter(Boolean).join(', '),
    doctorate && `Doutorado concluído em ${doctorate}`,
    area && [area.area, area.sub].filter(Boolean).join(', '),
  ].filter(Boolean);
  const tiles = summaryTiles(cv, period);
  const { bars, max } = productionsByYear(cv, period, now);
  const W = 760;
  const H = 56;
  const bw = W / Math.max(1, bars.length);
  return (
    <div className="pano-summary">
      <div>
        <p className="pano-who">{cv.name}</p>
        {role.length > 0 && <p className="pano-who-sub">{role.join('. ')}.</p>}
      </div>
      <div className="pano-tiles">
        {tiles.map((t) => (
          <button
            key={t.key}
            className={t.items.length ? 'pano-tile' : 'pano-tile zero'}
            type="button"
            onClick={() =>
              pick({
                items: t.items,
                label: t.label,
                // Em andamento conta todas, sem recorte de anos.
                years: whole || t.key === 'orientacoes-andamento' ? undefined : period,
              })
            }
          >
            <span className="pano-tile-n">{t.items.length}</span>
            <span className="pano-tile-l">{t.label}</span>
          </button>
        ))}
      </div>
      <figure className="pano-figure">
        <figcaption className="pano-caption">
          Produções por ano, de {bars[0]?.year ?? period.from} a {period.to}
        </figcaption>
        <svg aria-label="Produções por ano" role="img" viewBox={`0 0 ${W} ${H}`}>
          {bars.map((b, i) => {
            const h = max ? (b.total / max) * (H - 18) : 0;
            const x = i * bw + 1;
            const w = Math.max(2, bw - 4);
            const items = Object.values(b.byGroup).flat();
            return b.total ? (
              <Mark
                key={b.year}
                label={`${b.year}: ${b.total} produções`}
                selection={{
                  items,
                  label: `Produções de ${b.year}`,
                  years: { from: b.year, to: b.year },
                }}
              >
                <path className="pano-bar-1" d={topRound(x, H - 16 - h, w, h, 2)} />
              </Mark>
            ) : (
              <rect key={b.year} className="pano-empty" height="1" width={w} x={x} y={H - 17} />
            );
          })}
          <text className="pano-axis-label" x="0" y={H - 2}>
            {bars[0]?.year}
          </text>
          <text className="pano-axis-label" textAnchor="end" x={W} y={H - 2}>
            {bars.at(-1)?.year}
          </text>
        </svg>
      </figure>
    </div>
  );
}
