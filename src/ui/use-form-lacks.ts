// A pergunta "o formulário do Lattes tem este campo?" para a cópia aberta,
// com a exportação de origem lida uma vez (src/bridge/form-lacks.ts).

import { useMemo } from 'react';

import { childLacks, formLacks } from '../bridge/form-lacks.ts';
import { parseXml, type XElement } from '../model/xml.ts';
import type { FormLacks } from './form-lacks-context.ts';

export function useFormLacksFor(
  originalXml: string | undefined,
  working: XElement | undefined,
): FormLacks | undefined {
  const original = useMemo(
    () => (originalXml ? parseXml(originalXml).root : undefined),
    [originalXml],
  );
  return useMemo(
    () =>
      original && working
        ? {
            child: (item: XElement, name: string) => childLacks(original, working, item, name),
            field: (el: XElement, attr: string) => formLacks(original, working, el, attr),
          }
        : undefined,
    [original, working],
  );
}
