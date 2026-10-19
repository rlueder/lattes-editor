// Peças comuns dos gráficos: a marca clicável (com dica no passar do mouse e
// no foco do teclado), a legenda e os caminhos de barra com o topo arredondado.

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

import type { Selection } from '../drill.ts';
import { useChart } from '../use-chart.ts';

interface MarkProps {
  children: ReactNode;
  /** Rótulo para leitor de tela; também é a dica quando `tip` falta. */
  label: string;
  selection: Selection;
  tip?: ReactNode;
}

/** Uma marca de gráfico (barra, ponto, faixa) que abre a lista ao clicar. */
export function Mark({ children, label, selection, tip }: MarkProps) {
  const { pick, setTip } = useChart();
  const show = (x: number, y: number) => setTip({ content: tip ?? label, x, y });
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    pick(selection);
  };
  return (
    <g
      aria-label={label}
      className="pano-mark"
      role="button"
      tabIndex={0}
      onBlur={() => setTip(null)}
      onClick={() => pick(selection)}
      onFocus={(e) => {
        const r = (e.currentTarget as Element).getBoundingClientRect();
        show(r.right, r.top);
      }}
      onKeyDown={onKey}
      onMouseLeave={() => setTip(null)}
      onMouseMove={(e: MouseEvent) => show(e.clientX, e.clientY)}
    >
      {children}
    </g>
  );
}

export interface LegendItem {
  color: string;
  label: string;
  /** Como a marca aparece: cheia (padrão), anel ou hachura. */
  shape?: 'hatch' | 'ring';
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="pano-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span
            aria-hidden="true"
            className={`pano-swatch ${i.shape ?? ''}`}
            style={{ background: i.shape ? undefined : i.color, borderColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Hachura dos anos vazios, a 45°. */
export function HatchDefs() {
  return (
    <defs>
      <pattern
        height="5"
        id="pano-hatch"
        patternTransform="rotate(45)"
        patternUnits="userSpaceOnUse"
        width="5"
      >
        <line className="pano-hatch-line" x1="0" x2="0" y1="0" y2="5" />
      </pattern>
    </defs>
  );
}

/** Frase em destaque no alto do gráfico, na tipografia de leitura. */
export function Insight({ children }: { children: ReactNode }) {
  return <p className="pano-insight">{children}</p>;
}
