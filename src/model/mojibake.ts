// Texto que o próprio Lattes grava estragado, e que o editor preserva como
// veio até alguém pedir a correção:
//
// - UTF-8 lido como Latin-1: "EndereÃ§o" no lugar de "Endereço"
//   (REDE-SOCIAL na exportação de 17/08/2026);
// - entidades HTML escapadas duas vezes: o XML traz "&amp;quot;", e o valor
//   fica com "&quot;" literal (INFORMACOES-ADICIONAIS na mesma exportação).

const MOJIBAKE = /[ÃÂ][\u0080-¿]/;
const ENTITY = /&(quot|amp|lt|gt|apos|#\d+|#x[0-9a-f]+);/i;

function repairUtf8(value: string): string | undefined {
  if (!MOJIBAKE.test(value)) return undefined;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) return undefined;
    bytes[i] = code;
  }
  try {
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return fixed === value ? undefined : fixed;
  } catch {
    return undefined;
  }
}

const NAMED: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };

function decodeEntities(value: string): string | undefined {
  if (!ENTITY.test(value)) return undefined;
  return value.replace(/&(quot|amp|lt|gt|apos|#\d+|#x[0-9a-f]+);/gi, (_, body: string) => {
    const b = body.toLowerCase();
    if (b.startsWith('#x')) return String.fromCodePoint(parseInt(b.slice(2), 16));
    if (b.startsWith('#')) return String.fromCodePoint(parseInt(b.slice(1), 10));
    return NAMED[b]!;
  });
}

/** O texto consertado, ou undefined se não houver o que consertar. */
export function repairMojibake(value: string): string | undefined {
  const step1 = repairUtf8(value) ?? value;
  const step2 = decodeEntities(step1) ?? step1;
  return step2 === value ? undefined : step2;
}
