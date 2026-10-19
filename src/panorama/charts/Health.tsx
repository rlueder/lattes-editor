import type { ReactNode } from 'react';

import { CheckIcon } from '../../ui/icons.tsx';
import type { Period } from '../aggregate.ts';
import type { CvData, ProductionGroup } from '../model.ts';
import { type Check, HEALTH_GROUPS, healthChecks, profileFlags } from '../topics.ts';
import { useChart } from '../use-chart.ts';
import { Insight } from './shared.tsx';

interface Props {
  cv: CvData;
  group?: ProductionGroup;
  period: Period;
  /** O período cobre a carreira inteira: a seção abre sem recorte de anos. */
  whole: boolean;
}

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

/** ✓ no azul do destaque; "!" no tom de aviso, para o estado não depender só da forma. */
function StateIcon({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'pano-check-icon ok' : 'pano-check-icon warn'}>
      {ok ? <CheckIcon /> : '!'}
      <span className="sr-only">{ok ? 'completo' : 'incompleto'}</span>
    </span>
  );
}

function Row({ c, period, whole }: { c: Check; period: Period; whole: boolean }) {
  const { pick } = useChart();
  const ok = c.total.length - c.missing.length;
  const done = c.missing.length === 0;
  return (
    <li>
      <button
        className="pano-check"
        disabled={done}
        type="button"
        onClick={() =>
          pick({
            items: c.missing,
            label: `${c.label}: faltam ${c.missing.length}`,
            missing: c.id,
            years: whole ? undefined : period,
          })
        }
      >
        <StateIcon ok={done} />
        <span className="pano-check-text">
          {c.label}
          <small>{c.hint}</small>
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
}

function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <li className="pano-check-group">
      <h3 className="pano-group-label">{label}</h3>
      <ul className="pano-checks">{children}</ul>
    </li>
  );
}

export function Health({ cv, group, period, whole }: Props) {
  const checks = healthChecks(cv, period, group);
  const flags = profileFlags(cv);
  const total = checks.length + flags.length;
  const open =
    checks.filter((c) => c.missing.length > 0).length + flags.filter((f) => !f.ok).length;
  return (
    <>
      <Insight>
        {open === 0 ? 'Nada a completar.' : `Faltam dados em ${open} das ${total} linhas.`}
      </Insight>
      <p className="pano-note">Clique numa linha para ver o que falta.</p>
      <ul className="pano-check-groups">
        {HEALTH_GROUPS.filter((g) => g !== 'Perfil').map((g) => {
          const rows = checks.filter((c) => c.group === g);
          return rows.length ? (
            <Group key={g} label={g}>
              {rows.map((c) => (
                <Row key={c.id} c={c} period={period} whole={whole} />
              ))}
            </Group>
          ) : null;
        })}
        <Group label="Perfil">
          {flags.map((f) => (
            <li key={f.label}>
              <div className="pano-check static">
                <StateIcon ok={f.ok} />
                <span className="pano-check-text">
                  {f.label}
                  <small>{f.hint}</small>
                </span>
                <span />
                <span className="pano-check-frac">{f.ok ? 'preenchido' : 'vazio'}</span>
              </div>
            </li>
          ))}
        </Group>
      </ul>
    </>
  );
}
