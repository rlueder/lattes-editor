// Produção no modo de leitura: a referência da NBR 6023, com o destaque em
// itálico, e abaixo dela os campos preenchidos que a referência não mostra.

import { Fragment, type ReactNode } from 'react';

import type { XElement } from '../model/xml.ts';
import { linkRanges } from './link-fields.ts';
import { curlyQuotes } from './reading.ts';
import { outsideReference, type Piece, referencePieces } from './reading-reference.ts';
import { ExternalLink, Rows } from './ReadingParts.tsx';
import { useLayoutOptions } from './use-reading-options.ts';

/**
 * Referência na leitura: o destaque da NBR 6023 (periódico, anais, livro) em
 * itálico, mais leve que o negrito na serifa. A norma aceita negrito ou
 * itálico, desde que o documento use um só; a impressão segue em negrito.
 */
export function CitationReading({ el, kind }: { el: XElement; kind?: string }) {
  const opts = useLayoutOptions();
  return (
    <>
      <p className="rr-text rr-ref">
        {kind && <span className="rr-kind">{kind}</span>}
        <ReferenceText pieces={referencePieces(el, opts)} />
      </p>
      <Rows parts={outsideReference(el, opts)} quiet={true} />
    </>
  );
}

/**
 * Um pedaço da referência, dentro de um span com a chave de cada campo de
 * onde veio (um dentro do outro), para o campo em foco acender o trecho.
 * Trechos fixos ("In:", "[S. l.: s. n.]") não têm campo.
 */
function PieceText({ piece }: { piece: Piece }) {
  const text = curlyQuotes(piece.text);
  let node: ReactNode = piece.strong ? <em>{text}</em> : text;
  for (const key of [...piece.keys].reverse()) node = <span data-part={key}>{node}</span>;
  return node;
}

/**
 * A referência inteira. Os endereços dela ("DOI: https://doi.org/…") viram
 * link sobre os pedaços, que podem vir partidos (o prefixo fixo e o DOI do
 * campo): o texto e a pontuação não mudam, e cada pedaço continua com a
 * chave dele dentro do link.
 */
function ReferenceText({ pieces }: { pieces: Piece[] }) {
  const links = linkRanges(pieces.map((p) => p.text).join(''));
  const cut: { link: number; piece: Piece }[] = [];
  let pos = 0;
  for (const piece of pieces) {
    const start = pos;
    const end = pos + piece.text.length;
    const points = new Set([start, end]);
    for (const l of links) {
      if (l.start > start && l.start < end) points.add(l.start);
      if (l.end > start && l.end < end) points.add(l.end);
    }
    const sorted = [...points].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      cut.push({
        link: links.findIndex((l) => l.start <= a && l.end >= b),
        piece: { ...piece, text: piece.text.slice(a - start, b - start) },
      });
    }
    pos = end;
  }
  const groups: { link: number; pieces: Piece[] }[] = [];
  for (const c of cut) {
    const last = groups.at(-1);
    if (last && last.link === c.link && c.link >= 0) last.pieces.push(c.piece);
    else groups.push({ link: c.link, pieces: [c.piece] });
  }
  return groups.map((g, i) => {
    const body = g.pieces.map((p, j) => <PieceText key={j} piece={p} />);
    return g.link >= 0 ? (
      <ExternalLink key={i} href={links[g.link]!.href}>
        {body}
      </ExternalLink>
    ) : (
      <Fragment key={i}>{body}</Fragment>
    );
  });
}
