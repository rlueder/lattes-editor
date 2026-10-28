// Grupo de caixas em que mais de uma pode ficar marcada (a temática do
// projeto de ensino). O valor são os códigos marcados, na ordem das opções,
// separados por vírgula, como o editor os guarda (schema/screen-fields.ts).

import { Checkbox } from '@base-ui/react/checkbox';

import { CheckIcon } from '../icons.tsx';

interface Props {
  'aria-describedby'?: string;
  id: string;
  labelledBy: string;
  options: readonly { label: string; value: string }[];
  value: string;
  onChange: (next: string) => void;
}

export function CheckGroup({ id, labelledBy, onChange, options, value, ...rest }: Props) {
  const on = new Set(value.split(',').filter(Boolean));
  const toggle = (code: string, checked: boolean) => {
    const next = new Set(on);
    if (checked) next.add(code);
    else next.delete(code);
    onChange(
      options
        .map((o) => o.value)
        .filter((v) => next.has(v))
        .join(','),
    );
  };
  return (
    <div
      aria-describedby={rest['aria-describedby']}
      aria-labelledby={labelledBy}
      className="check-group"
      id={id}
      role="group"
    >
      {options.map((o) => (
        <label key={o.value} className="check-option">
          <Checkbox.Root
            checked={on.has(o.value)}
            className="checkbox"
            onCheckedChange={(checked) => toggle(o.value, checked)}
          >
            <Checkbox.Indicator className="checkbox-indicator">
              <CheckIcon />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
