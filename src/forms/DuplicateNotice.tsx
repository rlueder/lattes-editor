// O aviso do formulário de item novo quando ele se parece com um item que já
// está no currículo (LAT-45): o candidato, a pontuação e o motivo. Só avisa;
// a pessoa decide se salva.

import { useMemo } from 'react';

import type { XElement } from '../model/xml.ts';
import { type Candidate, candidateLine, reasons } from '../review/dedup.ts';

export function DuplicateNotice({
  find,
  item,
  version,
}: {
  /** Sem ela (item que já existia), não avisa nada. */
  find?: (item: XElement) => Candidate | undefined;
  item: XElement;
  /** Muda a cada edição do item, que é mutado no lugar. */
  version: number;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const duplicate = useMemo(() => find?.(item), [item, version]);
  if (!duplicate) return null;
  return (
    <p className="form-duplicate" role="status">
      {candidateLine(duplicate)}: {reasons(duplicate).join(' · ')}. Confira antes de salvar.
    </p>
  );
}
