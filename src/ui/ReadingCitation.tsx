// Produção no modo de leitura: a referência da NBR 6023, com o destaque em
// itálico, e abaixo dela os campos preenchidos que a referência não mostra.

import type { ReactNode } from 'react';

import type { XElement } from '../model/xml.ts';
import { curlyQuotes } from './reading.ts';
import { outsideReference, type Piece, referencePieces } from './reading-reference.ts';
import { Rows } from './ReadingParts.tsx';
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
        {referencePieces(el, opts).map((p, i) => (
          <PieceText key={i} piece={p} />
        ))}
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
