import { useState } from 'react';

import { countRows, countsTsv, inWindow, windows } from '../aggregate.ts';
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
  const [copied, setCopied] = useState(false);
  const cols = windows(cv, now, lastYears);
  const rows = countRows(cv);
  const copy = () => {
    void navigator.clipboard?.writeText(countsTsv(rows, cols)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
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
                              soon: c.label === 'Total' ? undefined : 'Recorte por período',
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
      <p className="pano-note">
        <button className="ghost pano-copy" type="button" onClick={copy}>
          {copied ? 'Copiado' : 'Copiar como planilha'}
        </button>{' '}
        Os quadriênios são os da avaliação da CAPES. Este gráfico não usa o período: as janelas são
        as colunas.
      </p>
    </>
  );
}
