// Como cada grupo de um formulário começa (aberto, fechado, ou sem fechar),
// calculado na montagem e guardado por rótulo: depois disso, quem abre e
// fecha é a pessoa. Ver disclosure.ts.

import { useRef } from 'react';

import { type FormFacts, type GroupFacts, initialGroups } from './disclosure.ts';

export interface GroupStart {
  collapsible: boolean;
  open: boolean;
}

export function useGroupStarts(
  facts: GroupFacts[],
  form: FormFacts,
): (label: string) => GroupStart {
  const started = useRef<Map<string, GroupStart> | null>(null);
  if (!started.current) {
    const first = initialGroups(facts, form);
    started.current = new Map(facts.map((f, i) => [f.label, first[i]!]));
  }
  const map = started.current;
  // Grupo que surge depois (o tipo do curso abriu o sanduíche) chega aberto.
  const long = [...map.values()].some((g) => g.collapsible);
  return (label) => map.get(label) ?? { collapsible: long, open: true };
}
