// Grupo de campos que fecha numa linha de texto: título, quantos têm valor e
// alguns valores curtos. O botão é um botão de verdade (Enter e espaço abrem),
// com aria-expanded, mas sem cara de botão; fechado, os campos nem são
// montados. Ver disclosure.ts.

import { type ReactNode, useEffect, useId, useState } from 'react';

import { closedLine, rememberGroup } from './disclosure.ts';
import { ChevronIcon } from './icons.tsx';

interface Props {
  children: ReactNode;
  filled: number;
  /** Abre (e mantém aberto enquanto valer): campo com erro ou para onde se pulou. */
  forceOpen?: boolean;
  initialOpen: boolean;
  label: string;
  /** Os valores do grupo numa linha, mostrados com o grupo fechado. */
  summary: string;
  /** Classe do título, no estilo dos títulos dos grupos que não fecham. */
  titleClass: string;
}

export function DisclosureGroup({
  children,
  filled,
  forceOpen = false,
  initialOpen,
  label,
  summary,
  titleClass,
}: Props) {
  const [open, setOpen] = useState(initialOpen || forceOpen);
  const bodyId = useId();
  // Erro que aparece depois (o primeiro "Salvar") abre o grupo que o tem.
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  const toggle = () => {
    rememberGroup(label, !open);
    setOpen(!open);
  };
  const line = open ? '' : closedLine(filled, summary);
  return (
    <div className={`disclosure${open ? ' is-open' : ''}`}>
      <button
        aria-controls={open ? bodyId : undefined}
        aria-expanded={open}
        className="disclosure-toggle"
        type="button"
        onClick={toggle}
      >
        <span className="disclosure-chevron">
          <ChevronIcon />
        </span>
        {/* Título e linha num texto só: os espaços em volta do ponto ficam no
            texto (no começo de um item flex eles sumiriam), e a reticência
            corta a linha inteira. */}
        <span className="disclosure-text">
          <span className={`disclosure-title ${titleClass}`}>{label}</span>
          {line && <span className="disclosure-line">{` · ${line}`}</span>}
        </span>
      </button>
      {open && (
        <div className="disclosure-body" id={bodyId}>
          {children}
        </div>
      )}
    </div>
  );
}
