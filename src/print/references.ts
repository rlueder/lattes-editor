// Referência ABNT de um item de produção do XML do Lattes. As regras e a
// fonte em que foram conferidas estão em abnt.ts.

import { itemPart, readAuthors } from '../model/production.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import {
  abntAuthors,
  abntDate,
  abntDoi,
  abntImprint,
  abntPages,
  commaJoin,
  joinSegments,
  type Segment,
  withPeriod,
} from './abnt.ts';

export interface ReferenceOptions {
  /** Usa o título em inglês do item quando ele existe. */
  english?: boolean;
  /** De quatro autores em diante, só o primeiro e "et al.". */
  etAl?: boolean;
}

/** Tipos com modelo próprio; o resto cai no modelo genérico. */
export const REFERENCE_TYPES = [
  'ARTIGO-PUBLICADO',
  'ARTIGO-ACEITO-PARA-PUBLICACAO',
  'TRABALHO-EM-EVENTOS',
  'LIVRO-PUBLICADO-OU-ORGANIZADO',
  'CAPITULO-DE-LIVRO-PUBLICADO',
  'TEXTO-EM-JORNAL-OU-REVISTA',
] as const;

/** Um item tem referência quando é produção (tem DADOS-BASICOS e, em geral, autores). */
export function hasReference(item: XElement): boolean {
  return itemPart(item, 'DADOS-BASICOS') !== undefined;
}

function attr(el: XElement | undefined, name: string): string | undefined {
  const v = el && getAttr(el, name)?.trim();
  return v || undefined;
}

/** Primeiro atributo TITULO-* das partes básicas (ou a versão em inglês). */
function titleOf(basics: XElement | undefined, english: boolean): string | undefined {
  if (!basics) return undefined;
  const base = basics.attrs.find(
    (a) => a.name.startsWith('TITULO') && !a.name.endsWith('INGLES') && a.value.trim(),
  );
  if (english && base) {
    const en = attr(basics, `${base.name}-INGLES`);
    if (en) return en;
  }
  return base?.value.trim();
}

/** Ano do item: ANO-DO-*, ANO. */
function yearOf(basics: XElement | undefined): string | undefined {
  if (!basics) return undefined;
  return basics.attrs.find((a) => /^ANO($|-DO-)/.test(a.name) && a.value.trim())?.value.trim();
}

function authorsBlock(item: XElement, opts: ReferenceOptions, organizer = false): string {
  const names = abntAuthors(readAuthors(item), { etAl: opts.etAl });
  if (!names) return '';
  return withPeriod(organizer ? `${names} (org.)` : names);
}

function edition(details: XElement | undefined): string | undefined {
  const n = attr(details, 'NUMERO-DA-EDICAO-REVISAO');
  return n && /^\d+$/.test(n) ? `${n}. ed.` : undefined;
}

/** Referência ABNT do item, em trechos (o destacado vai em negrito). */
export function referenceFor(item: XElement, opts: ReferenceOptions = {}): Segment[] {
  const basics = itemPart(item, 'DADOS-BASICOS');
  const details = itemPart(item, 'DETALHAMENTO');
  const title = titleOf(basics, opts.english ?? false);
  const year = yearOf(basics);
  const doi = abntDoi(attr(basics, 'DOI'));

  switch (item.name) {
    case 'ARTIGO-PUBLICADO':
    case 'ARTIGO-ACEITO-PARA-PUBLICACAO': {
      // AUTOR. Título. Periódico, Local, v., n., p., data. (guia UFU, p. 20-22)
      const journal = attr(details, 'TITULO-DO-PERIODICO-OU-REVISTA');
      const volume = attr(details, 'VOLUME');
      const issue = attr(details, 'FASCICULO');
      const tail = commaJoin([
        attr(details, 'LOCAL-DE-PUBLICACAO') ?? '[s. l.]',
        volume && `v. ${volume}`,
        issue && `n. ${issue}`,
        abntPages(attr(details, 'PAGINA-INICIAL'), attr(details, 'PAGINA-FINAL')),
        year,
      ]);
      return joinSegments([
        authorsBlock(item, opts),
        title && withPeriod(title),
        journal ? { strong: true, text: `${journal},` } : undefined,
        withPeriod(tail),
        doi && withPeriod(doi),
      ]);
    }
    case 'TRABALHO-EM-EVENTOS': {
      // AUTOR. Título. In: NOME DO EVENTO, ano, local. Anais [...]. Local: Editora, data. p.
      // (guia UFU, p. 17). Destacar o título dos anais: por analogia, não confirmado.
      const event = attr(details, 'NOME-DO-EVENTO');
      const proceedings = attr(details, 'TITULO-DOS-ANAIS-OU-PROCEEDINGS');
      const held = commaJoin([
        event?.toLocaleUpperCase('pt-BR'),
        attr(details, 'ANO-DE-REALIZACAO'),
        attr(details, 'CIDADE-DO-EVENTO'),
      ]);
      const pages = abntPages(attr(details, 'PAGINA-INICIAL'), attr(details, 'PAGINA-FINAL'));
      return joinSegments([
        authorsBlock(item, opts),
        title && withPeriod(title),
        held && `In: ${withPeriod(held)}`,
        proceedings ? { strong: true, text: withPeriod(proceedings) } : undefined,
        withPeriod(
          commaJoin([
            abntImprint(attr(details, 'CIDADE-DA-EDITORA'), attr(details, 'NOME-DA-EDITORA')),
            year,
          ]),
        ),
        pages && withPeriod(pages),
        doi && withPeriod(doi),
      ]);
    }
    case 'LIVRO-PUBLICADO-OU-ORGANIZADO': {
      // AUTOR. Título. edição. Local: Editora, data. (guia UFU, p. 3 e 12)
      const organized = attr(basics, 'TIPO') === 'LIVRO_ORGANIZADO_OU_EDICAO';
      return joinSegments([
        authorsBlock(item, opts, organized),
        title ? { strong: true, text: withPeriod(title) } : undefined,
        edition(details),
        withPeriod(
          commaJoin([
            abntImprint(attr(details, 'CIDADE-DA-EDITORA'), attr(details, 'NOME-DA-EDITORA')),
            year,
          ]),
        ),
        doi && withPeriod(doi),
      ]);
    }
    case 'CAPITULO-DE-LIVRO-PUBLICADO': {
      // AUTOR do capítulo. Título. In: AUTOR da obra (org.). Título da obra. edição.
      // Local: Editora, data. p. (guia UFU, p. 16). Organizadores vêm em texto livre no
      // Lattes e entram como estão.
      const organizers = attr(details, 'ORGANIZADORES');
      const book = attr(details, 'TITULO-DO-LIVRO');
      const pages = abntPages(attr(details, 'PAGINA-INICIAL'), attr(details, 'PAGINA-FINAL'));
      return joinSegments([
        authorsBlock(item, opts),
        title && withPeriod(title),
        organizers ? `In: ${withPeriod(`${organizers} (org.)`)}` : book ? 'In:' : undefined,
        book ? { strong: true, text: withPeriod(book) } : undefined,
        edition(details),
        withPeriod(
          commaJoin([
            abntImprint(attr(details, 'CIDADE-DA-EDITORA'), attr(details, 'NOME-DA-EDITORA')),
            year,
          ]),
        ),
        pages && withPeriod(pages),
        doi && withPeriod(doi),
      ]);
    }
    case 'TEXTO-EM-JORNAL-OU-REVISTA': {
      // Por analogia com o artigo de periódico (o guia não traz modelo de texto em
      // jornal ou revista): AUTOR. Título. Jornal, Local, p., data. Não confirmado.
      const paper = attr(details, 'TITULO-DO-JORNAL-OU-REVISTA');
      const volume = attr(details, 'VOLUME');
      const tail = commaJoin([
        attr(details, 'LOCAL-DE-PUBLICACAO') ?? '[s. l.]',
        volume && `v. ${volume}`,
        abntPages(attr(details, 'PAGINA-INICIAL'), attr(details, 'PAGINA-FINAL')),
        abntDate(attr(details, 'DATA-DE-PUBLICACAO'), year),
      ]);
      return joinSegments([
        authorsBlock(item, opts),
        title && withPeriod(title),
        paper ? { strong: true, text: `${paper},` } : undefined,
        withPeriod(tail),
        doi && withPeriod(doi),
      ]);
    }
    default:
      // Outros tipos: autores, título destacado e ano. Sem modelo específico conferido.
      return joinSegments([
        authorsBlock(item, opts),
        title ? { strong: true, text: withPeriod(title) } : undefined,
        year && withPeriod(year),
        doi && withPeriod(doi),
      ]);
  }
}
