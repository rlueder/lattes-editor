// Referência viva do modo de leitura: na edição de uma produção, a referência
// da NBR 6023 fica no topo e acompanha o que se digita; cada campo acende o
// trecho dele na referência, e clicar num trecho leva ao campo. Sem React.

import { readAuthor } from '../model/production.ts';
import { cloneElement, getAttr, setAttr, type XElement } from '../model/xml.ts';
import { abntAuthor, referenceText, type Segment } from '../print/abnt.ts';
import { referenceFor } from '../print/references.ts';
import {
  flatten,
  isFilled,
  isUsable,
  type LayoutOptions,
  orderEmpty,
  type Part,
  partText,
  rowRank,
} from './reading-layout.ts';

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

/** Um pedaço da referência para compor: o texto, se é destaque, e o campo dele. */
export interface Piece {
  key?: string;
  strong?: boolean;
  text: string;
}

/** Corta os trechos da referência nas bordas dos destaques e dos campos. */
export function splitSegments(segments: Segment[], highlights: Highlight[]): Piece[] {
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
      out.push({ key: h?.key, strong: seg.strong, text: seg.text.slice(a - start, b - start) });
    }
    pos = end;
  }
  return out;
}

/** Chave "posição:atributo" na árvore do item. */
export type Drafts = ReadonlyMap<string, string>;

/** Cópia do item com os rascunhos dos campos aplicados, para a referência viva. */
export function withDrafts(item: XElement, drafts: Drafts): XElement {
  if (drafts.size === 0) return item;
  const copy = cloneElement(item);
  const els = flatten(copy);
  for (const [key, v] of drafts) {
    const i = Number(key.slice(0, key.indexOf(':')));
    const attr = key.slice(key.indexOf(':') + 1);
    const el = els[i];
    if (el && getAttr(el, attr) !== undefined) setAttr(el, attr, v);
  }
  return copy;
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

export interface LiveReference {
  highlights: Highlight[];
  pieces: Piece[];
  text: string;
}

/** A referência do item com os rascunhos, já cortada nos trechos de cada campo. */
export function liveReference(item: XElement, drafts: Drafts, opts: LayoutOptions): LiveReference {
  const current = withDrafts(item, drafts);
  const segments = referenceFor(current);
  const text = referenceText(segments);
  const highlights = referenceHighlights(text, referenceCandidates(current, opts));
  return { highlights, pieces: splitSegments(segments, highlights), text };
}

/** O campo acende o trecho: a mesma chave, ou o autor inteiro ("3:*"). */
export function highlightMatches(highlightKey: string, fieldKey: string): boolean {
  if (highlightKey === fieldKey) return true;
  return highlightKey.endsWith(':*') && fieldKey.startsWith(highlightKey.slice(0, -1));
}

/** Ordem da citação: título, onde saiu, lugar, ano, volume, páginas, DOI. */
export function citationRank(attr: string): number {
  const order: RegExp[] = [
    /^TITULO-(?!.*(PERIODICO|ANAIS|LIVRO|JORNAL)).*(?<!INGLES)$/,
    /^(NOME-DO-EVENTO|TITULO-DO-PERIODICO|TITULO-DOS-ANAIS|TITULO-DO-LIVRO|TITULO-DO-JORNAL|NOME-DA-EDITORA|NOME-DOS-ORGANIZADORES)/,
    /^(CIDADE|LOCAL|PAIS)/,
    /^ANO/,
    /^(VOLUME|FASCICULO|SERIE|NUMERO-DA-EDICAO|NUMERO-DE-VOLUMES)/,
    /^PAGINA/,
    /^DOI$/,
  ];
  const i = order.findIndex((re) => re.test(attr));
  return i < 0 ? order.length * 10 + rowRank(attr) : i;
}

export interface CitationFields {
  /** Campos dos autores, um grupo por autor, na ordem de autoria. */
  authors: { index: number; parts: Part[] }[];
  /** Campos vazios, obrigatórios primeiro. */
  empty: Part[];
  /** Campos preenchidos na ordem da citação. */
  filled: Part[];
}

/** Os campos de uma produção na ordem da citação, autores primeiro e vazios no fim. */
export function citationFields(item: XElement, opts: LayoutOptions): CitationFields {
  const els = flatten(item);
  const part = (el: XElement, i: number, attr: string): Part => ({ attr, el, key: `${i}:${attr}` });
  const authors = els
    .map((el, i) => ({ el, i }))
    .filter(({ el }) => el.name === 'AUTORES')
    .map(({ el, i }) => ({
      index: i,
      parts: el.attrs.filter((a) => isUsable(el, a.name, opts)).map((a) => part(el, i, a.name)),
    }));
  const rest = els.flatMap((el, i) =>
    el.name === 'AUTORES'
      ? []
      : el.attrs.filter((a) => isUsable(el, a.name, opts)).map((a) => part(el, i, a.name)),
  );
  const filled = rest.filter(isFilled).sort((a, b) => citationRank(a.attr) - citationRank(b.attr));
  const empty = orderEmpty(
    rest.filter((p) => !isFilled(p)).sort((a, b) => citationRank(a.attr) - citationRank(b.attr)),
  );
  return { authors, empty, filled };
}

/**
 * Campos preenchidos que a referência não mostra (ISSN, idioma, palavras-chave):
 * a leitura os mostra em linhas de rótulo e valor abaixo dela.
 */
export function outsideReference(item: XElement, opts: LayoutOptions): Part[] {
  const ref = liveReference(item, new Map(), opts);
  const shown = new Set(ref.highlights.map((h) => h.key));
  // Dois campos com o mesmo valor (o ano do trabalho e o de realização) aparecem
  // juntos no mesmo trecho: os dois contam como mostrados.
  const appears = (p: Part) => appearsIn(ref.text, partText(p));
  return citationFields(item, opts).filled.filter((p) => !shown.has(p.key) && !appears(p));
}

/** O valor aparece no texto como palavra inteira, sem diferença de maiúscula. */
export function appearsIn(text: string, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}
