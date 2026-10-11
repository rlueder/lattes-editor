import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

interface Props {
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  checked: boolean;
  id?: string;
  onChange: (checked: boolean) => void;
}

export function Switch({ checked, id, onChange, ...aria }: Props) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      className="switch"
      id={id}
      onCheckedChange={(next) => onChange(next)}
      {...aria}
    >
      <SwitchPrimitive.Thumb className="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
