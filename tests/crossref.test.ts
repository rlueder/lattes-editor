import { describe, expect, it } from 'vitest';

import {
  applyCrossref,
  crossrefAuthors,
  type CrossrefWork,
  DoiError,
  fetchCrossref,
  itemNameFor,
  normalizeDoi,
} from '../src/lookups/crossref.ts';
import { itemPart, newItem } from '../src/model/production.ts';
import { getAttr } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

// Recortes de respostas reais do Crossref (11/10/2026), só com os campos usados.
const ARTICLE: CrossrefWork = {
  author: [
    { family: 'LeCun', given: 'Yann' },
    { family: 'Bengio', given: 'Yoshua' },
  ],
  'container-title': ['Nature'],
  DOI: '10.1038/nature14539',
  issue: '7553',
  ISSN: ['0028-0836', '1476-4687'],
  'issn-type': [
    { type: 'print', value: '0028-0836' },
    { type: 'electronic', value: '1476-4687' },
  ],
  issued: { 'date-parts': [[2015, 5, 27]] },
  language: 'en',
  page: '436-444',
  publisher: 'Springer Science and Business Media LLC',
  title: ['Deep learning'],
  type: 'journal-article',
  volume: '521',
};

const PROCEEDINGS: CrossrefWork = {
  'container-title': ['ICERI proceedings', 'ICERI2016 Proceedings'],
  DOI: '10.21125/iceri.2016.0001',
  event: {
    location: 'Seville, Spain',
    name: 'International Technology, Education and Development Conference',
    start: { 'date-parts': [[2016, 11, 14]] },
  },
  issued: { 'date-parts': [[2016, 11]] },
  page: '6724-6729',
  publisher: 'IATED',
  title: ['Um trabalho'],
  type: 'proceedings-article',
};

const attr = (el: ReturnType<typeof itemPart>, name: string) =>
  el ? getAttr(el, name) : undefined;

describe('normalizeDoi', () => {
  it('aceita DOI puro, prefixo doi: e URL', () => {
    expect(normalizeDoi('10.1038/nature14539')).toBe('10.1038/nature14539');
    expect(normalizeDoi(' doi:10.1038/nature14539. ')).toBe('10.1038/nature14539');
    expect(normalizeDoi('https://doi.org/10.1038/nature14539')).toBe('10.1038/nature14539');
    expect(normalizeDoi('nature14539')).toBeUndefined();
  });
});

describe('itemNameFor', () => {
  it.each([
    ['journal-article', 'ARTIGO-PUBLICADO'],
    ['proceedings-article', 'TRABALHO-EM-EVENTOS'],
    ['book-chapter', 'CAPITULO-DE-LIVRO-PUBLICADO'],
    ['book', 'LIVRO-PUBLICADO-OU-ORGANIZADO'],
    ['dataset', undefined],
  ])('%s → %s', (type, expected) => {
    expect(itemNameFor({ DOI: 'x', type })).toBe(expected);
  });
});

describe('applyCrossref', () => {
  it('artigo: título, ano, periódico, volume, fascículo, páginas, ISSN impresso, idioma', () => {
    const item = newItem(schema, 'ARTIGO-PUBLICADO', 1);
    const filled = applyCrossref(item, ARTICLE);
    const b = itemPart(item, 'DADOS-BASICOS');
    const d = itemPart(item, 'DETALHAMENTO');
    expect(attr(b, 'TITULO-DO-ARTIGO')).toBe('Deep learning');
    expect(attr(b, 'ANO-DO-ARTIGO')).toBe('2015');
    expect(attr(b, 'IDIOMA')).toBe('Inglês');
    expect(attr(b, 'DOI')).toBe('10.1038/nature14539');
    expect(attr(d, 'TITULO-DO-PERIODICO-OU-REVISTA')).toBe('Nature');
    expect(attr(d, 'ISSN')).toBe('0028-0836');
    expect([attr(d, 'VOLUME'), attr(d, 'FASCICULO')]).toEqual(['521', '7553']);
    expect([attr(d, 'PAGINA-INICIAL'), attr(d, 'PAGINA-FINAL')]).toEqual(['436', '444']);
    // País fica de fora: o Crossref não dá país em português.
    expect(attr(b, 'PAIS-DE-PUBLICACAO')).toBe('');
    expect(filled).toHaveLength(10);
  });

  it('trabalho em evento: nome, cidade e ano do evento; anais pelo título mais específico', () => {
    const item = newItem(schema, 'TRABALHO-EM-EVENTOS', 1);
    applyCrossref(item, PROCEEDINGS);
    const d = itemPart(item, 'DETALHAMENTO');
    expect(attr(d, 'NOME-DO-EVENTO')).toBe(
      'International Technology, Education and Development Conference',
    );
    expect(attr(d, 'CIDADE-DO-EVENTO')).toBe('Seville');
    expect(attr(d, 'ANO-DE-REALIZACAO')).toBe('2016');
    expect(attr(d, 'TITULO-DOS-ANAIS-OU-PROCEEDINGS')).toBe('ICERI2016 Proceedings');
    expect(attr(d, 'NOME-DA-EDITORA')).toBe('IATED');
    expect(attr(itemPart(item, 'DADOS-BASICOS'), 'IDIOMA')).toBe('');
  });

  it('capítulo e livro; tipo sem mapeamento não preenche nada', () => {
    const chapter = newItem(schema, 'CAPITULO-DE-LIVRO-PUBLICADO', 1);
    applyCrossref(chapter, {
      'container-title': ['Série', 'O livro'],
      DOI: '10.1/x',
      ISBN: ['9780000000000'],
      issued: { 'date-parts': [[2020]] },
      page: '10',
      title: ['O capítulo'],
      type: 'book-chapter',
    });
    expect(attr(itemPart(chapter, 'DETALHAMENTO'), 'TITULO-DO-LIVRO')).toBe('O livro');
    expect(attr(itemPart(chapter, 'DETALHAMENTO'), 'PAGINA-INICIAL')).toBe('10');
    expect(attr(itemPart(chapter, 'DETALHAMENTO'), 'PAGINA-FINAL')).toBe('');

    const book = newItem(schema, 'LIVRO-PUBLICADO-OU-ORGANIZADO', 2);
    applyCrossref(book, { DOI: '10.1/y', publisher: 'Editora', title: ['Livro'], type: 'book' });
    expect(attr(itemPart(book, 'DADOS-BASICOS'), 'TITULO-DO-LIVRO')).toBe('Livro');

    const software = newItem(schema, 'SOFTWARE', 3);
    expect(applyCrossref(software, ARTICLE)).toEqual([]);
  });
});

describe('crossrefAuthors', () => {
  it('reaproveita autores conhecidos pelo nome, ignorando acento e caixa', () => {
    const known = [{ citation: 'LECUN, Y.', lattesId: '0000000000000009', name: 'Yann LéCun' }];
    expect(crossrefAuthors(ARTICLE, known)).toEqual([
      known[0],
      { citation: 'BENGIO, Y.', lattesId: '', name: 'Yoshua Bengio' },
    ]);
    expect(
      crossrefAuthors({ author: [{ name: 'Consórcio X' }, {}], DOI: 'x', type: 'x' }, []),
    ).toEqual([{ citation: 'X, C.', lattesId: '', name: 'Consórcio X' }]);
  });
});

describe('fetchCrossref', () => {
  const respond = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status });

  it('pede só o DOI e devolve a mensagem', async () => {
    let url = '';
    const work = await fetchCrossref('https://doi.org/10.1038/nature14539', async (input) => {
      url = String(input);
      return new Response(JSON.stringify({ message: ARTICLE }));
    });
    expect(url).toBe('https://api.crossref.org/works/10.1038%2Fnature14539');
    expect(work.title).toEqual(['Deep learning']);
  });

  it.each([
    ['abc', undefined, 'DOI inválido'],
    ['10.1000/x', respond(404, {}), 'não conhece'],
    ['10.1000/x', respond(500, {}), 'erro (500)'],
    ['10.1000/x', respond(200, {}), 'inesperada'],
    [
      '10.1000/x',
      async () => {
        throw new TypeError('offline');
      },
      'Sem conexão',
    ],
  ])('erros: %s', async (doi, impl, message) => {
    await expect(fetchCrossref(doi, impl as typeof fetch)).rejects.toThrow(DoiError);
    await expect(fetchCrossref(doi, impl as typeof fetch)).rejects.toThrow(message);
  });
});
