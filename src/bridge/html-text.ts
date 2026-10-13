// Texto de páginas do Lattes, lidas como HTML cru (no runner da extensão e
// nos testes, sem DOM): entidades do Latin-1 resolvidas, tags removidas.

/**
 * Entidades nomeadas: todas as do Latin-1 (160 a 255), que o Lattes usa em
 * títulos em maiúsculas ("A&Ccedil;&Atilde;O"), mais as de pontuação comuns.
 * Guardadas como ponto de código.
 */
const ENTITIES: Record<string, number> = {
  Aacute: 193,
  aacute: 225,
  Acirc: 194,
  acirc: 226,
  acute: 180,
  AElig: 198,
  aelig: 230,
  Agrave: 192,
  agrave: 224,
  amp: 38,
  apos: 39,
  Aring: 197,
  aring: 229,
  Atilde: 195,
  atilde: 227,
  Auml: 196,
  auml: 228,
  brvbar: 166,
  bull: 8226,
  Ccedil: 199,
  ccedil: 231,
  cedil: 184,
  cent: 162,
  copy: 169,
  curren: 164,
  deg: 176,
  divide: 247,
  Eacute: 201,
  eacute: 233,
  Ecirc: 202,
  ecirc: 234,
  Egrave: 200,
  egrave: 232,
  ETH: 208,
  eth: 240,
  Euml: 203,
  euml: 235,
  euro: 8364,
  frac12: 189,
  frac14: 188,
  frac34: 190,
  gt: 62,
  hellip: 8230,
  Iacute: 205,
  iacute: 237,
  Icirc: 206,
  icirc: 238,
  iexcl: 161,
  Igrave: 204,
  igrave: 236,
  iquest: 191,
  Iuml: 207,
  iuml: 239,
  laquo: 171,
  ldquo: 8220,
  lsquo: 8216,
  lt: 60,
  macr: 175,
  mdash: 8212,
  micro: 181,
  middot: 183,
  nbsp: 160,
  ndash: 8211,
  not: 172,
  Ntilde: 209,
  ntilde: 241,
  Oacute: 211,
  oacute: 243,
  Ocirc: 212,
  ocirc: 244,
  Ograve: 210,
  ograve: 242,
  ordf: 170,
  ordm: 186,
  Oslash: 216,
  oslash: 248,
  Otilde: 213,
  otilde: 245,
  Ouml: 214,
  ouml: 246,
  para: 182,
  plusmn: 177,
  pound: 163,
  quot: 34,
  raquo: 187,
  rdquo: 8221,
  reg: 174,
  rsquo: 8217,
  sect: 167,
  shy: 173,
  sup1: 185,
  sup2: 178,
  sup3: 179,
  szlig: 223,
  THORN: 222,
  thorn: 254,
  times: 215,
  Uacute: 218,
  uacute: 250,
  Ucirc: 219,
  ucirc: 251,
  Ugrave: 217,
  ugrave: 249,
  uml: 168,
  Uuml: 220,
  uuml: 252,
  Yacute: 221,
  yacute: 253,
  yen: 165,
  yuml: 255,
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
      if (name !== undefined)
        return Object.hasOwn(ENTITIES, name) ? String.fromCodePoint(ENTITIES[name]!) : m;
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
