// Família dos estados vazios, construída na malha da marca: x = 8 px,
// subdivisão x/8 = 1 px. Hastes de x, anéis com diâmetros 1,75x e 0,75x,
// detalhes com a espessura das barras do logo e cortes a 45°.
// Referência: brand/construction/proportions.json. Tela de 12x = 96 px.

import type { ReactNode } from 'react';

const MINT = '#9EF2E2';
const DETAIL = (8 * 72) / 131.941162109375;

function Art({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="empty-art section-art"
      fill="currentColor"
      focusable="false"
      height="96"
      viewBox="0 0 96 96"
      width="96"
    >
      {children}
    </svg>
  );
}

/** O anel da marca: raio externo de 7 e interno de 3, escalado por inteiro. */
function Ring({
  accent = false,
  cx,
  cy,
  scale = 1,
}: {
  accent?: boolean;
  cx: number;
  cy: number;
  scale?: number;
}) {
  return (
    <path
      d="M7 0a7 7 0 1 0-14 0 7 7 0 1 0 14 0M3 0a3 3 0 1 0-6 0 3 3 0 1 0 6 0"
      fill={accent ? MINT : 'currentColor'}
      fillRule="evenodd"
      transform={`translate(${cx} ${cy}) scale(${scale})`}
    />
  );
}

/** As duas barras do logo, com o mesmo ritmo e a mesma relação de larguras. */
function Lines({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect height={DETAIL} width={(8 * 300) / 131.941162109375} />
      <rect height={DETAIL} width={(8 * 220) / 131.941162109375} y={(8 * 150) / 131.941162109375} />
    </g>
  );
}

/** Folhas com canto recortado, para uma seção sem desenho próprio. */
function Sheets() {
  return (
    <Art>
      <path d="M16 32h8v40h40v8H16z" />
      <path d="M28 16h36l16 16v36H28zm8 8v36h36V36H60V24z" fillRule="evenodd" />
      <path d="M68 16v12h12z" fill={MINT} />
      <Lines x={44} y={40} />
    </Art>
  );
}

const ART: Record<string, () => ReactNode> = {
  // Atuação: maleta, com fecho formado pelo anel da marca.
  atuacao: () => (
    <Art>
      <path d="M32 30V18h32v12h-8v-4H40v4z" />
      <path d="M16 32h64v18H16zm0 22h28v8h8v-8h28v24H16z" />
      <Ring accent cx={48} cy={51} />
    </Art>
  ),
  // Bancas: três pessoas, com a pessoa central em destaque.
  bancas: () => (
    <Art>
      <Ring cx={24} cy={31} />
      <Ring accent cx={48} cy={23} />
      <Ring cx={72} cy={31} />
      <path d="M14 50a10 10 0 0 1 20 0v6H14zM38 44a10 10 0 0 1 20 0v12H38zM62 50a10 10 0 0 1 20 0v6H62z" />
      <path d="M12 60h72v8H12zM20 72h8v8h-8zM68 72h8v8h-8z" />
    </Art>
  ),
  // Dados gerais: cartão com retrato e as duas barras do logo.
  'dados-gerais': () => (
    <Art>
      <path d="M12 24h64l8 8v40H12zm8 8v32h56V32z" fillRule="evenodd" />
      <Ring accent cx={34} cy={42} />
      <path d="M24 62v-2a10 10 0 0 1 20 0v2z" />
      <Lines x={52} y={40} />
    </Art>
  ),
  // Educação e popularização: megafone e ondas de divulgação.
  educacao: () => (
    <Art>
      <path
        d="M12 36h20l28-16v56L32 60H12zm8 8v8h12l20 11V33L32 44zM24 64h8l8 16H28z"
        fillRule="evenodd"
      />
      <path
        d="M68 35a18 18 0 0 1 0 26l-5-5a11 11 0 0 0 0-16zM77 25a32 32 0 0 1 0 46l-5-5a25 25 0 0 0 0-36z"
        fill={MINT}
      />
    </Art>
  ),
  // Eventos: calendário; o dia marcado usa o anel menta.
  eventos: () => (
    <Art>
      <path d="M16 24h64v56H16zm8 16v32h48V40z" fillRule="evenodd" />
      <path d="M28 16h8v16h-8zM60 16h8v16h-8z" />
      <path d="M30 48h8v6h-8zM46 48h8v6h-8zM30 62h8v6h-8zM46 62h8v6h-8z" />
      <Ring accent cx={65} cy={61} />
    </Art>
  ),
  // Formação: capelo geométrico, com borla em anel.
  formacao: () => (
    <Art>
      <path d="m8 36 40-20 32 16-40 20zm16 18 16 8 24-12v18L40 80 24 72z" />
      <path d="m48 24 32 16v20h-8V44L40 28z" fill={MINT} />
      <Ring accent cx={76} cy={67} />
    </Art>
  ),
  // Inovação: lâmpada vazada e filamento menta.
  inovacao: () => (
    <Art>
      <path
        d="M48 12a24 24 0 0 0-16 42c4 3 4 5 4 10v4h24v-4c0-5 0-7 4-10a24 24 0 0 0-16-42zm0 8a16 16 0 0 1 11 28c-5 4-7 8-7 12h-8c0-4-2-8-7-12a16 16 0 0 1 11-28z"
        fillRule="evenodd"
      />
      <Ring accent cx={48} cy={37} />
      <path d="M45 44h6v12h-6z" fill={MINT} />
      <path d="M36 72h24v4l-8 8h-8l-8-8z" />
    </Art>
  ),
  // Orientações: duas pessoas ligadas por um corte a 45°.
  orientacoes: () => (
    <Art>
      <Ring cx={32} cy={30} scale={1.5} />
      <path d="M16 76V64a16 16 0 0 1 32 0v12h-8V64a8 8 0 0 0-16 0v12z" />
      <Ring accent cx={68} cy={44} />
      <path d="M56 76V64a12 12 0 0 1 24 0v12h-8V64a4 4 0 0 0-8 0v12z" />
      <path d="M43 38h12l8 8H51z" fill={MINT} />
    </Art>
  ),
  // Outros dados: arquivo com puxador circular.
  outros: () => (
    <Art>
      <path d="M12 24h72v16H12zM20 44h56v36H20zm8 8v20h40V52z" fillRule="evenodd" />
      <path d="M68 24h16v16H52z" fill={MINT} />
      <Ring accent cx={48} cy={59} />
    </Art>
  ),
  // Patentes e registros: documento com selo e fitas.
  patentes: () => (
    <Art>
      <path d="M16 16h48l8 8v24h-8V24H24v40h24v8H16z" />
      <Lines x={32} y={33} />
      <path d="m54 71 8 3-6 10-4-6-7 1zM70 74l8-3 9 8-7-1-4 6z" />
      <Ring accent cx={66} cy={60} scale={1.75} />
    </Art>
  ),
  // Produções: livro aberto, com lombada e canto menta.
  producoes: () => (
    <Art>
      <path
        d="M12 20h24l12 8 12-8h24v52H60L48 80l-12-8H12zm8 8v36h16l8 5V35l-10-7zm32 7v34l8-5h16V28H62z"
        fillRule="evenodd"
      />
      <Lines x={24} y={40} />
      <path d="M60 40h12v4.3656H60zM60 49h9v4.3656h-9z" />
      <path d="M68 64h16v8H60z" fill={MINT} />
    </Art>
  ),
  // Projetos: prancheta, com o recorte e a conexão menta do logo.
  projetos: () => (
    <Art>
      <path d="M24 22h48v42h-8V30H32v42h32l-8 8H24z" />
      <path d="M38 16h20v16H38z" fill={MINT} />
      <path d="m36 40 3 3 5-5 3 3-8 8-6-6zm0 17 3 3 5-5 3 3-8 8-6-6z" />
      <rect height={DETAIL} width="12" x="52" y="41" />
      <rect height={DETAIL} width="9" x="52" y="58" />
      {/* Vão perpendicular de x/4 entre os cortes, como na marca. */}
      <path d="M66.8284 72H74v8H58.8284z" fill={MINT} />
      <Ring accent cx={78} cy={76} />
    </Art>
  ),
};

/** O desenho da seção; o das folhas para seção sem desenho próprio. */
export function SectionArt({ sectionId }: { sectionId: string }) {
  return <>{(ART[sectionId] ?? Sheets)()}</>;
}
