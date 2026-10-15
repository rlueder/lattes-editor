import { useId, useRef } from 'react';

import { type Facet, type FilterState, isFiltering, NO_FILTER } from './facets.ts';
import { FilterStatus } from './FilterStatus.tsx';
import { SearchIcon } from './icons.tsx';
import { ClearButton } from './primitives/ClearButton.tsx';
import { Select } from './primitives/Select.tsx';
import { yearPresets, type YearRange } from './year-range.ts';
import { YearRangeFilter } from './YearRangeFilter.tsx';

interface Props {
  facets: Facet[];
  shown: number;
  state: FilterState;
  total: number;
  /** Primeiro e último ano dos registros; sem ele, a seção não tem filtro de período. */
  years?: YearRange;
  onChange: (state: FilterState) => void;
}

/** O ano corrente, lido na hora: um app aberto na virada do ano não fica no ano anterior. */
const thisYear = () => new Date().getFullYear();

export function FilterBar({ facets, onChange, shown, state, total, years }: Props) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const filtering = isFiltering(state);
  // Tipo primeiro, depois as outras facetas e o período por último, como no Panorama.
  const renderFacet = (f: Facet) => {
    const value = state.selected[f.id] ?? '';
    return (
      <Select
        key={f.id}
        aria-label={f.label}
        className={value ? 'filter-facet active' : 'filter-facet'}
        options={[
          { label: 'Todos', selectedLabel: `${f.label}: todos`, value: '' },
          ...f.options.map((o) => ({ label: `${o.label} (${o.count})`, value: o.value })),
        ]}
        value={value}
        onChange={(next) => {
          const selected = { ...state.selected };
          if (next) selected[f.id] = next;
          else delete selected[f.id];
          onChange({ ...state, selected });
        }}
      />
    );
  };
  return (
    <div className="filter-bar" role="search">
      <div className="filter-search">
        <SearchIcon />
        <label className="sr-only" htmlFor={searchId}>
          Filtrar esta seção
        </label>
        <input
          ref={searchRef}
          id={searchId}
          placeholder="Filtrar esta seção"
          value={state.query}
          onChange={(e) => onChange({ ...state, query: e.target.value })}
        />
        <ClearButton
          input={searchRef}
          value={state.query}
          onClear={() => onChange({ ...state, query: '' })}
        />
      </div>
      {facets.filter((f) => f.id === 'tipo').map(renderFacet)}
      {facets.filter((f) => f.id !== 'tipo').map(renderFacet)}
      {years && (
        <YearRangeFilter
          active={state.years !== undefined}
          id={`${searchId}-anos`}
          label="Período"
          max={years.to}
          min={years.from}
          presets={yearPresets(years, thisYear())}
          today={thisYear()}
          value={state.years ?? years}
          onChange={(r) =>
            onChange({
              ...state,
              years: r.from <= years.from && r.to >= years.to ? undefined : r,
            })
          }
        />
      )}
      {filtering && (
        <FilterStatus onClear={() => onChange(NO_FILTER)}>
          {shown} de {total}
        </FilterStatus>
      )}
    </div>
  );
}
