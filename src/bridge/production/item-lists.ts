// As áreas do conhecimento e os setores de atividade de um item (produção,
// orientação, banca, formação), nas grades f_area_l e f_setor_l. Lido em
// 19/10/2026 no Lattes real: a página traz areaProvider e setorProvider com
// linhas {l, c}, l o nome mais fundo escolhido (a especialidade, a subárea ou
// a área) e c o código dele, e o check() serializa as chaves l, c, r e p da
// área e l e c do setor (grids.ts). Uma área ou um setor novos saem das
// listas do menu: areaDP, a árvore de áreas (lattes-lists.ts), e setorDP,
// linhas {l, n, c}. As áreas criadas pela pessoa (código 9999…) só existem
// na linha que a página já traz.
//
// A mudança vira a lista inteira, a de antes e a de depois, como as
// palavras-chave: o envio confere a de antes na página e manda a de depois.

import type { Change } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { childElements, getAttr, type XElement } from '../../model/xml.ts';
import { areaCode, areaLabel, type AreaRow } from '../areas-atuacao.ts';
import { parseAreaTree } from '../lattes-lists.ts';
import { type GridRow, readProvider } from './grids.ts';

export interface AreaList {
  after: AreaRow[];
  before: AreaRow[];
}

export interface LabelList {
  after: string[];
  before: string[];
}

const AREA_SLOTS = ['AREA-DO-CONHECIMENTO-1', 'AREA-DO-CONHECIMENTO-2', 'AREA-DO-CONHECIMENTO-3'];
const SETOR_ATTRS = ['SETOR-DE-ATIVIDADE-1', 'SETOR-DE-ATIVIDADE-2', 'SETOR-DE-ATIVIDADE-3'];

const AREA_ATTRS: Record<keyof AreaRow, string> = {
  area: 'NOME-DA-AREA-DO-CONHECIMENTO',
  bigArea: 'NOME-GRANDE-AREA-DO-CONHECIMENTO',
  specialty: 'NOME-DA-ESPECIALIDADE',
  subArea: 'NOME-DA-SUB-AREA-DO-CONHECIMENTO',
};

const rowOf = (get: (attr: string) => string): AreaRow => ({
  area: get(AREA_ATTRS.area),
  bigArea: get(AREA_ATTRS.bigArea),
  specialty: get(AREA_ATTRS.specialty),
  subArea: get(AREA_ATTRS.subArea),
});

const filled = (r: AreaRow) => Boolean(areaLabel(r));

/** A mudança é das áreas do item? */
export const isAreaChange = (change: Change) =>
  AREA_SLOTS.includes(change.element) || change.element === 'AREAS-DO-CONHECIMENTO';

/** As áreas antes e depois desta mudança, nas posições 1 a 3. */
export function planAreaList(change: Change, item: XElement): AreaList | { reason: string } {
  // A mudança do contêiner leva as áreas dentro dele: novo, antes não havia
  // nenhuma; removido, não se sabe quais eram.
  if (change.element === 'AREAS-DO-CONHECIMENTO' && change.kind === 'removido') {
    return { reason: 'Tirar todas as áreas de uma vez: tire uma de cada vez' };
  }
  const allNew = change.element === 'AREAS-DO-CONHECIMENTO' && change.kind === 'novo';
  const container = childElements(item, 'AREAS-DO-CONHECIMENTO')[0];
  const slots = AREA_SLOTS.map((name) =>
    container ? childElements(container, name)[0] : undefined,
  );
  const after = slots.map((el) =>
    el && !(change.kind === 'removido' && el.name === change.element)
      ? rowOf((a) => getAttr(el, a) ?? '')
      : rowOf(() => ''),
  );
  const before = AREA_SLOTS.map((name, i) => {
    if (allNew) return rowOf(() => '');
    if (name !== change.element) return after[i]!;
    if (change.kind === 'novo') return rowOf(() => '');
    const now = slots[i];
    return rowOf(
      (a) =>
        change.fields.find((f) => f.attr === a)?.before ?? (now ? (getAttr(now, a) ?? '') : ''),
    );
  });
  if (after.some((r) => r.bigArea && !r.area)) {
    return { reason: 'Área do conhecimento sem área: o Lattes não aceita só a grande área' };
  }
  return { after: after.filter(filled), before: before.filter(filled) };
}

/** Os setores antes e depois desta mudança. */
export function planSetorList(change: Change, el: XElement): LabelList {
  const now = SETOR_ATTRS.map((a) => (change.kind === 'removido' ? '' : (getAttr(el, a) ?? '')));
  const was = SETOR_ATTRS.map((a, i) => {
    const f = change.fields.find((x) => x.attr === a);
    return f ? f.before : change.kind === 'novo' ? '' : now[i]!;
  });
  const clean = (list: string[]) => list.map((w) => w.trim()).filter(Boolean);
  return { after: clean(now), before: clean(was) };
}

/** Os rótulos de uma grade de áreas ou setores, como a página os mostra. */
export const gridLabels = (rows: readonly GridRow[]) =>
  rows.map((r) => r.l).filter((l): l is string => typeof l === 'string' && l.trim() !== '');

export const sameLabels = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => foldText(x.trim()) === foldText(b[i]!.trim()));

const ordered = (l: string, c: string): GridRow =>
  Object.fromEntries([
    ['l', l],
    ['c', c],
    ['editable', false],
  ]);

/**
 * As linhas da grade de áreas para a lista nova: a que já estava fica com a
 * linha dela; a nova sai da árvore do menu pelo nome. undefined no unknown:
 * a área que não está em nenhuma das duas.
 */
export function areaGridRows(
  current: readonly GridRow[],
  menu: string,
  after: readonly AreaRow[],
): { rows: GridRow[] } | { unknown: string[] } {
  const tree = parseAreaTree(menu) ?? [];
  const rows: GridRow[] = [];
  const unknown: string[] = [];
  for (const r of after) {
    const label = areaLabel(r);
    const old = current.find((c) => typeof c.l === 'string' && foldText(c.l) === foldText(label));
    if (old) {
      rows.push(old);
      continue;
    }
    const code = areaCode(tree, r);
    if (code) rows.push(ordered(label, code));
    else unknown.push(label);
  }
  return unknown.length > 0 ? { unknown } : { rows: [...rows, {}] };
}

/** As linhas da grade de setores: a que estava fica; a nova sai de setorDP pelo nome. */
export function setorGridRows(
  current: readonly GridRow[],
  menu: string,
  after: readonly string[],
): { rows: GridRow[] } | { unknown: string[] } {
  const list = flatten(readProvider(menu, 'setorDP') ?? []);
  const rows: GridRow[] = [];
  const unknown: string[] = [];
  for (const label of after) {
    const same = (x: GridRow) => typeof x.l === 'string' && foldText(x.l) === foldText(label);
    const old = current.find(same);
    if (old) {
      rows.push(old);
      continue;
    }
    const hit = list.find(same);
    if (hit && hit.c !== undefined) rows.push(ordered(String(hit.l), String(hit.c)));
    else unknown.push(label);
  }
  return unknown.length > 0 ? { unknown } : { rows: [...rows, {}] };
}

/** Uma lista do menu com filhos em b, achatada. */
function flatten(rows: readonly GridRow[]): GridRow[] {
  return rows.flatMap((r) => [r, ...(Array.isArray(r.b) ? flatten(r.b as GridRow[]) : [])]);
}
