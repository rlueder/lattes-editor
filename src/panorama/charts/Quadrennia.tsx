import { countRows, inWindow, windows } from '../aggregate.ts';
import type { CvData } from '../model.ts';
import { useChart } from '../use-chart.ts';

interface Props {
  cv: CvData;
  /** A coluna extra: últimos 5 ou 10 anos. */
  lastYears: number;
  now: number;
}

export function Quadrennia({ cv, lastYears, now }: Props) {
  const { pick } = useChart();
  const cols = windows(cv, now, lastYears);
  const rows = countRows(cv);
  return (
    <>
      <div className="pano-table-wrap">
        <table className="pano-table">
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              {cols.map((c) => (
                <th key={c.label} scope="col">
                  {c.label}
                  <small>{c.note}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.sub ? 'sub' : undefined}>
                <th scope="row">{r.label}</th>
                {cols.map((c) => {
                  const items = inWindow(r.items, c);
                  return (
                    <td key={c.label}>
                      {items.length ? (
                        <button
                          className="pano-num"
                          type="button"
                          onClick={() =>
                            pick({
                              items,
                              label: `${r.label}, ${c.label}`,
                              years: c.label === 'Total' ? undefined : { from: c.from, to: c.to },
                            })
                          }
                        >
                          {items.length}
                        </button>
                      ) : (
                        <span className="pano-zero">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
