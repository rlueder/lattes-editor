// O aviso do formulário de item novo quando ele se parece com um item que já
// está no currículo (LAT-45): o candidato, a pontuação e o motivo. Só avisa;
// a pessoa decide se salva.

import { useDeferredValue, useMemo, useRef } from 'react';

import type { XElement } from '../model/xml.ts';
import { type Candidate, candidateLine, type ProfileCache, reasons } from '../review/dedup.ts';

export function DuplicateNotice({
  find,
  item,
  version,
}: {
  /** Sem ela (item que já existia), não avisa nada. */
  find?: (item: XElement, cache: ProfileCache) => Candidate | undefined;
  item: XElement;
  /** Muda a cada edição do item, que é mutado no lugar. */
  version: number;
}) {
  // Os itens do currículo são lidos uma vez por formulário aberto; a cada
  // edição, só o rascunho. A conta espera a digitação, sem travar o campo.
  const cache = useRef<ProfileCache>(new Map());
  const settled = useDeferredValue(version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const duplicate = useMemo(() => find?.(item, cache.current), [item, settled]);
  if (!duplicate) return null;
  return (
    <p className="form-duplicate" role="status">
      {candidateLine(duplicate)}: {reasons(duplicate).join(' · ')}. Confira antes de salvar.
    </p>
  );
}
