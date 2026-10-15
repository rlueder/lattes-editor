// Símbolo e nome do app no canto esquerdo do cabeçalho: o símbolo do app
// sem o fundo branco do ícone (brand/source/symbol-original.svg) e a
// assinatura "Lattes" em 700 com "Editor" em 400. O violeta do símbolo segue
// a cor da assinatura (--brand), que fica branca no tema escuro; a peça menta
// não muda. Em tela estreita fica só o símbolo; o nome continua para o
// leitor de tela.

import { useId } from 'react';

const VIOLET = 'var(--brand)';
const MINT = '#9EF2E2';

function Symbol() {
  // Id próprio do recorte: o cabeçalho e a tela de boas-vindas não colidem.
  const clip = `brand-cut-${useId().replace(/:/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      className="brand-icon"
      focusable="false"
      viewBox="-115.45 -65.97 841.12 1002.34"
    >
      <defs>
        <clipPath id={clip}>
          <path d="M-200 164.93H395.82V696.44L278.82 813.45H-200Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path
          d="M488.81 0H81.72V698H213.66V117.01H488.81Z"
          fill={VIOLET}
          transform="translate(-81.72 813.45) scale(1 -1)"
        />
      </g>
      <path
        d="M181.42 115.45a115.45 115.45 0 1 0 -230.9 0a115.45 115.45 0 1 0 230.9 0M115.45 115.45a49.48 49.48 0 1 0 -98.96 0a49.48 49.48 0 1 0 98.96 0"
        fill={VIOLET}
        fillRule="evenodd"
      />
      <path d="M442.47 696.44H493.78V813.45H325.47Z" fill={MINT} />
      <path
        d="M659.71 754.95a115.45 115.45 0 1 0 -230.9 0a115.45 115.45 0 1 0 230.9 0M593.74 754.95a49.48 49.48 0 1 0 -98.96 0a49.48 49.48 0 1 0 98.96 0"
        fill={MINT}
        fillRule="evenodd"
      />
      <path d="M230 345H530V417H230Z M230 495H450V567H230Z" fill={VIOLET} />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="topbar-brand">
      <Symbol />
      <span className="brand brand-name">
        Lattes<span className="brand-accent">Editor</span>
      </span>
    </span>
  );
}
