// Filtros do gráfico no painel à direita, empilhados como os filtros de uma
// seção do editor: o período (um campo de intervalo de anos, com os atalhos
// dentro), os filtros próprios do gráfico e, no fim, "Limpar filtros".

import { useId } from 'react';

import { FilterStatus } from '../ui/FilterStatus.tsx';
import { Select } from '../ui/primitives/Select.tsx';
import { YearRangeField } from '../ui/YearRangeField.tsx';
import type { FilterKind } from './catalog.ts';
import { changedCount, defaultFilters, type Filters, periodPresets } from './filters.ts';
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
  const id = useId();
  const defaults = defaultFilters(cv);
  const changed = changedCount(filters, defaults, kinds);
  const cls = (active: boolean) => (active ? 'filter-facet active' : 'filter-facet');
  return (
    <div className="filter-bar pano-filters">
      {kinds.includes('periodo') && (
        <div className="pano-period">
          <label className="pano-year-label" htmlFor={`${id}-periodo`}>
            Período
          </label>
          <YearRangeField
            id={`${id}-periodo`}
            label="Período"
            max={Math.max(cv.lastYear, now)}
            min={cv.careerStart}
            presets={periodPresets(cv, now).map((p) => ({
              id: p.id,
              label: p.label,
              range: p.period,
            }))}
            today={now}
            value={{ from: filters.from, to: filters.to }}
            onChange={(r) => onChange({ ...filters, ...r })}
          />
        </div>
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
      {changed > 0 && (
        <FilterStatus onClear={() => onChange(defaults)}>
          {changed} {changed === 1 ? 'filtro' : 'filtros'}
        </FilterStatus>
      )}
    </div>
  );
}
