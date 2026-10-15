// "Currículo | Panorama" sob o cartão do perfil: o mesmo controle segmentado
// do ⚙ (Tema, Ordem dos campos), com o destaque que desliza até a opção.

import { type CSSProperties, type KeyboardEvent, useRef } from 'react';

export type Mode = 'curriculo' | 'panorama';

const MODES: { label: string; value: Mode }[] = [
  { label: 'Currículo', value: 'curriculo' },
  { label: 'Panorama', value: 'panorama' },
];

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeSwitch({ mode, onChange }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = MODES.findIndex((m) => m.value === mode);
  // Setas trocam a opção, como num grupo de rádio.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length;
    onChange(MODES[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      aria-label="Modo"
      className="menu-segment mode-switch"
      role="radiogroup"
      style={{ '--seg-count': MODES.length, '--seg-index': index } as CSSProperties}
    >
      <span aria-hidden="true" className="menu-seg-indicator" />
      {MODES.map((m, i) => (
        <button
          key={m.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-checked={m.value === mode}
          className="menu-seg"
          role="radio"
          tabIndex={m.value === mode ? 0 : -1}
          type="button"
          onClick={() => onChange(m.value)}
          onKeyDown={onKeyDown}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
