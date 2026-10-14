// Foto em mosaico para o modo de privacidade: a imagem é reduzida a poucos
// pixels num canvas e ampliada sem suavizar, em tons de cinza (filtro no CSS).
// Dá para ver que há uma foto, não quem é. O canvas só desenha, nunca lê os
// pixels de volta.

import { useEffect, useRef } from 'react';

const CELLS = 12;

export function PixelPhoto({
  className,
  onError,
  onLoad,
  src,
}: {
  className?: string;
  onError?: () => void;
  onLoad?: () => void;
  src: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // As funções mudam a cada render; a imagem só recarrega quando o endereço muda.
  const handlers = useRef({ onError, onLoad });
  handlers.current = { onError, onLoad };
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      const ctx = ref.current?.getContext('2d');
      if (!alive || !ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, CELLS, CELLS);
      handlers.current.onLoad?.();
    };
    // Sem isto, uma foto que não chegava deixava o canvas vazio para sempre.
    img.onerror = () => {
      if (alive) handlers.current.onError?.();
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={['pixel-photo', className].filter(Boolean).join(' ')}
      height={CELLS}
      width={CELLS}
    />
  );
}
