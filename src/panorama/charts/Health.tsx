import { CheckIcon } from '../../ui/icons.tsx';
import type { Period } from '../aggregate.ts';
import type { CvData, ProductionGroup } from '../model.ts';
import { healthChecks, profileFlags } from '../topics.ts';
import { useChart } from '../use-chart.ts';
import { Insight } from './shared.tsx';

interface Props {
  cv: CvData;
  group?: ProductionGroup;
  period: Period;
}

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export function Health({ cv, group, period }: Props) {
  const { pick } = useChart();
  const checks = healthChecks(cv, period, group);
  const doi = checks.find((c) => c.id === 'doi');
  return (
    <>
      <Insight>
        {doi && (
          <>
            <b>{pct(doi.total.length - doi.missing.length, doi.total.length)}%</b> dos artigos com
            DOI.{' '}
          </>
        )}
        Cada linha abre só os itens que faltam completar.
      </Insight>
      <ul className="pano-checks">
        {checks.map((c) => {
          const ok = c.total.length - c.missing.length;
          const done = c.missing.length === 0;
          return (
            <li key={c.id}>
              <button
                className="pano-check"
                disabled={done}
                type="button"
                onClick={() =>
                  pick({
                    items: c.missing,
                    label: `${c.label}: faltam ${c.missing.length}`,
                    soon: `Filtro "${c.label.replace(' com ', ' sem ')}"`,
                  })
                }
              >
                <span className={done ? 'pano-check-icon ok' : 'pano-check-icon warn'}>
                  {done ? <CheckIcon /> : '!'}
                  <span className="sr-only">{done ? 'completo' : 'incompleto'}</span>
                </span>
                <span className="pano-check-text">
                  {c.label}
                  {c.hint && <small>{c.hint}</small>}
                </span>
                <span aria-hidden="true" className="pano-meter">
                  <i style={{ width: `${pct(ok, c.total.length)}%` }} />
                </span>
                <span className="pano-check-frac">
                  {ok} de {c.total.length}
                </span>
              </button>
            </li>
          );
        })}
        {profileFlags(cv).map((f) => (
          <li key={f.label}>
            <div className="pano-check static">
              <span className={f.ok ? 'pano-check-icon ok' : 'pano-check-icon warn'}>
                {f.ok ? <CheckIcon /> : '!'}
              </span>
              <span className="pano-check-text">
                {f.label}
                {f.hint && <small>{f.hint}</small>}
              </span>
              <span />
              <span className="pano-check-frac">{f.ok ? 'preenchido' : 'vazio'}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
