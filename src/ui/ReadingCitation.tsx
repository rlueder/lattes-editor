// Produção no modo de leitura: a referência da NBR 6023, com o destaque em
// itálico, e abaixo dela os campos preenchidos que a referência não mostra.

import type { XElement } from '../model/xml.ts';
import { referenceFor } from '../print/references.ts';
import { curlyQuotes } from './reading.ts';
import { outsideReference } from './reading-reference.ts';
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
        {referenceFor(el).map((s, i) =>
          s.strong ? <em key={i}>{curlyQuotes(s.text)}</em> : curlyQuotes(s.text),
        )}
      </p>
      <Rows parts={outsideReference(el, opts)} quiet={true} />
    </>
  );
}
