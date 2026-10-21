// O filtro de período do painel, com o rótulo "Período" à vista sobre os dois
// controles, igual nas seções e no Panorama: "Atalho", com os períodos prontos
// (todos os anos, últimos 5, quadriênios da CAPES), e logo abaixo o campo de
// intervalo de anos. Escolher um atalho põe o intervalo no campo; mudar o campo à mão
// deixa o atalho em "Personalizado". Com seis ou sete opções, uma lista de
// opções ocupa uma linha só no painel estreito, onde as pílulas quebrariam.

import { Select } from './primitives/Select.tsx';
import type { YearPreset, YearRange } from './year-range.ts';
import { YearRangeField } from './YearRangeField.tsx';

interface Props {
  /** Período diferente de "todos os anos": campo e atalho marcados como filtro ativo. */
  active: boolean;
  id: string;
  label: string;
  max: number;
  min: number;
  presets: YearPreset[];
  today: number;
  value: YearRange;
  onChange: (range: YearRange) => void;
}

export function YearRangeFilter({ active, onChange, presets, value, ...field }: Props) {
  const current = presets.find((p) => p.range.from === value.from && p.range.to === value.to);
  return (
    <div className="year-range-filter">
      <label className="year-range-label" htmlFor={field.id}>
        {field.label}
      </label>
      <Select
        aria-label="Atalho de período"
        className={active ? 'filter-facet active' : 'filter-facet'}
        options={[
          ...presets.map((p) => ({
            label: p.label,
            selectedLabel: `Atalho: ${p.label}`,
            value: p.id,
          })),
          ...(current
            ? []
            : [{ label: 'Personalizado', selectedLabel: 'Atalho: personalizado', value: '' }]),
        ]}
        value={current?.id ?? ''}
        onChange={(id) => {
          const p = presets.find((x) => x.id === id);
          if (p) onChange(p.range);
        }}
      />
      <YearRangeField active={active} value={value} onChange={onChange} {...field} />
    </div>
  );
}
