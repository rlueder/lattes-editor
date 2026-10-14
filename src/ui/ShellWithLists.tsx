// A moldura do editor com as listas do Lattes lidas pelo conector
// (use-lattes-lists.ts) à disposição dos campos que as usam.

import type { ReactNode } from 'react';

import { LattesListsContext } from './lattes-lists-context.ts';
import { useLattesLists } from './use-lattes-lists.ts';

export function ShellWithLists({
  children,
  features,
}: {
  children: ReactNode;
  features: readonly string[];
}) {
  const lists = useLattesLists(features);
  return (
    <LattesListsContext.Provider value={lists}>
      <div className="shell">{children}</div>
    </LattesListsContext.Provider>
  );
}
