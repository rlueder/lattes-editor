import type { Period } from '../aggregate.ts';
import type { CvData, PanoramaItem } from '../model.ts';
import { type Bucket, venues } from '../topics.ts';
import { useChart } from '../use-chart.ts';
import { SERIES } from './geometry.ts';
import { Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  period: Period;
  /** O período cobre todos os anos. */
  whole: boolean;
}

function Rows({
  buckets,
  color,
  years,
}: {
  buckets: Bucket<PanoramaItem>[];
  color: string;
  years?: Period;
}) {
  const { pick } = useChart();
  const max = Math.max(1, ...buckets.map((b) => b.items.length));
  return (
    <ul className="pano-rows">
      {buckets.slice(0, 10).map((b) => (
        <li key={b.label}>
          <button
            className="pano-row"
            type="button"
            onClick={() => pick({ items: b.items, label: b.label, query: b.label, years })}
          >
            <span className="pano-row-name">
              {b.label}
              {b.note && <small>{b.note}</small>}
            </span>
            <span aria-hidden="true" className="pano-row-bar">
              <i style={{ background: color, width: `${(b.items.length / max) * 100}%` }} />
            </span>
            <span className="pano-row-n">{b.items.length}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Venues({ cv, period, whole }: Props) {
  const { pick } = useChart();
  const v = venues(cv, period);
  const total = v.languages.reduce((n, l) => n + l.items.length, 0);
  const W = 760;
  let x = 0;
  const years = whole ? undefined : period;
  return (
    <>
      <h2 className="pano-h">Periódicos</h2>
      {v.journals.length ? (
        <Rows buckets={v.journals} color={SERIES[0]!} years={years} />
      ) : (
        <p className="pano-note">Nenhum artigo no período.</p>
      )}

      <h2 className="pano-h">Idioma das produções</h2>
      <svg aria-label="Idioma das produções" role="img" viewBox={`0 0 ${W} 34`}>
        {v.languages.slice(0, 4).map((l, i) => {
          const w = total ? (l.items.length / total) * W : 0;
          const x0 = x;
          x += w;
          const pct = Math.round((100 * l.items.length) / Math.max(1, total));
          return (
            <Mark
              key={l.label}
              label={`${l.label}: ${l.items.length} (${pct}%)`}
              selection={{ items: l.items, label: `Idioma: ${l.label}`, query: l.label, years }}
            >
              <rect fill={SERIES[i]} height="14" rx="3" width={Math.max(0, w - 2)} x={x0} y="0" />
              {w > 70 && (
                <text className="pano-value" x={x0 + 2} y="30">
                  {l.label} {pct}%
                </text>
              )}
            </Mark>
          );
        })}
      </svg>

      <h2 className="pano-h">País de publicação ou do evento</h2>
      <div className="pano-chips">
        {v.countries.map((c) => (
          <button
            key={c.label}
            className="pano-chip"
            type="button"
            onClick={() =>
              pick({ items: c.items, label: `País: ${c.label}`, query: c.label, years })
            }
          >
            {c.label} <small>{c.items.length}</small>
          </button>
        ))}
      </div>

      <h2 className="pano-h">Eventos, com as edições agrupadas</h2>
      {v.events.length ? (
        <Rows buckets={v.events} color={SERIES[2]!} years={years} />
      ) : (
        <p className="pano-note">Nenhum evento no período.</p>
      )}
      <p className="pano-note">
        Trabalhos em eventos: {v.national} nacionais, {v.international} internacionais.
      </p>
    </>
  );
}
