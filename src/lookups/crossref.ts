// Busca por DOI no Crossref (api.crossref.org, CORS aberto) e mapeamento do
// registro para os campos de um item do Lattes.
//
// Privacidade: a requisição leva só o DOI. O guia sugeria o parâmetro
// "mailto" do Crossref, mas a definição de pronto do v1 proíbe qualquer dado
// além do DOI, e essa regra vale mais.
//
// Formato da resposta conferido em 11/10/2026 com 10.1038/nature14539 e um
// proceedings-article: title, container-title, author[given/family],
// issued.date-parts, volume, issue, page, ISSN/issn-type, ISBN, publisher,
// language, event{name, location, start}.

import { suggestCitation } from '../forms/citation.ts';
import { fold } from '../labels/labels.ts';
import { type Author, itemPart } from '../model/production.ts';
import { setAttr, type XElement } from '../model/xml.ts';

export interface CrossrefWork {
  author?: { family?: string; given?: string; name?: string }[];
  'container-title'?: string[];
  DOI: string;
  event?: { location?: string; name?: string; start?: { 'date-parts'?: number[][] } };
  ISBN?: string[];
  ISSN?: string[];
  'issn-type'?: { type: string; value: string }[];
  issue?: string;
  issued?: { 'date-parts'?: (number | null)[][] };
  language?: string;
  page?: string;
  publisher?: string;
  title?: string[];
  type: string;
  volume?: string;
}

export class DoiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DoiError';
  }
}

/** Aceita "10.xxxx/…", "doi:10.…" ou a URL do doi.org; devolve o DOI puro. */
export function normalizeDoi(input: string): string | undefined {
  const match = /(10\.\d{4,9}\/\S+)/.exec(input.trim());
  return match?.[1]?.replace(/[.,;]$/, '');
}

export async function fetchCrossref(
  doi: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CrossrefWork> {
  const clean = normalizeDoi(doi);
  if (!clean) throw new DoiError('DOI inválido. O formato é 10.xxxx/…');
  let response: Response;
  try {
    response = await fetchImpl(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
  } catch {
    throw new DoiError('Sem conexão com o Crossref. Confira a internet e tente de novo.');
  }
  if (response.status === 404) throw new DoiError('O Crossref não conhece esse DOI.');
  if (!response.ok) throw new DoiError(`O Crossref respondeu com erro (${response.status}).`);
  const body = (await response.json()) as { message?: CrossrefWork };
  if (!body.message) throw new DoiError('Resposta inesperada do Crossref.');
  return body.message;
}

/** Tipo de item do Lattes que corresponde ao tipo do Crossref. */
export function itemNameFor(work: CrossrefWork): string | undefined {
  switch (work.type) {
    case 'journal-article':
      return 'ARTIGO-PUBLICADO';
    case 'proceedings-article':
      return 'TRABALHO-EM-EVENTOS';
    case 'book-chapter':
    case 'book-section':
    case 'book-part':
      return 'CAPITULO-DE-LIVRO-PUBLICADO';
    case 'book':
    case 'monograph':
    case 'edited-book':
      return 'LIVRO-PUBLICADO-OU-ORGANIZADO';
    default:
      return undefined;
  }
}

/** IDIOMA no Lattes é texto em português ("Português" no item aceito em 10/10/2026). */
const LANGUAGES: Record<string, string> = {
  de: 'Alemão',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  it: 'Italiano',
  pt: 'Português',
};

const first = (list?: string[] | null) => list?.find((v) => v.trim())?.trim();
/** container-title pode trazer série e título; o mais específico vem por último. */
const last = (list?: string[] | null) =>
  list
    ?.filter((v) => v.trim())
    .at(-1)
    ?.trim();

function year(work: CrossrefWork): string | undefined {
  const y = work.issued?.['date-parts']?.[0]?.[0];
  return typeof y === 'number' ? String(y) : undefined;
}

function pages(page?: string): [string | undefined, string | undefined] {
  if (!page) return [undefined, undefined];
  const [start, end] = page.split(/[-–]/).map((p) => p.trim());
  return [start || undefined, end || undefined];
}

function issn(work: CrossrefWork): string | undefined {
  return work['issn-type']?.find((i) => i.type === 'print')?.value ?? first(work.ISSN);
}

/** Atributos a preencher, por parte do item, para cada tipo suportado. */
function fieldsFor(
  itemName: string,
  work: CrossrefWork,
): Record<'b' | 'd', Record<string, string | undefined>> {
  const [pageStart, pagesEnd] = pages(work.page);
  const title = first(work.title);
  const container = last(work['container-title']);
  const isbn = first(work.ISBN);
  const language = work.language ? LANGUAGES[work.language.slice(0, 2).toLowerCase()] : undefined;
  const common = { DOI: work.DOI, IDIOMA: language };
  switch (itemName) {
    case 'ARTIGO-PUBLICADO':
      return {
        b: { ...common, 'ANO-DO-ARTIGO': year(work), 'TITULO-DO-ARTIGO': title },
        d: {
          FASCICULO: work.issue,
          ISSN: issn(work),
          'PAGINA-FINAL': pagesEnd,
          'PAGINA-INICIAL': pageStart,
          'TITULO-DO-PERIODICO-OU-REVISTA': container,
          VOLUME: work.volume,
        },
      };
    case 'TRABALHO-EM-EVENTOS': {
      const eventYear = work.event?.start?.['date-parts']?.[0]?.[0];
      return {
        b: { ...common, 'ANO-DO-TRABALHO': year(work), 'TITULO-DO-TRABALHO': title },
        d: {
          'ANO-DE-REALIZACAO': typeof eventYear === 'number' ? String(eventYear) : year(work),
          'CIDADE-DO-EVENTO': work.event?.location?.split(',')[0]?.trim(),
          ISBN: isbn,
          'NOME-DA-EDITORA': work.publisher,
          'NOME-DO-EVENTO': work.event?.name ?? container,
          'PAGINA-FINAL': pagesEnd,
          'PAGINA-INICIAL': pageStart,
          'TITULO-DOS-ANAIS-OU-PROCEEDINGS': container,
          VOLUME: work.volume,
        },
      };
    }
    case 'CAPITULO-DE-LIVRO-PUBLICADO':
      return {
        b: { ...common, ANO: year(work), 'TITULO-DO-CAPITULO-DO-LIVRO': title },
        d: {
          ISBN: isbn,
          'NOME-DA-EDITORA': work.publisher,
          'PAGINA-FINAL': pagesEnd,
          'PAGINA-INICIAL': pageStart,
          'TITULO-DO-LIVRO': container,
        },
      };
    case 'LIVRO-PUBLICADO-OU-ORGANIZADO':
      return {
        b: { ...common, ANO: year(work), 'TITULO-DO-LIVRO': title },
        d: { ISBN: isbn, 'NOME-DA-EDITORA': work.publisher },
      };
    default:
      return { b: {}, d: {} };
  }
}

/** Autores do Crossref, trocados pelos já conhecidos (com ID Lattes) quando o nome bate. */
export function crossrefAuthors(work: CrossrefWork, known: Author[]): Author[] {
  const byName = new Map(known.map((a) => [fold(a.name).replace(/\s+/g, ' ').trim(), a]));
  return (work.author ?? [])
    .map((a) => (a.name ?? [a.given, a.family].filter(Boolean).join(' ')).trim())
    .filter(Boolean)
    .map(
      (name) => byName.get(fold(name)) ?? { citation: suggestCitation(name), lattesId: '', name },
    );
}

/**
 * Preenche o item com o registro do Crossref, só nos atributos que o tipo
 * tem e onde o Crossref trouxe valor. Devolve os nomes preenchidos.
 */
export function applyCrossref(item: XElement, work: CrossrefWork): string[] {
  const fields = fieldsFor(item.name, work);
  const filled: string[] = [];
  for (const [key, part] of [
    ['b', itemPart(item, 'DADOS-BASICOS')],
    ['d', itemPart(item, 'DETALHAMENTO')],
  ] as const) {
    if (!part) continue;
    for (const [attr, value] of Object.entries(fields[key])) {
      if (!value || !part.attrs.some((a) => a.name === attr)) continue;
      setAttr(part, attr, value);
      filled.push(attr);
    }
  }
  return filled;
}
