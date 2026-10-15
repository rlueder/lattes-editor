// Pré-diff e deduplicação explicável (LAT-45): todo item que vem de fora
// (outro XML, o DOI no Crossref e, quando existirem, planilha, ORCID,
// OpenAlex e foto de certificado) é comparado com o currículo antes de virar
// alteração pendente. O editor dá uma pontuação com o motivo de cada parte,
// e a pessoa decide: nada é mesclado nem descartado sozinho.
//
// Os pesos seguem o modelo do CIÊNCIAVITAE, que declara título 45%,
// identificador 15% e autores 10% (docs/pesquisa_apps_lattes.md, seção 2).
// Os 30% restantes são escolha do editor, não do CIÊNCIAVITAE: ano 15%, tipo
// do item 10% e veículo (periódico, evento, anais, editora) 5%. Os limites de
// "parece duplicata" e "parecido" também são escolhas do editor.
//
// Reaproveita a normalização de título da revisão de consistência (LAT-29).

import { elementLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { itemMeta, SUBTITLE_ATTRS } from '../ui/item-meta.ts';
import { normalizeTitle, productionItems } from './consistency.ts';

export const WEIGHTS = {
  ano: 15,
  autores: 10,
  identificador: 15,
  tipo: 10,
  titulo: 45,
  veiculo: 5,
} as const;

export type Part = keyof typeof WEIGHTS;

/** As partes do peso maior ao menor, a ordem em que os motivos aparecem. */
export const PARTS: Part[] = ['titulo', 'identificador', 'ano', 'tipo', 'autores', 'veiculo'];

/** A partir daqui, "parece duplicata". */
export const DUPLICATE_AT = 70;
/** A partir daqui, "parecido": vale olhar, mas provavelmente é outro item. */
export const SIMILAR_AT = 50;
/**
 * Títulos com menos que isto de palavras em comum não são o mesmo trabalho,
 * por mais que ano, tipo, autores e veículo batam: a mesma pessoa publica
 * vários artigos no mesmo periódico no mesmo ano.
 */
export const MIN_TITLE_SIMILARITY = 0.5;

export interface PartScore {
  /** Pontos ganhos nesta parte, de 0 ao peso. */
  points: number;
  /** O motivo, em pt-BR, para mostrar ao lado do candidato. */
  reason: string;
  weight: number;
}

export interface Candidate {
  /** O item do currículo com que o novo se parece. */
  item: XElement;
  level: 'duplicata' | 'parecido';
  parts: Record<Part, PartScore>;
  /** Os dois têm o mesmo DOI: é o mesmo trabalho, seja qual for a pontuação. */
  sameDoi: boolean;
  /** 0 a 100. */
  score: number;
  title: string;
}

/** O que o editor sabe comparar de um item, lido uma vez. */
interface Profile {
  authors: Set<string>;
  doi?: string;
  isbn?: string;
  name: string;
  title: string;
  titleWords: string[];
  venue?: string;
  year?: number;
}

const basicsOf = (item: XElement) =>
  childElements(item).filter((c) => c.name.startsWith('DADOS-BASICOS'));
const detailsOf = (item: XElement) =>
  childElements(item).filter((c) => c.name.startsWith('DETALHAMENTO'));

function attrOf(els: XElement[], names: string[]): string | undefined {
  for (const el of els) {
    for (const name of names) {
      const v = getAttr(el, name)?.trim();
      if (v) return v;
    }
  }
  return undefined;
}

/** DOI comparável: sem o prefixo de endereço e em minúsculas (o DOI não distingue caixa). */
export function normalizeDoi(doi: string | undefined): string | undefined {
  const clean = doi
    ?.trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .toLowerCase();
  return clean || undefined;
}

/** O sobrenome de um autor: o trecho antes da vírgula do nome em citações, ou a última palavra do nome. */
export function authorKey(author: XElement): string | undefined {
  const cited = getAttr(author, 'NOME-PARA-CITACAO')?.split(';')[0]?.trim();
  const full = attrOf([author], ['NOME-COMPLETO-DO-AUTOR', 'NOME-COMPLETO-DO-PARTICIPANTE']);
  const surname = cited?.includes(',') ? cited.split(',')[0] : full?.split(/\s+/).at(-1);
  const key = surname && normalizeTitle(surname);
  return key || undefined;
}

function profileOf(item: XElement): Profile {
  const sources = [item, ...basicsOf(item)];
  const details = detailsOf(item);
  const meta = itemMeta(item);
  const title = normalizeTitle(meta.title);
  const authors = new Set(
    childElements(item)
      .filter((c) => c.name === 'AUTORES' || c.name.startsWith('PARTICIPANTE'))
      .map(authorKey)
      .filter((k): k is string => k !== undefined),
  );
  const venue = attrOf([...details, ...sources], SUBTITLE_ATTRS);
  return {
    authors,
    doi: normalizeDoi(attrOf(sources, ['DOI'])),
    isbn: attrOf([...details, ...sources], ['ISBN'])
      ?.replace(/[^0-9x]/gi, '')
      .toLowerCase(),
    name: item.name,
    title,
    titleWords: title.split(' ').filter(Boolean),
    venue: venue && venue !== meta.title ? normalizeTitle(venue) : undefined,
    year: meta.year ?? meta.end?.year ?? meta.start?.year,
  };
}

/** Coeficiente de Dice das palavras dos dois títulos (0 a 1). */
export function titleSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const rest = [...b];
  let shared = 0;
  for (const w of a) {
    const i = rest.indexOf(w);
    if (i >= 0) {
      shared++;
      rest.splice(i, 1);
    }
  }
  return (2 * shared) / (a.length + b.length);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const part = (weight: number, share: number, reason: string): PartScore => ({
  points: Math.round(weight * share * 10) / 10,
  reason,
  weight,
});

function titleShare(a: Profile, b: Profile): number {
  return a.title === b.title && a.title ? 1 : titleSimilarity(a.titleWords, b.titleWords);
}

function compare(a: Profile, b: Profile): Record<Part, PartScore> {
  const sim = titleShare(a, b);
  const titulo = part(
    WEIGHTS.titulo,
    sim,
    sim === 1 ? 'título igual' : sim > 0 ? `título ${pct(sim)} parecido` : 'título diferente',
  );

  let identificador: PartScore;
  if (a.doi && b.doi) {
    identificador = part(
      WEIGHTS.identificador,
      a.doi === b.doi ? 1 : 0,
      a.doi === b.doi ? 'mesmo DOI' : 'DOIs diferentes',
    );
  } else if (a.isbn && b.isbn) {
    identificador = part(
      WEIGHTS.identificador,
      a.isbn === b.isbn ? 1 : 0,
      a.isbn === b.isbn ? 'mesmo ISBN' : 'ISBNs diferentes',
    );
  } else {
    identificador = part(WEIGHTS.identificador, 0, 'sem DOI ou ISBN nos dois para comparar');
  }

  let autores: PartScore;
  if (a.authors.size && b.authors.size) {
    const shared = [...a.authors].filter((k) => b.authors.has(k)).length;
    const total = new Set([...a.authors, ...b.authors]).size;
    autores = part(
      WEIGHTS.autores,
      shared / total,
      shared === 0
        ? 'nenhum autor em comum'
        : `${shared} de ${total} ${total === 1 ? 'autor' : 'autores'} em comum`,
    );
  } else autores = part(WEIGHTS.autores, 0, 'sem autores nos dois para comparar');

  let ano: PartScore;
  if (a.year !== undefined && b.year !== undefined) {
    const gap = Math.abs(a.year - b.year);
    // Um ano de diferença acontece entre aceito e publicado, ou entre evento e anais.
    ano = part(
      WEIGHTS.ano,
      gap === 0 ? 1 : gap === 1 ? 0.5 : 0,
      gap === 0 ? 'mesmo ano' : `anos ${Math.min(a.year, b.year)} e ${Math.max(a.year, b.year)}`,
    );
  } else ano = part(WEIGHTS.ano, 0, 'sem ano nos dois para comparar');

  const tipo = part(
    WEIGHTS.tipo,
    a.name === b.name ? 1 : 0,
    a.name === b.name ? 'mesmo tipo' : `tipos diferentes (${elementLabel(b.name)})`,
  );

  const veiculo =
    a.venue && b.venue
      ? part(
          WEIGHTS.veiculo,
          a.venue === b.venue ? 1 : 0,
          a.venue === b.venue ? 'mesmo veículo' : 'veículos diferentes',
        )
      : part(WEIGHTS.veiculo, 0, 'sem veículo nos dois para comparar');

  return { ano, autores, identificador, tipo, titulo, veiculo };
}

/**
 * Os perfis já lidos numa comparação, para cada item ser lido uma vez só,
 * e não uma vez por item que chega. Vale só durante uma comparação: o
 * documento é mutado no lugar a cada edição.
 */
export type ProfileCache = Map<XElement, Profile>;

function cachedProfile(cache: ProfileCache, item: XElement): Profile {
  let p = cache.get(item);
  if (!p) {
    p = profileOf(item);
    cache.set(item, p);
  }
  return p;
}

/**
 * Os itens do currículo com que `incoming` se parece, do mais parecido ao
 * menos, só os que passam de SIMILAR_AT (ou têm o mesmo DOI).
 */
export function candidatesFor(
  incoming: XElement,
  existing: XElement[],
  cache: ProfileCache = new Map(),
): Candidate[] {
  const mine = cachedProfile(cache, incoming);
  const out: Candidate[] = [];
  for (const item of existing) {
    if (item === incoming) continue;
    const other = cachedProfile(cache, item);
    const sameDoi = Boolean(mine.doi && mine.doi === other.doi);
    // Título muito diferente nunca vira candidato: nem chega a pontuar.
    if (!sameDoi && titleShare(mine, other) < MIN_TITLE_SIMILARITY) continue;
    const parts = compare(mine, other);
    const score = Math.round(Object.values(parts).reduce((n, p) => n + p.points, 0));
    if (!sameDoi && score < SIMILAR_AT) continue;
    // Dois DOIs diferentes são dois trabalhos, a não ser que um DOI esteja errado.
    const otherDoi = Boolean(mine.doi && other.doi && !sameDoi);
    out.push({
      item,
      level: sameDoi || (score >= DUPLICATE_AT && !otherDoi) ? 'duplicata' : 'parecido',
      parts,
      sameDoi,
      score,
      title: itemMeta(item).title || elementLabel(item.name),
    });
  }
  return out.sort((x, y) => Number(y.sameDoi) - Number(x.sameDoi) || y.score - x.score);
}

/** Os motivos de um candidato, do que mais pesou ao que menos: "título igual · mesmo ano". */
export function reasons(candidate: Candidate): string[] {
  return PARTS.map((k) => candidate.parts[k])
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((p) => p.reason);
}

/**
 * "Parece duplicata de X (87%)". Com o título igual, repetir o título não diz
 * nada: a linha diz que é um item com o mesmo título.
 */
export function candidateLine(candidate: Candidate): string {
  const what = candidate.level === 'duplicata' ? 'Parece duplicata de' : 'Parecido com';
  const of =
    candidate.parts.titulo.points === WEIGHTS.titulo
      ? 'um item com o mesmo título'
      : `"${candidate.title}"`;
  return `${what} ${of} (${candidate.sameDoi ? 'mesmo DOI' : `${candidate.score}%`})`;
}

export interface IncomingItem {
  /** O mais parecido no currículo, quando passa de SIMILAR_AT. */
  best?: Candidate;
  item: XElement;
  /** "novo": não se parece com nada; os outros, com o nível do melhor candidato. */
  status: 'duplicata' | 'novo' | 'parecido';
}

/**
 * O pré-diff de uma leva de itens que vêm de fora contra o currículo aberto.
 * Um item igual a outro da mesma leva também aparece: o segundo é comparado
 * com os anteriores.
 */
export function preDiff(
  incoming: XElement[],
  root: XElement,
  cache: ProfileCache = new Map(),
): IncomingItem[] {
  const existing = productionItems(root);
  const seen: XElement[] = [];
  return incoming.map((item) => {
    const best = candidatesFor(item, [...existing, ...seen], cache)[0];
    seen.push(item);
    return { best, item, status: best ? best.level : 'novo' };
  });
}

/**
 * O item do currículo com que um item em criação mais se parece (o
 * formulário de produção nova, inclusive o preenchido pelo DOI). Um item com
 * o mesmo número de sequência é ele mesmo e fica de fora. cache: o mesmo a
 * cada edição do formulário, para o currículo ser lido uma vez só.
 */
export function closestInCv(
  item: XElement,
  root: XElement,
  cache: ProfileCache = new Map(),
): Candidate | undefined {
  const seq = getAttr(item, 'SEQUENCIA-PRODUCAO');
  const existing = productionItems(root).filter(
    (el) => seq === undefined || getAttr(el, 'SEQUENCIA-PRODUCAO') !== seq,
  );
  // O rascunho muda a cada tecla e é lido de novo; os itens do currículo, que
  // não mudam com o formulário aberto, ficam no cache de quem chama.
  cache.delete(item);
  return candidatesFor(item, existing, cache)[0];
}
