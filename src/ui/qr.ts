// Código QR do endereço público do currículo, gerado no navegador com a
// biblioteca qrcode-generator (MIT, sem dependências). Nada sai da máquina.

import qrcode from 'qrcode-generator';

/** Matriz de módulos (true = escuro), com correção de erro média (M). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Caminho SVG dos módulos escuros, um quadrado por módulo, numa grade 1×1. */
export function qrPath(matrix: boolean[][]): string {
  const parts: string[] = [];
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) parts.push(`M${c} ${r}h1v1h-1z`);
    }),
  );
  return parts.join('');
}

/** SVG completo, com a margem de 4 módulos que a norma do QR pede. */
export function qrSvg(text: string, quiet = 4): string {
  const m = qrMatrix(text);
  const size = m.length + quiet * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-quiet} ${-quiet} ${size} ${size}" ` +
    `shape-rendering="crispEdges"><rect x="${-quiet}" y="${-quiet}" width="${size}" ` +
    `height="${size}" fill="#fff"/><path d="${qrPath(m)}" fill="#000"/></svg>`
  );
}
