import { useMemo } from 'react';

import { qrMatrix, qrPath } from './qr.ts';

/** QR em SVG, preto no branco, com margem de 4 módulos. */
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
      aria-label={label}
      className={className}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
    >
      <rect fill="#fff" height={size + 8} width={size + 8} x={-4} y={-4} />
      <path d={path} fill="#000" />
    </svg>
  );
}
