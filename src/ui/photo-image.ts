// A foto escolhida pela pessoa, pronta para o Lattes: recortada no centro em
// quadrado (como a foto que o Lattes guarda, 600 × 600), reduzida e em JPEG
// de até 70 kB, o limite da tela de envio. A qualidade desce até caber; se
// nem a menor qualidade cabe, o lado diminui.

import { PHOTO_MAX_BYTES } from '../bridge/photo.ts';

/** O lado da foto que o Lattes guarda hoje (lido em 14/10/2026). */
export const PHOTO_SIDE = 600;

const QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.45];
const SIDES = [PHOTO_SIDE, 480, 360];

/** O quadrado central de uma imagem w × h. */
export function centerSquare(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { size, sx: Math.round((w - size) / 2), sy: Math.round((h - size) / 2) };
}

/**
 * A primeira codificação que cabe no limite, da maior qualidade e do maior
 * lado para baixo; undefined se nenhuma cabe.
 */
export async function fitUnderLimit(
  encode: (side: number, quality: number) => Promise<Uint8Array>,
  maxSide: number,
  limit = PHOTO_MAX_BYTES,
): Promise<{ bytes: Uint8Array; quality: number; side: number } | undefined> {
  // O primeiro lado é o da foto do Lattes, ou o da imagem se ela for menor;
  // os seguintes, só os menores que ele, para nenhum lado ser tentado duas vezes.
  const first = Math.min(maxSide, PHOTO_SIDE);
  for (const side of [first, ...SIDES.filter((s) => s < first)]) {
    for (const quality of QUALITIES) {
      const bytes = await encode(side, quality);
      if (bytes.length <= limit) return { bytes, quality, side };
    }
  }
  return undefined;
}

export type PreparedPhoto =
  { bytes: Uint8Array; ok: true; side: number } | { ok: false; reason: string };

/** Lê a imagem escolhida e devolve o JPEG que vai ao Lattes, ou por que não deu. */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, reason: 'Não consegui ler essa imagem. Escolha um JPEG ou PNG.' };
  }
  const { size, sx, sy } = centerSquare(bitmap.width, bitmap.height);
  if (size < 120) {
    bitmap.close();
    return { ok: false, reason: 'A imagem é pequena demais para foto de currículo.' };
  }
  const encode = async (side: number, quality: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas sem contexto 2d');
    // Fundo branco: PNG com transparência não vira preto no JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, side, side);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, side, side);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) throw new Error('JPEG não gerado');
    return new Uint8Array(await blob.arrayBuffer());
  };
  try {
    const fit = await fitUnderLimit(encode, size);
    if (!fit) return { ok: false, reason: 'Não consegui deixar a foto com até 70 kB.' };
    return { bytes: fit.bytes, ok: true, side: fit.side };
  } catch {
    return { ok: false, reason: 'Não consegui converter a imagem para JPEG.' };
  } finally {
    bitmap.close();
  }
}
