import { useMemo } from 'react';

import { qrMatrix, qrPath } from './qr.ts';

/** QR em SVG, preto no branco, com margem de 4 módulos. Rótulo vazio: decorativo. */
export function QrCode({
  className,
  label,
  text,
}: {
  className?: string;
  label: string;
  text: string;
}) {
  const { path, size } = useMemo(() => {
    const m = qrMatrix(text);
    return { path: qrPath(m), size: m.length };
  }, [text]);
  return (
    <svg
      // Sem rótulo, é decoração de um botão que já se descreve.
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
      className={className}
      role={label ? 'img' : undefined}
      shapeRendering="crispEdges"
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
    >
      <rect fill="#fff" height={size + 8} width={size + 8} x={-4} y={-4} />
      <path d={path} fill="#000" />
    </svg>
  );
}
