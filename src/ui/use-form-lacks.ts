// A pergunta "o formulário do Lattes tem este campo?" para a cópia aberta,
// com a exportação de origem lida uma vez (src/bridge/form-lacks.ts).

import { useMemo } from 'react';

import { childLacks, formLacks } from '../bridge/form-lacks.ts';
import { pathTo, resolvePath } from '../model/changes.ts';
import { getAttr, parseXml, type XElement } from '../model/xml.ts';
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
            keyOf: (el: XElement) => pathTo(working, el)?.join('/'),
            original: (el: XElement, attr: string) => {
              const path = pathTo(working, el);
              const chain = path ? resolvePath(original, path) : [];
              const was = path && chain.length === path.length ? chain.at(-1) : undefined;
              return was ? getAttr(was, attr) : undefined;
            },
          }
        : undefined,
    [original, working],
  );
}
