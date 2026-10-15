// No modo Panorama, o menu lateral lista os gráficos no lugar das seções,
// com a mesma aparência dos itens do menu.

import { CHARTS } from './catalog.ts';

interface Props {
  activeId: string;
  onSelect: (id: string) => void;
}

export function PanoramaNav({ activeId, onSelect }: Props) {
  return (
    <ul aria-label="Gráficos do Panorama">
      {CHARTS.map((c) => (
        <li key={c.id}>
          <button
            aria-current={c.id === activeId ? 'page' : undefined}
            className={c.id === activeId ? 'active' : undefined}
            type="button"
            onClick={() => onSelect(c.id)}
          >
            <span className="nav-label">{c.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
