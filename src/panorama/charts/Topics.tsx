import { type Period, range } from '../aggregate.ts';
import type { CvData, Production } from '../model.ts';
import { topics } from '../topics.ts';
import { Insight, Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  period: Period;
  onlyRepeated: boolean;
}

const W = 760;
const L = 190;
const ROW = 22;

export function Topics({ cv, onlyRepeated, period }: Props) {
  const t = topics(cv, period, onlyRepeated);
  const years = t.topics.flatMap((x) => x.items.map((i) => i.year!));
  const span = years.length ? range(Math.min(...years), Math.max(...years)) : [];
  const bw = (W - L) / Math.max(1, span.length);
  const H = t.topics.length * ROW + 24;
  return (
    <>
      <Insight>
        <b>
          {t.withKeywords} de {t.total}
        </b>{' '}
        produções têm palavras-chave.
      </Insight>
      {t.topics.length === 0 ? (
        <p className="pano-note">Nenhuma palavra-chave com esse filtro.</p>
      ) : (
        <>
          <Legend
            items={[
              { color: 'var(--pano-1)', label: 'Termo que se repete' },
              { color: 'var(--pano-1)', label: 'Termo de uma produção só', shape: 'ring' },
            ]}
          />
          <svg aria-label="Palavras-chave por ano" role="img" viewBox={`0 0 ${W} ${H}`}>
            {t.topics.map((topic, i) => {
              const y = i * ROW + 10;
              const perYear = new Map<number, Production[]>();
              for (const p of topic.items)
                perYear.set(p.year!, [...(perYear.get(p.year!) ?? []), p]);
              const label = topic.label.length > 30 ? `${topic.label.slice(0, 29)}…` : topic.label;
              return (
                <g key={topic.label}>
                  <line className="pano-grid" x1={L} x2={W} y1={y} y2={y} />
                  <text
                    className={topic.repeated ? 'pano-lane' : 'pano-axis-label'}
                    textAnchor="end"
                    x={L - 10}
                    y={y + 4}
                  >
                    {label}
                  </text>
                  {[...perYear].map(([year, items]) => (
                    <Mark
                      key={year}
                      label={`${topic.label}, ${year}: ${items.map((p) => p.title).join('; ')}`}
                      selection={{
                        items,
                        label: `"${topic.label}" em ${year}`,
                        soon: 'Filtro por palavra-chave',
                      }}
                    >
                      <circle
                        className={topic.repeated ? 'pano-dot fill-1' : 'pano-dot ring-1'}
                        cx={L + (year - span[0]!) * bw + bw / 2}
                        cy={y}
                        r={4 + items.length * 1.5}
                      />
                    </Mark>
                  ))}
                </g>
              );
            })}
            {span.map((y, j) => (
              <text
                key={y}
                className="pano-axis-label"
                textAnchor="middle"
                x={L + j * bw + bw / 2}
                y={H - 2}
              >
                {span.length > 10 ? String(y).slice(2) : y}
              </text>
            ))}
          </svg>
        </>
      )}
      {cv.areas.length > 0 && (
        <>
          <h2 className="pano-h">Áreas de atuação declaradas</h2>
          <div className="pano-chips">
            {cv.areas.map((a) => (
              <span key={`${a.area}-${a.sub}`} className="pano-chip static">
                {a.area}
                {a.sub && <small> › {a.sub}</small>}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}
