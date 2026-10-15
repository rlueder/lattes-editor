// Controle segmentado do app (o mesmo desenho do ⚙: Tema, Ordem dos campos),
// com o destaque que desliza até a opção escolhida. Setas trocam a opção.

import { type CSSProperties, type KeyboardEvent, useRef } from 'react';

interface Props<T extends string> {
  className?: string;
  label: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  className,
  label,
  onChange,
  options,
  value,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const onKeyDown = (e: KeyboardEvent) => {
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!forward && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = (index + (forward ? 1 : options.length - 1)) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      aria-label={label}
      className={`menu-segment pano-segment ${className ?? ''}`}
      role="radiogroup"
      style={{ '--seg-count': options.length, '--seg-index': index } as CSSProperties}
    >
      <span aria-hidden="true" className="menu-seg-indicator" />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-checked={o.value === value}
          className="menu-seg"
          role="radio"
          tabIndex={o.value === value ? 0 : -1}
          type="button"
          onClick={() => onChange(o.value)}
          onKeyDown={onKeyDown}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
