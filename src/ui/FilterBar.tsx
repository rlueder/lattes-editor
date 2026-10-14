import { useId, useRef } from 'react';

import { type Facet, type FilterState, isFiltering, NO_FILTER } from './facets.ts';
import { CloseIcon, SearchIcon } from './icons.tsx';
import { ClearButton } from './primitives/ClearButton.tsx';
import { Select } from './primitives/Select.tsx';
import { Tip } from './primitives/Tip.tsx';

interface Props {
  facets: Facet[];
  shown: number;
  state: FilterState;
  total: number;
  onChange: (state: FilterState) => void;
}

export function FilterBar({ facets, onChange, shown, state, total }: Props) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const filtering = isFiltering(state);
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
      {facets.map((f) => {
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
      })}
      {filtering && (
        <span className="filter-status">
          {shown} de {total}
          <Tip label="Limpar filtros">
            <button
              aria-label="Limpar filtros"
              className="ghost icon-btn"
              type="button"
              onClick={() => onChange(NO_FILTER)}
            >
              <CloseIcon />
            </button>
          </Tip>
        </span>
      )}
    </div>
  );
}
