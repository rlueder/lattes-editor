// Referências da produção no formato da ABNT NBR 6023:2018.
//
// A norma é paga; as regras usadas aqui foram conferidas no guia do Sistema
// de Bibliotecas da UFU, que cita a NBR 6023:2018 (corrigida em 2020):
// https://bibliotecas.ufu.br/sites/bibliotecas.ufu.br/files/media/imagem/referencias_30_out._2024_1.pdf
// (acesso em 11/10/2026). Confirmado nele:
//   - entrada pelo SOBRENOME em maiúsculas, separado do prenome (por extenso ou
//     abreviado) por vírgula; autores separados por ponto e vírgula;
//   - de quatro autores em diante, convém indicar todos; também se pode dar
//     só o primeiro seguido de "et al.";
//   - sobrenomes como "RIBEIRO JUNIOR" entram juntos (exemplo do guia);
//   - o título destacado (negrito, itálico ou sublinhado) de forma
//     padronizada; no artigo, destaca-se o título do periódico;
//   - modelos de artigo, capítulo ("In:", organizadores com "(org.)"),
//     trabalho em evento ("In: NOME DO EVENTO, ano, local. Anais [...].") e
//     livro ("N. ed. Local: Editora, data.");
//   - "[S. l.]", "[s. n.]" e "[S. l.: s. n.]" na falta de local e editora, e
//     "[s. l.]" em minúsculas dentro da referência de periódico;
//   - "DOI: https://doi.org/..." e meses abreviados (jan., fev., abr., maio,
//     jun., jul., ago., set., out., nov.).
// NÃO confirmado no guia (seguido por analogia e marcado no código):
//   - qual elemento se destaca em capítulo e trabalho em evento (aqui, o título
//     do livro e o dos anais, por analogia com o periódico);
//   - as abreviaturas "mar." e "dez.";
//   - o modelo de texto em jornal ou revista (feito como o de periódico);
//   - a omissão de partículas (da, de, dos…) nas iniciais do prenome.

import type { Author } from '../model/production.ts';

/** Um trecho de referência; `strong` marca o elemento destacado (negrito). */
export interface Segment {
  strong?: boolean;
  text: string;
}

const PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'di', 'du', 'van', 'von', 'del']);
const SURNAME_SUFFIXES = new Set([
  'filho',
  'filha',
  'neto',
  'neta',
  'sobrinho',
  'sobrinha',
  'junior',
  'júnior',
]);

/** Iniciais dos prenomes ("Rafael Monteiro" → "R. M."), sem partículas (não confirmado). */
function initialsOf(given: string[]): string {
  return given
    .filter((w) => !PARTICLES.has(w.toLowerCase()))
    .map((w) => `${w[0]!.toUpperCase()}.`)
    .join(' ');
}

/**
 * Nome do autor como entrada ABNT: "SOBRENOME, I. N.". Sai do nome completo,
 * para que todas as entradas sigam o mesmo padrão (prenome abreviado); sem
 * nome completo, usa a primeira forma de citação do Lattes.
 */
export function abntAuthor(author: Pick<Author, 'citation' | 'name'>): string {
  const words = author.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const last = words.at(-1)!;
    const takeTwo = SURNAME_SUFFIXES.has(last.toLowerCase()) && words.length >= 3;
    const surname = (takeTwo ? words.slice(-2) : [last]).join(' ');
    const given = words.slice(0, takeTwo ? -2 : -1);
    return `${surname.toLocaleUpperCase('pt-BR')}, ${initialsOf(given)}`;
  }
  const citation = author.citation.split(';')[0]?.trim() ?? '';
  if (citation.includes(',')) {
    const [surname, rest] = [
      citation.slice(0, citation.indexOf(',')),
      citation.slice(citation.indexOf(',') + 1),
    ];
    return `${surname.trim().toLocaleUpperCase('pt-BR')}, ${rest.trim()}`;
  }
  return (citation || author.name).toLocaleUpperCase('pt-BR');
}

/** Lista de autores separada por ponto e vírgula; `etAl` encurta de quatro em diante. */
export function abntAuthors(
  authors: Pick<Author, 'citation' | 'name'>[],
  { etAl = false }: { etAl?: boolean } = {},
): string {
  const names = authors.map(abntAuthor).filter(Boolean);
  if (names.length === 0) return '';
  if (etAl && names.length >= 4) return `${names[0]} et al.`;
  return names.join('; ');
}

const MONTHS = [
  'jan.',
  'fev.',
  'mar.', // não confirmado no guia
  'abr.',
  'maio',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.', // não confirmado no guia
];

/** Data do Lattes (DDMMAAAA) como "9 jun. 2006"; só o ano se faltar o resto. */
export function abntDate(ddmmyyyy: string | undefined, year?: string): string {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(ddmmyyyy ?? '');
  if (!m) return year ?? '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return m[3]!;
  return `${Number(m[1])} ${month} ${m[3]}`;
}

/** "p. 71-81", "p. 71" ou vazio. */
export function abntPages(first?: string, last?: string): string {
  const a = first?.trim();
  const b = last?.trim();
  if (a && b && a !== b) return `p. ${a}-${b}`;
  if (a || b) return `p. ${a || b}`;
  return '';
}

/** "Local: Editora", com [S. l.], [s. n.] ou [S. l.: s. n.] no que faltar. */
export function abntImprint(city?: string, publisher?: string): string {
  const c = city?.trim();
  const p = publisher?.trim();
  if (!c && !p) return '[S. l.: s. n.]';
  return `${c || '[S. l.]'}: ${p || '[s. n.]'}`;
}

export function abntDoi(doi?: string): string {
  const d = doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return d ? `DOI: https://doi.org/${d}` : '';
}

/** Termina com ponto, sem duplicar o de uma abreviatura ("et al.", "R."). */
export function withPeriod(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

/** Junta partes não vazias com vírgula. */
export function commaJoin(parts: (string | undefined)[]): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

/** Monta uma referência a partir de blocos já pontuados, separados por espaço. */
export function joinSegments(parts: (Segment | string | undefined)[]): Segment[] {
  const out: Segment[] = [];
  for (const part of parts) {
    if (part === undefined) continue;
    const seg = typeof part === 'string' ? { text: part } : part;
    if (!seg.text.trim()) continue;
    if (out.length > 0) out.push({ text: ' ' });
    out.push(seg);
  }
  return out;
}

/** Texto corrido de uma referência (para testes, cópia e leitores de tela). */
export function referenceText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('');
}
