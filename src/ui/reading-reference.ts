// A referência de uma produção no modo de leitura, sem React: que campos
// preenchidos a referência da NBR 6023 já mostra (para a leitura mostrar os
// outros em linhas de rótulo e valor abaixo dela) e de que campo vem cada
// trecho dela (para o campo em foco acender o trecho na prévia).

import { readAuthor } from '../model/production.ts';
import type { XElement } from '../model/xml.ts';
import { abntAuthor, referenceText, type Segment } from '../print/abnt.ts';
import { referenceFor } from '../print/references.ts';
import {
  flatten,
  isFilled,
  isUsable,
  type LayoutOptions,
  type Part,
  partText,
  rowRank,
} from './reading-layout.ts';

/** Os campos do autor que a referência mostra juntos (nome e forma de citação). */
const AUTHOR_FIELDS = ['NOME-COMPLETO-DO-AUTOR', 'NOME-PARA-CITACAO'];

/** Um trecho da referência e o campo dele. */
export interface Highlight {
  end: number;
  /** Chave do campo; "3:*" vale para todos os campos do elemento 3 (um autor). */
  key: string;
  start: number;
}

export interface Candidate {
  key: string;
  text: string;
}

const isYear = (s: string) => /^\d{4}$/.test(s);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Onde cada valor aparece no texto da referência. Os valores mais longos
 * escolhem primeiro (o título antes do volume "33"), sem sobrepor trechos já
 * tomados, e preferem a palavra inteira; um ano marca todas as vezes que
 * aparece. Sem diferença de maiúscula: a referência põe o evento em versal.
 */
export function referenceHighlights(text: string, candidates: Candidate[]): Highlight[] {
  const taken: Highlight[] = [];
  const free = (s: number, e: number) => taken.every((h) => e <= h.start || s >= h.end);
  const sorted = [...candidates]
    .filter((c) => c.text.trim() !== '')
    .sort((a, b) => b.text.length - a.text.length);
  for (const c of sorted) {
    const needle = escapeRe(c.text.trim());
    const tries = [
      new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, 'giu'),
      new RegExp(needle, 'giu'),
    ];
    for (const re of tries) {
      const hits = [...text.matchAll(re)]
        .map((m) => ({ end: m.index + m[0].length, key: c.key, start: m.index }))
        .filter((h) => free(h.start, h.end));
      if (hits.length === 0) continue;
      taken.push(...(isYear(c.text.trim()) ? hits : hits.slice(0, 1)));
      break;
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}

/** Os valores do item que podem aparecer na referência, com a chave do campo. */
export function referenceCandidates(item: XElement, opts: LayoutOptions): Candidate[] {
  return flatten(item).flatMap((el, i) => {
    if (el.name === 'AUTORES') {
      return [{ key: `${i}:*`, text: abntAuthor(readAuthor(el)) }];
    }
    return el.attrs
      .filter((a) => a.value.trim() !== '' && isUsable(el, a.name, opts))
      .map((a) => ({
        key: `${i}:${a.name}`,
        text: partText({ attr: a.name, el, key: `${i}:${a.name}` }),
      }));
  });
}

/** Ordem da citação: título, onde saiu, lugar, ano, volume, páginas, DOI. */
const CITATION_ORDER: RegExp[] = [
  /^TITULO-(?!.*(PERIODICO|ANAIS|LIVRO|JORNAL)).*(?<!INGLES)$/,
  /^(NOME-DO-EVENTO|TITULO-DO-PERIODICO|TITULO-DOS-ANAIS|TITULO-DO-LIVRO|TITULO-DO-JORNAL|NOME-DA-EDITORA|NOME-DOS-ORGANIZADORES)/,
  /^(CIDADE|LOCAL|PAIS)/,
  /^ANO/,
  /^(VOLUME|FASCICULO|SERIE|NUMERO-DA-EDICAO|NUMERO-DE-VOLUMES)/,
  /^PAGINA/,
  /^DOI$/,
];

/** Campo que entra na referência da NBR 6023 (título, onde saiu, lugar, ano, volume, páginas, DOI). */
export function isCitationAttr(attr: string): boolean {
  return CITATION_ORDER.some((re) => re.test(attr));
}

export function citationRank(attr: string): number {
  const i = CITATION_ORDER.findIndex((re) => re.test(attr));
  return i < 0 ? CITATION_ORDER.length * 10 + rowRank(attr) : i;
}

/**
 * Os campos preenchidos de uma produção na ordem da citação. Dos autores, só
 * o que a referência não mostra (CPF, por exemplo): nome e forma de citação
 * já estão nela.
 */
export function citationFields(item: XElement, opts: LayoutOptions): Part[] {
  return flatten(item)
    .flatMap((el, i) =>
      el.attrs
        .filter((a) => isUsable(el, a.name, opts))
        .filter((a) => el.name !== 'AUTORES' || !AUTHOR_FIELDS.includes(a.name))
        .map((a): Part => ({ attr: a.name, el, key: `${i}:${a.name}` })),
    )
    .filter(isFilled)
    .sort((a, b) => citationRank(a.attr) - citationRank(b.attr));
}

/**
 * Campos preenchidos que a referência não mostra (ISSN, idioma, palavras-chave):
 * a leitura os mostra em linhas de rótulo e valor abaixo dela.
 */
export function outsideReference(item: XElement, opts: LayoutOptions): Part[] {
  const text = referenceText(referenceFor(item));
  const shown = new Set(
    referenceHighlights(text, referenceCandidates(item, opts)).map((h) => h.key),
  );
  // Dois campos com o mesmo valor (o ano do trabalho e o de realização) aparecem
  // juntos no mesmo trecho: os dois contam como mostrados.
  const appears = (p: Part) => appearsIn(text, partText(p));
  return citationFields(item, opts).filter((p) => !shown.has(p.key) && !appears(p));
}

/** O valor aparece no texto como palavra inteira, sem diferença de maiúscula. */
export function appearsIn(text: string, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/** Um pedaço da referência para compor: o texto, se é destaque, e os campos dele. */
export interface Piece {
  /** Chaves dos campos (posição:atributo); vazio nos trechos fixos ("In:", "[S. l.]"). */
  keys: string[];
  strong?: boolean;
  text: string;
}

/**
 * Corta os trechos da referência nas bordas de cada campo. Cada pedaço leva
 * as chaves de todos os campos que ele mostra: o do trecho e os outros de
 * mesmo valor (o ano do trabalho e o de realização caem no mesmo "2023").
 */
export function splitSegments(
  segments: Segment[],
  highlights: (Highlight & { also?: string[] })[],
): Piece[] {
  const out: Piece[] = [];
  let pos = 0;
  for (const seg of segments) {
    const start = pos;
    const end = pos + seg.text.length;
    const cuts = new Set([start, end]);
    for (const h of highlights) {
      if (h.start > start && h.start < end) cuts.add(h.start);
      if (h.end > start && h.end < end) cuts.add(h.end);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const h = highlights.find((x) => x.start <= a && x.end >= b);
      const keys = h ? [h.key, ...(h.also ?? [])] : [];
      out.push({ keys, strong: seg.strong, text: seg.text.slice(a - start, b - start) });
    }
    pos = end;
  }
  return out;
}

/**
 * A referência do item em pedaços, cada um com as chaves dos campos de onde
 * veio, na mesma conta de chaves do formulário (partKeys em reading-layout.ts).
 * O autor ("3:*") vira as chaves do nome e da forma de citação dele.
 */
export function referencePieces(item: XElement, opts: LayoutOptions): Piece[] {
  const segments = referenceFor(item);
  const text = referenceText(segments);
  const candidates = referenceCandidates(item, opts);
  const els = flatten(item);
  const expand = (key: string) => {
    if (!key.endsWith(':*')) return [key];
    const i = Number(key.slice(0, -2));
    const el = els[i];
    return AUTHOR_FIELDS.filter((a) => el?.attrs.some((x) => x.name === a)).map((a) => `${i}:${a}`);
  };
  const fold = (t: string) => t.trim().toLocaleLowerCase('pt-BR');
  const highlights = referenceHighlights(text, candidates).map((h) => {
    const shown = fold(text.slice(h.start, h.end));
    const also = candidates
      .filter((c) => c.key !== h.key && fold(c.text) === shown)
      .flatMap((c) => expand(c.key));
    const [key, ...rest] = expand(h.key);
    return { ...h, also: [...rest, ...also], key: key ?? h.key };
  });
  return splitSegments(segments, highlights);
}
