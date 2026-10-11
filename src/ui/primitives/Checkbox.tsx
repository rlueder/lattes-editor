import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';

import { CheckIcon } from '../icons.tsx';

interface Props {
  'aria-label': string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ checked, onChange, ...aria }: Props) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      className="checkbox"
      onCheckedChange={(next) => onChange(next)}
      {...aria}
    >
      <CheckboxPrimitive.Indicator className="checkbox-indicator">
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
