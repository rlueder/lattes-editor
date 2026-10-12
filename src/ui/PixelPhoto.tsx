// Foto em mosaico para o modo de privacidade: a imagem é reduzida a poucos
// pixels num canvas e ampliada sem suavizar, em tons de cinza (filtro no CSS).
// Dá para ver que há uma foto, não quem é. O canvas só desenha, nunca lê os
// pixels de volta.

import { useEffect, useRef } from 'react';

const CELLS = 12;

export function PixelPhoto({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const ctx = ref.current?.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, CELLS, CELLS);
    };
    img.src = src;
  }, [src]);
  return (
    <canvas ref={ref} aria-hidden="true" className="pixel-photo" height={CELLS} width={CELLS} />
  );
}
