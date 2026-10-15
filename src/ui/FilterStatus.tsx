// Fim da pilha de filtros: quantos itens passam e o botão "Limpar filtros".
// O mesmo nas seções do currículo e nos gráficos do Panorama.

import type { ReactNode } from 'react';

import { CloseIcon } from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';

interface Props {
  /** O que fica à esquerda do botão ("3 de 10"). */
  children: ReactNode;
  onClear: () => void;
}

export function FilterStatus({ children, onClear }: Props) {
  return (
    <span className="filter-status">
      {children}
      <Tip label="Limpar filtros">
        <button
          aria-label="Limpar filtros"
          className="ghost icon-btn"
          type="button"
          onClick={onClear}
        >
          <CloseIcon />
        </button>
      </Tip>
    </span>
  );
}
