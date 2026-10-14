// Lista de opções em que se pode digitar (Combobox do Base UI): o texto filtra
// as opções (option-filter.ts), setas e Enter escolhem, Esc fecha. O valor é
// sempre uma das opções: texto que não casa com nenhuma volta ao valor
// anterior ao sair do campo. A opção de valor vazio limpa o campo e dá o texto
// de apoio quando nada está escolhido.

import { Combobox } from '@base-ui/react/combobox';
import { useState } from 'react';

import { CheckIcon, ChevronIcon } from '../icons.tsx';
import { rankOptions } from '../option-filter.ts';
import type { Option } from './Select.tsx';

interface Props {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  className?: string;
  /** Sem opção que se aplique (o tipo de participação de um ouvinte, por exemplo). */
  disabled?: boolean;
  id?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

const labelOf = (o: Option) => (o.value === '' ? '' : (o.selectedLabel ?? o.label));

export function ComboSelect({ className, disabled, id, onChange, options, value, ...aria }: Props) {
  const empty = options.find((o) => o.value === '');
  const selected = value ? (options.find((o) => o.value === value) ?? null) : null;
  const [query, setQuery] = useState('');
  // Com o nome escolhido ainda no campo (lista recém-aberta), mostra tudo.
  const filtering = query !== '' && query !== (selected ? labelOf(selected) : '');
  const shown = filtering ? rankOptions(options, query) : options;

  return (
    <Combobox.Root
      autoHighlight
      disabled={disabled}
      filteredItems={shown}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      items={options}
      itemToStringLabel={labelOf}
      itemToStringValue={(o: Option) => o.value}
      value={selected}
      onInputValueChange={setQuery}
      onValueChange={(next) => onChange((next as Option | null)?.value ?? '')}
    >
      <Combobox.InputGroup className={`select-trigger combo ${className ?? ''}`}>
        <Combobox.Input
          className="combo-input"
          id={id}
          placeholder={empty?.label ?? '(escolha)'}
          {...aria}
        />
        <Combobox.Trigger aria-label="Mostrar as opções" className="combo-toggle">
          <ChevronIcon />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="select-positioner" sideOffset={4}>
          <Combobox.Popup className="select-popup">
            <Combobox.Empty className="combo-empty">Nenhuma opção com esse texto</Combobox.Empty>
            <Combobox.List>
              {(o: Option) => (
                <Combobox.Item key={o.value} className="select-item" value={o}>
                  <Combobox.ItemIndicator className="select-indicator">
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                  <span className={o.value === '' ? 'combo-empty-option' : undefined}>
                    {o.value === '' ? '(vazio)' : o.label}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
