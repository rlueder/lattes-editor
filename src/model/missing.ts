// Campos que faltam num item: DOI, ISSN, ISBN, palavras-chave, título em
// inglês, ID CNPq dos coautores, agência da orientação. Uma definição só,
// usada pelo filtro "Faltando" das seções e pela Saúde do currículo no
// Panorama, para as contagens dos dois baterem.

import { lattesSchema } from '../schema/lattes.ts';
import { childElements, getAttr, type XElement } from './xml.ts';

/** Reconhece a dona do currículo entre autores e participantes. */
export type OwnerTest = (full: string, cit: string) => boolean;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Pelo nome completo e pelos nomes em citações de DADOS-GERAIS. */
export function ownerTest(dadosGerais: XElement | undefined): OwnerTest {
  const names = new Set([fold((dadosGerais && getAttr(dadosGerais, 'NOME-COMPLETO')) ?? '')]);
  const cits = new Set(
    ((dadosGerais && getAttr(dadosGerais, 'NOME-EM-CITACOES-BIBLIOGRAFICAS')) ?? '')
      .split(';')
      .map(fold)
      .filter(Boolean),
  );
  return (full, cit) =>
    (full !== '' && names.has(fold(full))) || (cit !== '' && cits.has(fold(cit)));
}

const childrenOf = (name: string) => lattesSchema.elements[name]?.children.map((c) => c.name) ?? [];

/** Os itens que o editor mostra em Produções, com autores e dados básicos. */
export const PRODUCTION_ITEMS = new Set([
  'ARTIGO-ACEITO-PARA-PUBLICACAO',
  'ARTIGO-PUBLICADO',
  'CAPITULO-DE-LIVRO-PUBLICADO',
  'LIVRO-PUBLICADO-OU-ORGANIZADO',
  'OUTRA-PRODUCAO-BIBLIOGRAFICA',
  'PARTITURA-MUSICAL',
  'PREFACIO-POSFACIO',
  'TEXTO-EM-JORNAL-OU-REVISTA',
  'TRABALHO-EM-EVENTOS',
  'TRADUCAO',
  'SOFTWARE',
  'PRODUTO-TECNOLOGICO',
  'PROCESSOS-OU-TECNICAS',
  'TRABALHO-TECNICO',
  ...childrenOf('DEMAIS-TIPOS-DE-PRODUCAO-TECNICA'),
  ...childrenOf('PRODUCAO-ARTISTICA-CULTURAL'),
]);

const BOOKS = new Set(['CAPITULO-DE-LIVRO-PUBLICADO', 'LIVRO-PUBLICADO-OU-ORGANIZADO']);

const part = (el: XElement, prefix: string) =>
  childElements(el).find((c) => c.name.startsWith(prefix));
const value = (el: XElement | undefined, attr: string) => ((el && getAttr(el, attr)) ?? '').trim();
const basics = (el: XElement, attr: string) => value(part(el, 'DADOS-BASICOS'), attr);
const detail = (el: XElement, attr: string) => value(part(el, 'DETALHAMENTO'), attr);

const isSupervision = (name: string) =>
  /^(ORIENTACOES-CONCLUIDAS-PARA-|OUTRAS-ORIENTACOES-CONCLUIDAS|ORIENTACAO-EM-ANDAMENTO-|OUTRAS-ORIENTACOES-EM-ANDAMENTO)/.test(
    name,
  );

/** Coautores: os autores que não são a dona do currículo. */
const coauthors = (el: XElement, owner: OwnerTest) =>
  childElements(el, 'AUTORES').filter(
    (a) => !owner(value(a, 'NOME-COMPLETO-DO-AUTOR'), value(a, 'NOME-PARA-CITACAO')),
  );

export interface MissingCheck {
  /** Vale para este item (o campo existe nele). */
  applies: (el: XElement, owner: OwnerTest) => boolean;
  id: string;
  /** Opção do filtro: "Sem DOI". */
  label: string;
  /** O campo está vazio. Só faz sentido quando `applies`. */
  missing: (el: XElement, owner: OwnerTest) => boolean;
}

export const MISSING_CHECKS: MissingCheck[] = [
  {
    applies: (el) => el.name === 'ARTIGO-PUBLICADO',
    id: 'doi',
    label: 'Sem DOI (artigos)',
    missing: (el) => basics(el, 'DOI') === '',
  },
  {
    applies: (el) => el.name === 'ARTIGO-PUBLICADO',
    id: 'issn',
    label: 'Sem ISSN',
    missing: (el) => detail(el, 'ISSN') === '',
  },
  {
    applies: (el) => el.name === 'ARTIGO-PUBLICADO',
    id: 'volume',
    label: 'Sem volume ou páginas',
    missing: (el) => detail(el, 'VOLUME') === '' || detail(el, 'PAGINA-INICIAL') === '',
  },
  {
    applies: (el) => BOOKS.has(el.name),
    id: 'isbn',
    label: 'Sem ISBN',
    missing: (el) => detail(el, 'ISBN') === '',
  },
  {
    applies: (el) => PRODUCTION_ITEMS.has(el.name),
    id: 'palavras-chave',
    label: 'Sem palavras-chave',
    missing: (el) =>
      !childElements(el, 'PALAVRAS-CHAVE').some((k) => k.attrs.some((a) => a.value.trim())),
  },
  {
    applies: (el) => PRODUCTION_ITEMS.has(el.name),
    id: 'titulo-ingles',
    label: 'Sem título em inglês',
    missing: (el) => {
      const b = part(el, 'DADOS-BASICOS');
      return !b?.attrs.some(
        (a) => a.name.startsWith('TITULO') && a.name.endsWith('INGLES') && a.value.trim(),
      );
    },
  },
  {
    applies: (el) => el.name === 'TRABALHO-EM-EVENTOS',
    id: 'doi-eventos',
    label: 'Sem DOI (eventos)',
    missing: (el) => basics(el, 'DOI') === '',
  },
  {
    applies: (el, owner) => PRODUCTION_ITEMS.has(el.name) && coauthors(el, owner).length > 0,
    id: 'id-cnpq',
    label: 'Sem ID CNPq de coautor',
    missing: (el, owner) => coauthors(el, owner).some((a) => value(a, 'NRO-ID-CNPQ') === ''),
  },
  {
    applies: (el) => isSupervision(el.name),
    id: 'agencia',
    label: 'Sem agência',
    missing: (el) => detail(el, 'NOME-DA-AGENCIA') === '',
  },
];

export const missingCheck = (id: string): MissingCheck | undefined =>
  MISSING_CHECKS.find((c) => c.id === id);
