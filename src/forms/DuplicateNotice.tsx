// O aviso do formulário de item novo quando ele se parece com um item que já
// está no currículo (LAT-45): o candidato, a pontuação e o motivo. Só avisa;
// a pessoa decide se salva.

import { useDeferredValue, useMemo } from 'react';

import type { XElement } from '../model/xml.ts';
import { candidateLine, closestIn, cvIndex, reasons } from '../review/dedup.ts';

export function DuplicateNotice({
  item,
  root,
  version,
}: {
  item: XElement;
  /** O currículo aberto; sem ele (item que já existia), não avisa nada. */
  root?: XElement;
  /** Muda a cada edição do item, que é mutado no lugar. */
  version: number;
}) {
  // O currículo é lido uma vez por formulário (e de novo se o documento
  // trocar); a cada edição, só o rascunho. A conta espera a digitação.
  const index = useMemo(() => (root ? cvIndex(root) : undefined), [root]);
  const settled = useDeferredValue(version);
  const duplicate = useMemo(
    () => (index ? closestIn(item, index) : undefined),
    // O rascunho é mutado no lugar: settled é o que avisa que ele mudou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, item, settled],
  );
  if (!duplicate) return null;
  return (
    <p className="form-duplicate" role="status">
      {candidateLine(duplicate)}: {reasons(duplicate).join(' · ')}. Confira antes de salvar.
    </p>
  );
}
