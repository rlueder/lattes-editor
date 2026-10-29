// Grupos de caixas com o mesmo nome, em que mais de uma pode estar marcada
// (a temática do projeto de ensino, f_tematica): o navegador manda um par por
// caixa marcada. O editor guarda os códigos marcados juntos, separados por
// vírgula (schema/screen-fields.ts); aqui eles viram pares e voltam.
//
// O formulário do projeto traz também um oculto de mesmo nome com X (censo de
// 27/10/2026, em todas as naturezas), como o DUMMY da deficiência (pcd.ts): ele
// fica no envio, e só os códigos das opções contam como caixas marcadas.

import { SCREEN_FIELDS } from '../schema/screen-fields.ts';
import { type Pairs, setPairs } from './form.ts';

/** Os grupos de caixas: o campo do formulário e os códigos das opções. */
const MULTI = new Map<string, ReadonlySet<string>>(
  SCREEN_FIELDS.filter((f) => f.multiple).flatMap((f) =>
    Object.values(f.fields).map((field) => [field, new Set((f.choices ?? []).map((c) => c.value))]),
  ),
);

export const MULTI_FIELDS: ReadonlySet<string> = new Set(MULTI.keys());

/** Os códigos marcados, sem ordem: o que se compara. */
export const multiKey = (value: string | null | undefined): string =>
  (value ?? '').split(',').filter(Boolean).sort().join(',');

/** Um par que é caixa marcada do grupo (e não o oculto de mesmo nome). */
const isCode = (name: string, value: string) => MULTI.get(name)?.has(value) ?? false;

/** O valor de um campo nos pares: num grupo de caixas, todos os marcados. */
export function fieldValue(pairs: Pairs, name: string): string | null {
  if (!MULTI.has(name)) return pairs.find(([k]) => k === name)?.[1] ?? null;
  return multiKey(
    pairs
      .filter(([k, v]) => k === name && isCode(name, v))
      .map(([, v]) => v)
      .join(','),
  );
}

/** Para conferir: o grupo de caixas sem ordem, o resto como veio. */
export const comparable = (name: string, value: string | null | undefined): string | null =>
  MULTI.has(name) ? multiKey(value) : (value ?? null);

/** O campo nos pares não é o valor esperado (num grupo de caixas, sem ordem). */
export const differs = (
  pairs: Pairs,
  name: string,
  want: string | null | undefined,
  fold: (v: string | null | undefined) => string,
): boolean => fold(comparable(name, fieldValue(pairs, name))) !== fold(comparable(name, want));

/**
 * Os pares com cada grupo de caixas trocado pelos códigos novos: saem as
 * caixas que estavam marcadas, fica o oculto, e os códigos entram logo depois
 * do último par do grupo que sobrou (ou no lugar do primeiro, sem oculto).
 */
export function withMulti(pairs: Pairs, set: Record<string, string | null>): Pairs {
  let out = pairs;
  for (const [name, value] of Object.entries(set)) {
    if (!MULTI.has(name)) continue;
    const codes = (value ?? '').split(',').filter(Boolean);
    const first = out.findIndex(([k]) => k === name);
    const rest = out.filter(([k, v]) => !(k === name && isCode(name, v)));
    const last = rest.findLastIndex(([k]) => k === name);
    const place = last >= 0 ? last + 1 : first >= 0 ? first : rest.length;
    out = [
      ...rest.slice(0, place),
      ...codes.map((c): [string, string] => [name, c]),
      ...rest.slice(place),
    ];
  }
  return out;
}

/** setPairs com os grupos de caixas: um par por código marcado. */
export const withChoices = (pairs: Pairs, set: Record<string, string | null>): Pairs =>
  withMulti(
    setPairs(pairs, Object.fromEntries(Object.entries(set).filter(([k]) => !MULTI.has(k)))),
    set,
  );
