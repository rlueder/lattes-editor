// Filtros do gráfico no painel à direita, empilhados como os filtros de uma
// seção do editor: período (atalho, de, até) e os filtros próprios do gráfico.

import { Select } from '../ui/primitives/Select.tsx';
import type { FilterKind } from './catalog.ts';
import { type Filters, periodPresets, presetOf, setBound, yearOptions } from './filters.ts';
import { type CvData, LEVELS, PRODUCTION_GROUPS } from './model.ts';
import { TIES } from './people.ts';

interface Props {
  cv: CvData;
  filters: Filters;
  kinds: FilterKind[];
  now: number;
  onChange: (f: Filters) => void;
}

export function FiltersPanel({ cv, filters, kinds, now, onChange }: Props) {
  const presets = periodPresets(cv, now);
  const preset = presetOf(presets, filters);
  const years = yearOptions(cv).map((y) => ({ label: String(y), value: String(y) }));
  const cls = (active: boolean) => (active ? 'filter-facet active' : 'filter-facet');
  return (
    <div className="filter-bar pano-filters">
      {kinds.includes('periodo') && (
        <>
          <Select
            aria-label="Período"
            className={cls(preset !== 'tudo')}
            options={[
              ...presets.map((p) => ({
                label: p.label,
                selectedLabel: `Período: ${p.label}`,
                value: p.id,
              })),
              ...(preset ? [] : [{ label: 'Outro', selectedLabel: 'Período: outro', value: '' }]),
            ]}
            value={preset}
            onChange={(id) => {
              const p = presets.find((x) => x.id === id);
              if (p) onChange({ ...filters, ...p.period });
            }}
          />
          <div className="pano-range">
            <Select
              aria-label="Desde o ano"
              className="filter-facet"
              options={years.map((y) => ({ ...y, selectedLabel: `De ${y.label}` }))}
              value={String(filters.from)}
              onChange={(v) => onChange(setBound(filters, 'from', Number(v)))}
            />
            <Select
              aria-label="Até o ano"
              className="filter-facet"
              options={years.map((y) => ({ ...y, selectedLabel: `Até ${y.label}` }))}
              value={String(filters.to)}
              onChange={(v) => onChange(setBound(filters, 'to', Number(v)))}
            />
          </div>
        </>
      )}
      {kinds.includes('janela') && (
        <Select
          aria-label="Janela recente"
          className="filter-facet"
          options={[5, 10].map((n) => ({
            label: `Últimos ${n} anos`,
            selectedLabel: `Janela recente: ${n} anos`,
            value: String(n),
          }))}
          value={String(filters.lastYears)}
          onChange={(v) => onChange({ ...filters, lastYears: Number(v) })}
        />
      )}
      {kinds.includes('grupo') && (
        <Select
          aria-label="Tipo de produção"
          className={cls(filters.group !== '')}
          options={[
            { label: 'Todos', selectedLabel: 'Tipo: todos', value: '' },
            ...PRODUCTION_GROUPS.map((g) => ({
              label: g.label,
              selectedLabel: `Tipo: ${g.label}`,
              value: g.key,
            })),
          ]}
          value={filters.group}
          onChange={(v) => onChange({ ...filters, group: v as Filters['group'] })}
        />
      )}
      {kinds.includes('nivel') && (
        <Select
          aria-label="Nível"
          className={cls(filters.level !== '')}
          options={[
            { label: 'Todos', selectedLabel: 'Nível: todos', value: '' },
            ...LEVELS.filter((l) => cv.supervisions.some((s) => s.level === l)).map((l) => ({
              label: l,
              selectedLabel: `Nível: ${l}`,
              value: l,
            })),
          ]}
          value={filters.level}
          onChange={(v) => onChange({ ...filters, level: v as Filters['level'] })}
        />
      )}
      {kinds.includes('laco') && (
        <Select
          aria-label="Laço"
          className={cls(filters.tie !== '')}
          options={[
            { label: 'Todos', selectedLabel: 'Laço: todos', value: '' },
            ...TIES.map((t) => ({
              label: t.label,
              selectedLabel: `Laço: ${t.label}`,
              value: t.key,
            })),
          ]}
          value={filters.tie}
          onChange={(v) => onChange({ ...filters, tie: v as Filters['tie'] })}
        />
      )}
      {kinds.includes('vista') && (
        <Select
          aria-label="Vista"
          className="filter-facet"
          options={[
            { label: 'Lista', selectedLabel: 'Vista: lista', value: 'lista' },
            {
              label: 'Rede de coautoria',
              selectedLabel: 'Vista: rede de coautoria',
              value: 'rede',
            },
          ]}
          value={filters.view}
          onChange={(v) => onChange({ ...filters, view: v as Filters['view'] })}
        />
      )}
      {kinds.includes('repetidos') && (
        <Select
          aria-label="Palavras-chave"
          className={cls(filters.repeated)}
          options={[
            { label: 'Todas', selectedLabel: 'Palavras-chave: todas', value: '' },
            {
              label: 'Só as que se repetem',
              selectedLabel: 'Palavras-chave: só as repetidas',
              value: 'sim',
            },
          ]}
          value={filters.repeated ? 'sim' : ''}
          onChange={(v) => onChange({ ...filters, repeated: v === 'sim' })}
        />
      )}
    </div>
  );
}
