// "Currículo | Panorama" sob o cartão do perfil.

import { Segmented } from './Segmented.tsx';

export type Mode = 'curriculo' | 'panorama';

const MODES = [
  { label: 'Currículo', value: 'curriculo' },
  { label: 'Panorama', value: 'panorama' },
] as const;

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeSwitch({ mode, onChange }: Props) {
  return (
    <Segmented
      className="mode-switch"
      label="Modo"
      options={MODES}
      value={mode}
      onChange={onChange}
    />
  );
}
