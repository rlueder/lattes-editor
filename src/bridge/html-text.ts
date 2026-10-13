// Texto de páginas do Lattes, lidas como HTML cru (no runner da extensão e
// nos testes, sem DOM): entidades do Latin-1 resolvidas, tags removidas.

const ENTITIES: Record<string, string> = {
  aacute: 'á',
  Aacute: 'Á',
  acirc: 'â',
  agrave: 'à',
  amp: '&',
  atilde: 'ã',
  auml: 'ä',
  Auml: 'Ä',
  ccedil: 'ç',
  Ccedil: 'Ç',
  eacute: 'é',
  Eacute: 'É',
  ecirc: 'ê',
  gt: '>',
  iacute: 'í',
  Iacute: 'Í',
  lt: '<',
  nbsp: ' ',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  quot: '"',
  uacute: 'ú',
  Uacute: 'Ú',
  uuml: 'ü',
};

/**
 * Uma passada só, para "&amp;#65;" virar "&#65;" e parar aí (sem decodificar
 * duas vezes). Nomes desconhecidos, inclusive os do Object.prototype, ficam
 * como estão; números fora do Unicode também.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi,
    (m, dec?: string, hex?: string, name?: string) => {
      if (name !== undefined) return Object.hasOwn(ENTITIES, name) ? ENTITIES[name]! : m;
      const code = dec !== undefined ? Number(dec) : parseInt(hex!, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    },
  );
}

/** Sem scripts e estilos, que não são texto da página. */
function withoutCode(html: string): string {
  return html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
}

/** O texto todo numa linha só, com espaços simples. */
export function plainText(html: string): string {
  return decodeHtmlEntities(withoutCode(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
}

/**
 * O texto em linhas, quebrando nos elementos de bloco e no <br>, como o
 * navegador mostra a página. Linhas vazias saem.
 */
export function htmlLines(html: string): string[] {
  return decodeHtmlEntities(
    withoutCode(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|h[1-6]|ul|ol|table|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Sem acento nem caixa, com espaços simples, para comparar rótulos. O mesmo
 * que fold() em src/labels/labels.ts, sem trazer os rótulos para o pacote da
 * extensão.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
