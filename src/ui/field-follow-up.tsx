// O pedido que aparece embaixo de um campo quando o envio ao Lattes precisa
// de um valor que o XML não guarda: o texto do potencial de inovação
// (InnovationText.tsx), que fica no editor pela chave do elemento.

import type { ReactNode } from 'react';

import type { XElement } from '../model/xml.ts';
import type { FormLacks } from './form-lacks-context.ts';
import { InnovationText } from './InnovationText.tsx';

type Lacks = FormLacks | undefined;

/** O pedido do campo, ou undefined quando ele não pede nada. */
export function followUpOf(
  el: XElement,
  name: string,
  value: string,
  lacks: Lacks,
): ReactNode | undefined {
  const innovation = innovationKey(el, name, value, lacks);
  if (innovation) return <InnovationText changeKey={innovation} />;
  return undefined;
}

/** A mudança de um Sim novo do potencial de inovação, que pede o texto que vai só ao Lattes. */
function innovationKey(
  el: XElement,
  name: string,
  value: string,
  lacks: Lacks,
): string | undefined {
  if (name !== 'FLAG-POTENCIAL-INOVACAO' || value !== 'SIM') return undefined;
  // No projeto que já está, ao ir para Sim; num projeto ou registro novo,
  // sempre: a inclusão também pede o texto (create-shared.ts, innovationFields).
  const asks =
    (el.name === 'PROJETO-DE-PESQUISA' && lacks?.original?.(el, name) !== 'SIM') ||
    lacks?.isNew?.(el) === true;
  return asks ? lacks?.keyOf?.(el) : undefined;
}
