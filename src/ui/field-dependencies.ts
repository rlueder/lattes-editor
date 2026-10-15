// Campo que decide as opções ou os valores de outros vem antes deles no
// formulário, na ordem da prévia e na do Lattes: a grande área antes da área,
// a forma de participação antes do tipo. As dependências saem do que o
// código já sabe, não de uma lista por formulário:
//
// - a hierarquia das áreas do conhecimento (live-lists.ts, AREA_ATTRS, e a
//   seção 18 de docs/lattes_internals.md): grande área, área, subárea,
//   especialidade;
// - as listas que dependem de outro campo (typed-choices.ts, CHOICE_SOURCE):
//   a forma de participação decide os tipos;
// - os campos que o formulário do Lattes abre por um tipo (form-order.ts,
//   formSwitches): o tipo de mestrado ou doutorado abre o sanduíche e a
//   cotutela.

import { CHOICE_SOURCE, isEventBasics } from '../schema/typed-choices.ts';
import type { FieldEntry, FieldGroup } from './field-kind.ts';
import { formSwitches } from './form-order.ts';
import { AREA_ATTRS, isAreaElement } from './live-lists.ts';

/** [campo que decide, campos que dependem dele], na ordem em que se resolvem. */
export function dependenciesOf(element: string): [string, string[]][] {
  const deps: [string, string[]][] = [];
  if (isAreaElement(element)) {
    const chain = [AREA_ATTRS.bigArea, AREA_ATTRS.area, AREA_ATTRS.subArea, AREA_ATTRS.specialty];
    chain.slice(0, -1).forEach((attr, i) => deps.push([attr, chain.slice(i + 1)]));
  }
  if (isEventBasics(element)) {
    for (const [controlled, controller] of Object.entries(CHOICE_SOURCE)) {
      deps.push([controller, [controlled]]);
    }
  }
  deps.push(...formSwitches(element));
  return deps;
}

/**
 * Põe cada campo que decide logo antes do primeiro campo que depende dele, no
 * grupo desse campo, quando ainda não vem antes. O código do Lattes que anda
 * ao lado do nome (codeOf) vai junto.
 */
export function controllersFirst(
  groups: FieldGroup[],
  codeOf: (element: string, attr: string) => string | undefined,
): FieldGroup[] {
  const out = groups.map((g) => ({ ...g, entries: [...g.entries] }));
  const position = (pred: (e: FieldEntry) => boolean) => {
    for (let gi = 0; gi < out.length; gi++) {
      const ei = out[gi]!.entries.findIndex(pred);
      if (ei >= 0) return { ei, gi };
    }
    return undefined;
  };
  const before = (a: { ei: number; gi: number }, b: { ei: number; gi: number }) =>
    a.gi < b.gi || (a.gi === b.gi && a.ei < b.ei);
  const elements = [...new Set(out.flatMap((g) => g.entries.map((e) => e.element)))];
  for (const element of elements) {
    for (const [controller, controlled] of dependenciesOf(element)) {
      const from = position((e) => e.element === element && e.attr === controller);
      const target = position((e) => e.element === element && controlled.includes(e.attr));
      if (!from || !target || before(from, target)) continue;
      const group = out[from.gi]!.entries;
      const code = codeOf(element, controller);
      const take = group[from.ei + 1]?.attr === code && code !== undefined ? 2 : 1;
      const moved = group.splice(from.ei, take);
      // Tirar o campo de antes no mesmo grupo não muda a posição do alvo; de
      // depois, também não: o alvo vem antes dele.
      const at = position((e) => e.element === element && controlled.includes(e.attr))!;
      out[at.gi]!.entries.splice(at.ei, 0, ...moved);
    }
  }
  return out.filter((g) => g.entries.length > 0);
}
