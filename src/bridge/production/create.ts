// Incluir pelo formulário do Lattes um item novo de produção, orientação ou
// banca, no lugar do arquivo do Importar: o mesmo formulário da alteração,
// aberto pelo link "Incluir novo item" da lista (f_ctr=I), com os campos, as
// grades e as buscas da especificação do tipo (targets/). applyProduction
// (apply.ts) envia, acha o item novo na lista pelo título e pelo ano e confere.
//
// Inferido até o teste acompanhado no Lattes real: que o POST de inclusão
// grave como o de alteração, e que o item novo apareça na lista com o título e
// o ano enviados. Por isso fica atrás de CREATE_PRODUCTION_ENABLED.

import { attributeLabel } from '../../labels/labels.ts';
import type { Change } from '../../model/changes.ts';
import { childElements, getAttr, type XElement } from '../../model/xml.ts';
import { screenApplies, screenFieldsOf } from '../../schema/screen-fields.ts';
import { GENERAL_CREATES } from '../create-general.ts';
import { REGISTRY_TYPES } from '../create-registro.ts';
import { mapOf, partOf } from '../refresh/from-form.ts';
import { AUTHOR_PART, authorsOf, MAX_KEYWORDS } from './grids.ts';
import { productionIdentity } from './identity.ts';
import { itemAreasAndSetores } from './item-lists.ts';
import { inclusionPath } from './locate.ts';
import { lookupAttrs, planLookups } from './lookups.ts';
import type { ProductionOp, ProductionRow } from './plan.ts';
import { PRODUCTION_TARGETS } from './targets/index.ts';
import type { ProductionTarget } from './types.ts';

/**
 * A inclusão de produção pelo formulário. Desligada até o teste no Lattes
 * real: sem ela, o item novo vai pelo Importar, como sempre.
 */
export const CREATE_PRODUCTION_ENABLED = false;

/**
 * Os tipos que a inclusão pelo formulário leva: os do motor de alteração,
 * menos os que o conector já inclui por outro caminho (projeto, patente,
 * registros, licença) e os que pedem uma grade que a inclusão ainda não monta
 * (depositantes, órgão, grades opacas).
 */
let creatable: readonly ProductionTarget[] | undefined;

// Calculado na primeira chamada: os módulos de inclusão se importam em ciclo.
export function creatableTargets(): readonly ProductionTarget[] {
  return (creatable ??= PRODUCTION_TARGETS.filter(
    (t) =>
      !(t.element in REGISTRY_TYPES) &&
      !GENERAL_CREATES.has(t.element) &&
      t.id !== 'projeto' &&
      t.id !== 'linha-de-pesquisa' &&
      !t.holders &&
      !t.organ &&
      !t.opaqueGrids?.length,
  ));
}

export const creatableTarget = (element: string): ProductionTarget | undefined =>
  creatableTargets().find((t) => t.element === element);

const KEYWORD_ATTRS = Array.from({ length: MAX_KEYWORDS }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

/** Um item de produção novo como inclusão pelo formulário; o motivo, quando não vai. */
export function planCreateProduction(
  change: Change,
  item: XElement,
  label: string,
  extras: Readonly<Record<string, Readonly<Record<string, string>>>> = {},
): ProductionOp | { reason: string } {
  const t = creatableTarget(item.name);
  if (!t) return { reason: 'Este tipo não se inclui pelo formulário do Lattes' };
  if (!inclusionPath(t, '')) {
    return { reason: 'O endereço do formulário de inclusão deste tipo não é conhecido' };
  }
  // Sem mudança: productionIdentity lê o título, o ano e a lista do próprio item.
  const located = productionIdentity({ ...change, fields: [] }, item, t);
  if ('reason' in located) return located;
  const set: Record<string, string> = {};
  const rows: ProductionRow[] = [];
  const manual: string[] = [];
  const add = (field: string, value: string, shownValue: string, rowLabel: string) => {
    set[field] = value;
    if (shownValue) rows.push({ after: shownValue, before: '', label: rowLabel, name: field });
  };
  const chosen = new Set(t.lookups ? lookupAttrs(t.lookups) : []);
  for (const [key, m] of Object.entries(t.fields)) {
    const [child, attr] = key.split('@') as [string, string];
    if (t.lookups && child === t.lookups.child && chosen.has(attr)) continue;
    const part = partOf(item, child);
    const value = (part && getAttr(part, attr)) ?? '';
    if (!value.trim()) continue;
    const why = t.byHand?.[child] ?? t.manual?.[key];
    if (why) {
      manual.push(why);
      continue;
    }
    const ask = t.asks?.[key];
    const map = mapOf(m);
    if (ask && value === ask.when) {
      const text = extras[change.key]?.[ask.field]?.trim() ?? '';
      if (!text) return { reason: ask.reason };
      set[ask.flag[0]] = ask.flag[1];
      set[ask.field] = text;
      continue;
    }
    const sent = map.toForm ? map.toForm(value, 'after') : value;
    if (sent === undefined) {
      return { reason: map.unmapped ?? `Valor que o formulário do Lattes não tem: ${attr}` };
    }
    if (map.field.includes(':')) continue;
    add(map.field, sent, value, attributeLabel(attr));
  }
  if (manual.length > 0) return { reason: [...new Set(manual)].join('; ') };
  // Os campos só de tela do item (a visibilidade).
  for (const f of screenFieldsOf(item.name)) {
    const value = getAttr(item, f.attr) ?? '';
    if (value && screenApplies(f, item))
      add(f.fields[item.name]!, value, value, attributeLabel(f.attr));
  }
  // Instituição, curso e agência: pelas buscas, como na alteração.
  let lookups: ProductionOp['lookups'];
  const lookupPart = t.lookups && partOf(item, t.lookups.child);
  if (t.lookups && lookupPart) {
    const fields = lookupAttrs(t.lookups)
      .map((attr) => ({ after: getAttr(lookupPart, attr) ?? '', attr, before: '', label: attr }))
      .filter((f) => f.after);
    if (fields.length > 0) {
      const planned = planLookups({ ...change, fields }, t.lookups, lookupPart);
      if ('reason' in planned) return planned;
      lookups = planned.lookups;
      rows.push(...planned.rows);
    }
  }
  const part = t.authors ?? AUTHOR_PART;
  const people = t.grids.includes('f_autores_l')
    ? authorsOf(childElements(item, part.element), part)
    : [];
  const keywordPart = childElements(item, 'PALAVRAS-CHAVE')[0];
  const words = keywordPart
    ? KEYWORD_ATTRS.map((a) => (getAttr(keywordPart, a) ?? '').trim()).filter(Boolean)
    : [];
  if (words.length > 0 && !t.grids.includes('f_plv_l')) {
    return { reason: 'O formulário deste tipo no Lattes não tem palavras-chave' };
  }
  const lists = itemAreasAndSetores(item);
  if ('reason' in lists) return lists;
  return {
    create: true,
    expect: {},
    key: change.key,
    kind: 'producao',
    label,
    ...(located.listParams ? { listParams: located.listParams } : {}),
    match: located.match,
    rows,
    set,
    target: t.id,
    ...(people.length > 0 ? { authors: { after: people, before: [] } } : {}),
    ...(words.length > 0 ? { keywords: { after: words, before: [] } } : {}),
    ...(lists.areas.length > 0 && t.grids.includes('f_area_l')
      ? { areas: { after: lists.areas, before: [] } }
      : {}),
    ...(lists.setores.length > 0 && t.grids.includes('f_setor_l')
      ? { setores: { after: lists.setores, before: [] } }
      : {}),
    ...(lookups ? { lookups } : {}),
  };
}
