// Leitura do currículo para o Panorama: só o que os gráficos usam, tirado da
// árvore XML já carregada no editor. Nada aqui muda o documento; cada item
// guarda o elemento de origem para o clique levar à lista certa no editor.

import { elementLabel } from '../labels/labels.ts';
import { childElements, walk, type XElement } from '../model/xml.ts';
import { attr, childStarting, descendants, personKey, titleOf, yearOf } from './read-helpers.ts';

export { personKey, yearOf } from './read-helpers.ts';
import { readAwards, readDegrees, readPositions, readProjects } from './read-bio.ts';

/** Os quatro grupos de produção dos gráficos, na ordem das cores. */
export type ProductionGroup = 'artigos' | 'eventos' | 'livros' | 'outros';

export const PRODUCTION_GROUPS: { key: ProductionGroup; label: string }[] = [
  { key: 'artigos', label: 'Artigos' },
  { key: 'livros', label: 'Livros e capítulos' },
  { key: 'eventos', label: 'Trabalhos em eventos' },
  { key: 'outros', label: 'Demais tipos' },
];

/** Níveis de orientação, do menor ao maior. */
export const LEVELS = [
  'Iniciação científica',
  'Graduação (TCC)',
  'Especialização',
  'Mestrado',
  'Doutorado',
  'Pós-doutorado',
  'Outra natureza',
] as const;
export type Level = (typeof LEVELS)[number];

export interface PersonRef {
  cit: string;
  full: string;
}

export interface Author extends PersonRef {
  cnpq: string;
  order: number;
  self: boolean;
}

interface Base {
  el: XElement;
  /** Seção do editor onde o item mora. */
  sectionId: string;
  title: string;
  /** Tipo legível (Artigo completo publicado, Banca de mestrado). */
  typeLabel: string;
  year?: number;
}

export interface Production extends Base {
  authors: Author[];
  city: string;
  country: string;
  doi: string;
  eventClass: string;
  group: ProductionGroup;
  isbn: string;
  issn: string;
  keywords: string[];
  kind: 'producao';
  lang: string;
  pages: string;
  titleEn: string;
  venue: string;
  volume: string;
}

export interface Supervision extends Base {
  agency: string;
  kind: 'orientacao';
  level: Level;
  student: string;
  ongoing: boolean;
}

export interface Committee extends Base {
  candidate: string;
  kind: 'banca';
  members: PersonRef[];
}

export interface EventParticipation extends Base {
  city: string;
  country: string;
  event: string;
  kind: 'evento';
}

export interface Span extends Base {
  end?: number;
  inst: string;
  start?: number;
}

export interface Degree extends Span {
  advisor: string;
  kind: 'formacao';
  level: string;
}

export interface Position extends Span {
  kind: 'vinculo';
}

export interface Project extends Span {
  kind: 'projeto';
  lead: boolean;
  team: PersonRef[];
}

export interface Award extends Base {
  inst: string;
  kind: 'premio';
}

export type PanoramaItem =
  Award | Committee | Degree | EventParticipation | Position | Production | Project | Supervision;

export interface Area {
  area: string;
  sub: string;
}

export interface CvData {
  areas: Area[];
  awards: Award[];
  /** Primeiro ano da carreira: o menor entre o início do mestrado ou doutorado e o primeiro item. */
  careerStart: number;
  committees: Committee[];
  degrees: Degree[];
  events: EventParticipation[];
  /** Último ano com algum item, ou o ano corrente. */
  lastYear: number;
  name: string;
  orcid: string;
  positions: Position[];
  productions: Production[];
  projects: Project[];
  summaryEn: string;
  supervisions: Supervision[];
  /** DATA-ATUALIZACAO como veio (DDMMAAAA). */
  updated: string;
}

const BIBLIOGRAPHIC: Record<string, ProductionGroup> = {
  'ARTIGO-ACEITO-PARA-PUBLICACAO': 'outros',
  'ARTIGO-PUBLICADO': 'artigos',
  'CAPITULO-DE-LIVRO-PUBLICADO': 'livros',
  'LIVRO-PUBLICADO-OU-ORGANIZADO': 'livros',
  'OUTRA-PRODUCAO-BIBLIOGRAFICA': 'outros',
  'PARTITURA-MUSICAL': 'outros',
  'PREFACIO-POSFACIO': 'outros',
  'TEXTO-EM-JORNAL-OU-REVISTA': 'outros',
  'TRABALHO-EM-EVENTOS': 'eventos',
  TRADUCAO: 'outros',
};

/** Contêineres de produção técnica e artística que o editor mostra em Produções. */
const OTHER_CONTAINERS = new Set([
  'DEMAIS-TIPOS-DE-PRODUCAO-TECNICA',
  'PRODUCAO-ARTISTICA-CULTURAL',
  'PROCESSOS-OU-TECNICAS',
  'PRODUTO-TECNOLOGICO',
  'SOFTWARE',
  'TRABALHO-TECNICO',
]);

const DEGREE_LEVELS = new Set(['DOUTORADO', 'MESTRADO', 'MESTRADO-PROFISSIONALIZANTE']);

/** Nível da orientação pelo elemento e, nas "outras", pela natureza. */
export function levelOf(tag: string, natureza = ''): Level {
  if (tag.includes('POS-DOUTORADO')) return 'Pós-doutorado';
  if (tag.includes('DOUTORADO')) return 'Doutorado';
  if (tag.includes('MESTRADO')) return 'Mestrado';
  const text = `${tag} ${natureza}`;
  if (text.includes('INICIACAO')) return 'Iniciação científica';
  if (/APERFEICOAMENTO|ESPECIALIZACAO/.test(text)) return 'Especialização';
  if (text.includes('GRADUACAO')) return 'Graduação (TCC)';
  return 'Outra natureza';
}

function readProduction(el: XElement, group: ProductionGroup, isSelf: SelfTest): Production {
  const basics = childStarting(el, 'DADOS-BASICOS');
  const detail = childStarting(el, 'DETALHAMENTO');
  const authors = childElements(el, 'AUTORES')
    .map((a) => {
      const full = attr(a, 'NOME-COMPLETO-DO-AUTOR');
      const cit = attr(a, 'NOME-PARA-CITACAO');
      const order = Number(attr(a, 'ORDEM-DE-AUTORIA')) || 0;
      return { cit, cnpq: attr(a, 'NRO-ID-CNPQ'), full, order, self: isSelf(full, cit) };
    })
    .sort((x, y) => x.order - y.order);
  const keywords = childElements(el, 'PALAVRAS-CHAVE').flatMap((k) =>
    k.attrs.map((a) => a.value.trim()).filter(Boolean),
  );
  const venue =
    attr(detail, 'TITULO-DO-PERIODICO-OU-REVISTA') ||
    attr(detail, 'NOME-DO-EVENTO') ||
    attr(detail, 'TITULO-DO-LIVRO') ||
    attr(detail, 'TITULO-DO-JORNAL-OU-REVISTA') ||
    attr(detail, 'NOME-DA-EDITORA');
  return {
    authors,
    city: attr(detail, 'CIDADE-DO-EVENTO'),
    country: attr(basics, 'PAIS-DE-PUBLICACAO') || attr(basics, 'PAIS-DO-EVENTO'),
    doi: attr(basics, 'DOI'),
    el,
    eventClass: attr(detail, 'CLASSIFICACAO-DO-EVENTO'),
    group,
    isbn: attr(detail, 'ISBN'),
    issn: attr(detail, 'ISSN'),
    keywords,
    kind: 'producao',
    lang: attr(basics, 'IDIOMA'),
    pages: attr(detail, 'PAGINA-INICIAL'),
    sectionId: 'producoes',
    title: titleOf(basics),
    titleEn: titleOf(basics, true),
    typeLabel: elementLabel(el.name),
    venue,
    volume: attr(detail, 'VOLUME'),
    year: yearOf(basics),
  };
}

export type SelfTest = (full: string, cit: string) => boolean;

/** Reconhece a própria pessoa pelo nome completo ou por um dos nomes em citações. */
function selfTest(dadosGerais: XElement | undefined): SelfTest {
  const names = new Set([personKey(attr(dadosGerais, 'NOME-COMPLETO'))]);
  const cits = new Set(
    attr(dadosGerais, 'NOME-EM-CITACOES-BIBLIOGRAFICAS').split(';').map(personKey).filter(Boolean),
  );
  return (full, cit) => names.has(personKey(full)) || (cit !== '' && cits.has(personKey(cit)));
}

function readProductions(root: XElement, isSelf: SelfTest): Production[] {
  const found: Production[] = [];
  walk(root, (el) => {
    const group = BIBLIOGRAPHIC[el.name];
    if (group) found.push(readProduction(el, group, isSelf));
  });
  for (const container of descendants(root, (el) => OTHER_CONTAINERS.has(el.name))) {
    // SOFTWARE e afins são o próprio item; DEMAIS-TIPOS e a artística embrulham vários.
    const items = childStarting(container, 'DADOS-BASICOS')
      ? [container]
      : childElements(container);
    for (const el of items) found.push(readProduction(el, 'outros', isSelf));
  }
  return found;
}

function readSupervisions(root: XElement): Supervision[] {
  const boxes = descendants(
    root,
    (el) => el.name === 'ORIENTACOES-CONCLUIDAS' || el.name === 'ORIENTACOES-EM-ANDAMENTO',
  );
  return boxes.flatMap((box) =>
    childElements(box).map((el) => {
      const basics = childStarting(el, 'DADOS-BASICOS');
      const detail = childStarting(el, 'DETALHAMENTO');
      const student = detail?.attrs.find((a) => /^NOME-DO-ORIENTAN?D[OA]$/.test(a.name))?.value;
      return {
        agency: attr(detail, 'NOME-DA-AGENCIA'),
        el,
        kind: 'orientacao' as const,
        level: levelOf(el.name, attr(basics, 'NATUREZA')),
        ongoing: box.name === 'ORIENTACOES-EM-ANDAMENTO',
        sectionId: 'orientacoes',
        student: student ?? '',
        title: titleOf(basics),
        typeLabel: elementLabel(el.name),
        year: yearOf(basics),
      };
    }),
  );
}

function readCommittees(root: XElement): Committee[] {
  const boxes = descendants(
    root,
    (el) =>
      el.name === 'PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO' ||
      el.name === 'PARTICIPACAO-EM-BANCA-JULGADORA',
  );
  return boxes.flatMap((box) =>
    childElements(box).map((el) => {
      const basics = childStarting(el, 'DADOS-BASICOS');
      return {
        candidate: attr(childStarting(el, 'DETALHAMENTO'), 'NOME-DO-CANDIDATO'),
        el,
        kind: 'banca' as const,
        members: childElements(el, 'PARTICIPANTE-BANCA').map((p) => ({
          cit: attr(p, 'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA'),
          full: attr(p, 'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA'),
        })),
        sectionId: 'bancas',
        title: titleOf(basics),
        typeLabel: elementLabel(el.name),
        year: yearOf(basics),
      };
    }),
  );
}

function readEvents(root: XElement): EventParticipation[] {
  const box = descendants(root, (el) => el.name === 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS');
  return box.flatMap((b) =>
    childElements(b).map((el) => {
      const basics = childStarting(el, 'DADOS-BASICOS');
      const detail = childStarting(el, 'DETALHAMENTO');
      return {
        city: attr(detail, 'CIDADE-DO-EVENTO'),
        country: attr(basics, 'PAIS'),
        el,
        event: attr(detail, 'NOME-DO-EVENTO'),
        kind: 'evento' as const,
        sectionId: 'eventos',
        title: titleOf(basics) || attr(detail, 'NOME-DO-EVENTO'),
        typeLabel: elementLabel(el.name),
        year: yearOf(basics),
      };
    }),
  );
}

/** O currículo inteiro, pronto para os gráficos. `now` é o ano corrente. */
export function readCv(root: XElement, now: number): CvData {
  const dg = childElements(root, 'DADOS-GERAIS')[0];
  const isSelf = selfTest(dg);
  const summary = dg && descendants(dg, (el) => el.name === 'RESUMO-CV')[0];
  const data = {
    areas: descendants(root, (el) => el.name === 'AREA-DE-ATUACAO').map((a) => ({
      area: attr(a, 'NOME-DA-AREA-DO-CONHECIMENTO'),
      sub: attr(a, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO'),
    })),
    awards: readAwards(root),
    committees: readCommittees(root),
    degrees: readDegrees(root),
    events: readEvents(root),
    name: attr(dg, 'NOME-COMPLETO'),
    orcid: attr(dg, 'ORCID-ID'),
    positions: readPositions(root),
    productions: readProductions(root, isSelf),
    projects: readProjects(root, isSelf),
    summaryEn: attr(summary, 'TEXTO-RESUMO-CV-RH-EN'),
    supervisions: readSupervisions(root),
    updated: attr(root, 'DATA-ATUALIZACAO'),
  };
  const years = [
    ...data.productions,
    ...data.supervisions,
    ...data.committees,
    ...data.events,
    ...data.awards,
  ].flatMap((i) => (i.year ? [i.year] : []));
  const firstItem = Math.min(now, ...years);
  const graduate = data.degrees.filter((d) => DEGREE_LEVELS.has(d.level) && d.start);
  const careerStart = Math.min(firstItem, ...graduate.map((d) => d.start!));
  return { ...data, careerStart, lastYear: Math.max(now, ...years) };
}

/** A própria pessoa entre os autores, ou -1. */
export function selfIndex(p: Production): number {
  return p.authors.findIndex((a) => a.self);
}
