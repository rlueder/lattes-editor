// Geometria e cores comuns dos gráficos do Panorama.

export const SERIES = ['var(--pano-1)', 'var(--pano-2)', 'var(--pano-3)', 'var(--pano-4)'];

/** Barra com os cantos de cima arredondados (a base fica reta, no eixo). */
export function topRound(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const k = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + k}Q${x},${y} ${x + k},${y}H${x + w - k}Q${x + w},${y} ${x + w},${y + k}V${y + h}Z`;
}

/** Barra horizontal com a ponta direita arredondada. */
export function rightRound(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const k = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - k}Q${x + w},${y} ${x + w},${y + k}V${y + h - k}Q${x + w},${y + h} ${x + w - k},${y + h}H${x}Z`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
