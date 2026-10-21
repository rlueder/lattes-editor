// Filtros do gráfico no painel à direita, empilhados como os filtros de uma
// seção do editor: o período (um campo de intervalo de anos, com os atalhos
// dentro), os filtros próprios do gráfico e, no fim, "Limpar filtros".

import { Fragment, type ReactNode, useId } from 'react';

import { FilterStatus } from '../ui/FilterStatus.tsx';
import { Select } from '../ui/primitives/Select.tsx';
import { YearRangeFilter } from '../ui/YearRangeFilter.tsx';
import { type FilterKind, filterOrder } from './catalog.ts';
import {
  changedCount,
  defaultFilters,
  type Filters,
  periodPresets,
  resetKinds,
} from './filters.ts';
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
  // Cada controle por tipo de filtro; a ordem vem de filterOrder (período por último).
  const controls: Record<FilterKind, ReactNode> = {
    grupo: (
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
    ),
    janela: (
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
    ),
    laco: (
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
    ),
    nivel: (
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
    ),
    periodo: (
      <YearRangeFilter
        active={filters.from !== defaults.from || filters.to !== defaults.to}
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
    ),
    repetidos: (
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
    ),
  };
  return (
    <div className="filter-bar pano-filters">
      {filterOrder(kinds).map((k) => (
        <Fragment key={k}>{controls[k]}</Fragment>
      ))}
      {changed > 0 && (
        <FilterStatus onClear={() => onChange(resetKinds(filters, defaults, kinds))}>
          {changed} {changed === 1 ? 'filtro' : 'filtros'}
        </FilterStatus>
      )}
    </div>
  );
}
