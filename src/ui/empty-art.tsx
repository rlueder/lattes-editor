// Desenho em traço do estado vazio de cada seção, todos no mesmo estilo
// (96 × 96, traço de 1,25, cor secundária), para cada seção ter o seu.

import type { ReactNode } from 'react';

function Art({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="empty-art"
      fill="none"
      height="96"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.25"
      viewBox="0 0 96 96"
      width="96"
    >
      {children}
    </svg>
  );
}

/** Folhas de currículo empilhadas: o desenho de sempre, para o que não tem outro. */
function Sheets() {
  return (
    <Art>
      <path d="M22 70 48 84l26-14" />
      <path d="M22 64 48 78l26-14" />
      <path d="M22 58 48 72l26-14L48 44 22 58Z" />
      <path d="M33 22h30l7 7v27H33V22Z" transform="rotate(-8 51 39)" />
      <path d="M40 32h16M40 38h22M40 44h18" transform="rotate(-8 51 39)" />
    </Art>
  );
}

const ART: Record<string, () => ReactNode> = {
  // Atuação: maleta.
  atuacao: () => (
    <Art>
      <rect height="40" rx="4" width="60" x="18" y="34" />
      <path d="M38 34v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" />
      <path d="M18 50h60M44 50v6h8v-6" />
    </Art>
  ),
  // Bancas: três pessoas atrás de uma mesa.
  bancas: () => (
    <Art>
      <circle cx="30" cy="34" r="6" />
      <circle cx="48" cy="30" r="6" />
      <circle cx="66" cy="34" r="6" />
      <path d="M22 54c0-6 4-10 8-10s8 4 8 10M40 50c0-7 4-12 8-12s8 5 8 12M58 54c0-6 4-10 8-10s8 4 8 10" />
      <path d="M16 56h64v6H16zM24 62v14M72 62v14" />
    </Art>
  ),
  // Dados gerais: cartão de identificação.
  'dados-gerais': () => (
    <Art>
      <rect height="48" rx="5" width="68" x="14" y="24" />
      <circle cx="34" cy="44" r="7" />
      <path d="M24 62c1-6 5-9 10-9s9 3 10 9" />
      <path d="M52 40h20M52 48h16M52 56h12" />
    </Art>
  ),
  // Educação e popularização: alto-falante.
  educacao: () => (
    <Art>
      <path d="M22 42v12h10l20 12V30L32 42H22Z" />
      <path d="M32 54v14h8V58" />
      <path d="M62 40c3 2 4 5 4 8s-1 6-4 8M68 34c5 4 7 9 7 14s-2 10-7 14" />
    </Art>
  ),
  // Eventos: calendário com um dia marcado.
  eventos: () => (
    <Art>
      <rect height="50" rx="5" width="60" x="18" y="24" />
      <path d="M18 38h60M32 18v12M64 18v12" />
      <path d="M30 50h6M45 50h6M60 50h6M30 62h6M45 62h6" />
      <circle cx="63" cy="62" r="4" />
    </Art>
  ),
  // Formação: capelo.
  formacao: () => (
    <Art>
      <path d="M12 40 48 24l36 16-36 16-36-16Z" />
      <path d="M28 47v14c0 4 9 8 20 8s20-4 20-8V47" />
      <path d="M84 40v18" />
      <circle cx="84" cy="61" r="2.5" />
    </Art>
  ),
  // Inovação: lâmpada.
  inovacao: () => (
    <Art>
      <path d="M48 18a20 20 0 0 0-12 36c3 2 4 5 4 8v4h16v-4c0-3 1-6 4-8a20 20 0 0 0-12-36Z" />
      <path d="M40 72h16M42 78h12" />
      <path d="M44 50l4-8 4 8" />
    </Art>
  ),
  // Orientações: duas pessoas, a que orienta e a orientada.
  orientacoes: () => (
    <Art>
      <circle cx="36" cy="32" r="9" />
      <path d="M20 70c0-12 7-20 16-20s16 8 16 20" />
      <circle cx="62" cy="42" r="7" />
      <path d="M50 74c1-9 6-15 12-15s11 6 12 15" />
    </Art>
  ),
  // Outros dados: caixa de arquivo.
  outros: () => (
    <Art>
      <path d="M16 30h64v10H16zM20 40h56v34H20z" />
      <path d="M40 50h16" />
    </Art>
  ),
  // Patentes e registros: certificado com selo.
  patentes: () => (
    <Art>
      <rect height="48" rx="3" width="56" x="16" y="18" />
      <path d="M26 30h36M26 38h28M26 46h20" />
      <circle cx="64" cy="64" r="9" />
      <path d="M58 71 55 82l9-5 9 5-3-11" />
    </Art>
  ),
  // Produções: livro aberto.
  producoes: () => (
    <Art>
      <path d="M48 30c-8-6-20-8-32-6v46c12-2 24 0 32 6 8-6 20-8 32-6V24c-12-2-24 0-32 6Z" />
      <path d="M48 30v46" />
      <path d="M24 38h16M24 46h16M56 38h16M56 46h16" />
    </Art>
  ),
  // Projetos: prancheta com lista.
  projetos: () => (
    <Art>
      <rect height="58" rx="4" width="48" x="24" y="20" />
      <path d="M38 16h20v10H38z" />
      <path d="m32 40 3 3 6-6M46 40h18M32 54l3 3 6-6M46 54h18M32 68h8M46 68h14" />
    </Art>
  ),
};

/** O desenho da seção; o das folhas para seção sem desenho próprio. */
export function SectionArt({ sectionId }: { sectionId: string }) {
  return <>{(ART[sectionId] ?? Sheets)()}</>;
}
