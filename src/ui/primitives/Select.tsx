// Lista de opções sobre o Select do Base UI: teclado, leitor de tela e
// posicionamento vêm da biblioteca; a aparência, dos tokens do editor.

import { Select as SelectPrimitive } from '@base-ui/react/select';

import { CheckIcon, ChevronIcon } from '../icons.tsx';

export interface Option {
  label: string;
  /** O que o botão mostra com esta opção escolhida, quando difere da lista. */
  selectedLabel?: string;
  /** Dica da opção, no passar do mouse (o período de um quadriênio). */
  title?: string;
  value: string;
}

interface Props {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  className?: string;
  /** Sem opção que se aplique (o tipo de participação de um ouvinte, por exemplo). */
  disabled?: boolean;
  id?: string;
  options: Option[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function Select({
  className,
  disabled,
  id,
  onChange,
  options,
  placeholder,
  value,
  ...aria
}: Props) {
  return (
    <SelectPrimitive.Root
      disabled={disabled}
      items={options.map((o) => ({ label: o.selectedLabel ?? o.label, value: o.value }))}
      value={value}
      onValueChange={(next) => onChange((next as string | null) ?? '')}
    >
      <SelectPrimitive.Trigger className={`select-trigger ${className ?? ''}`} id={id} {...aria}>
        <SelectPrimitive.Value className="select-value" placeholder={placeholder} />
        <SelectPrimitive.Icon className="select-icon">
          <ChevronIcon />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          alignItemWithTrigger={false}
          className="select-positioner"
          sideOffset={4}
        >
          <SelectPrimitive.Popup className="select-popup">
            <SelectPrimitive.List>
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  className="select-item"
                  title={o.title}
                  value={o.value}
                >
                  <SelectPrimitive.ItemIndicator className="select-indicator">
                    <CheckIcon />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
