// A grade de pessoas de um item quando não é a de autores: hoje, a equipe do
// projeto (EQUIPE-DO-PROJETO > INTEGRANTES-DO-PROJETO). A página serializa a
// equipe em f_autores_l com as chaves c, l, t, tit e add (seção 21 de
// docs/lattes_internals.md, lida no código do check()); o check() exige a
// própria pessoa e um coordenador, e só um. A linha do coordenador leva tit
// "s" (seção 22); a de quem não é coordenador, "n", como a de um autor
// digitado na hora (seção 21).
//
// A mudança vira uma operação de autores (ProductionOp.authors), com a marca
// de responsável de cada um: o resto do envio é o das produções (apply.ts).

import { type Change, resolvePath } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { childElements, element, getAttr, type XElement } from '../../model/xml.ts';
import { NO_OWNER_NAME, ownerNamesOf } from '../author-grid.ts';
import { authorNames, type AuthorSpec, type GridRow, sameWords } from './grids.ts';
import type { ProductionOp } from './plan.ts';
import type { AuthorPart } from './types.ts';

/** A grade de pessoas num contêiner (AuthorPart com container). */
export type MemberSpec = AuthorPart & { container: string };

type Base = Pick<
  ProductionOp,
  'expect' | 'key' | 'kind' | 'label' | 'listParams' | 'match' | 'set' | 'target'
>;

/** As pessoas da grade, na ordem do XML. */
export function membersOf(els: XElement[], spec: AuthorPart): AuthorSpec[] {
  return [...els]
    .sort((a, b) => Number(getAttr(a, spec.order) ?? 0) - Number(getAttr(b, spec.order) ?? 0))
    .map((m) => ({
      citation: getAttr(m, spec.citation) ?? '',
      cnpq: getAttr(m, spec.cnpq) ?? '',
      ...(spec.lead ? { lead: getAttr(m, spec.lead) === 'SIM' } : {}),
      name: getAttr(m, spec.name) ?? '',
    }));
}

const shownList = (list: AuthorSpec[]) =>
  list.map((m) => (m.lead ? `${m.name} (coordenador)` : m.name)).join('; ');

/**
 * As pessoas como o Lattes tem: as de agora com todas as mudanças da fila
 * nesta grade desfeitas. Duas mudanças na mesma equipe (trocar o
 * coordenador mexe em duas pessoas) viram duas operações iguais; a segunda
 * acha o Lattes já como o editor quer, e não envia nada (apply.ts).
 */
function originalMembers(
  changes: readonly Change[],
  current: XElement[],
  root: XElement,
): XElement[] {
  let list = [...current];
  for (const c of changes) {
    const target = resolvePath(root, c.path).at(-1);
    if (c.kind === 'novo') list = list.filter((m) => m !== target);
    else if (c.kind === 'removido') {
      list.push(element(c.element, Object.fromEntries(c.fields.map((f) => [f.attr, f.before]))));
    } else {
      list = list.map((m) =>
        m === target
          ? {
              ...m,
              attrs: m.attrs.map((x) => {
                const f = c.fields.find((y) => y.attr === x.name);
                return f ? { ...x, value: f.before } : x;
              }),
            }
          : m,
      );
    }
  }
  return list;
}

/** A alteração da grade de pessoas, ou o motivo de ficar à mão. */
export function planMembers(
  change: Change,
  item: XElement,
  spec: MemberSpec,
  base: Base,
  root: XElement | undefined,
  siblings: readonly Change[] = [],
): ProductionOp | { reason: string } {
  if (change.element === spec.container && change.kind === 'removido') {
    return { reason: 'Tirar a equipe inteira não vai pelo conector: o Lattes exige você nela' };
  }
  // Citação e ID CNPq vêm com a linha da lista de autores do Lattes (autorDP):
  // a grade leva de volta só o que está em `sent`.
  const own = new Set(spec.sent ?? [spec.name, spec.order, ...(spec.lead ? [spec.lead] : [])]);
  if (change.kind === 'alterado' && change.fields.every((f) => !own.has(f.attr))) {
    return {
      reason:
        'A citação e o ID CNPq de um integrante vêm da lista de autores do Lattes; o conector não os troca',
    };
  }
  const container = childElements(item, spec.container)[0];
  const current = container ? childElements(container, spec.element) : [];
  // As mudanças da fila nesta mesma grade, com esta.
  const inGrid = (c: Change) =>
    c.element === spec.element && !!root && resolvePath(root, c.path).includes(item);
  const related = [change, ...siblings.filter((c) => c.key !== change.key && inGrid(c))];
  const beforeEls =
    change.element === spec.container || !root ? [] : originalMembers(related, current, root);
  const after = membersOf(current, spec);
  const before = membersOf(beforeEls, spec);
  if (spec.lead && after.filter((m) => m.lead).length !== 1) {
    return { reason: 'O Lattes exige um coordenador na equipe, e só um' };
  }
  const owner = ownerNamesOf(root);
  if (!owner) return { reason: NO_OWNER_NAME };
  const isOwner = (m: AuthorSpec) =>
    foldText(m.name) === foldText(owner.full) ||
    owner.citations.some((c) => foldText(c) === foldText(m.citation));
  if (!after.some(isOwner)) return { reason: 'O Lattes exige você na equipe' };
  return {
    ...base,
    authors: { after, before },
    expect: { f_autores_l: shownList(before) },
    rows: [
      {
        after: shownList(after),
        before: shownList(before),
        label: spec.label,
        name: 'f_autores_l',
      },
    ],
    set: { f_autores_l: shownList(after) },
  };
}

const isLead = (row: GridRow) =>
  String(row.tit ?? '')
    .trim()
    .toLowerCase() === 's';

/** A grade bate com as pessoas: os nomes na ordem e, onde há a marca, o responsável. */
export function sameAuthors(rows: readonly GridRow[], list: readonly AuthorSpec[]): boolean {
  if (
    !sameWords(
      authorNames(rows),
      list.map((a) => a.name),
    )
  )
    return false;
  if (!list.some((a) => a.lead !== undefined)) return true;
  const named = rows.filter((r) => typeof r.l === 'string' && r.l.trim() !== '');
  return named.every((r, i) => isLead(r) === Boolean(list[i]!.lead));
}

/**
 * As linhas com a marca de responsável de cada pessoa: tit "s" ou "n", no
 * lugar dela quando a linha já a tem (a ordem das chaves decide a
 * serialização), e no fim quando não tem. Sem a marca nas pessoas, as linhas
 * ficam como estão.
 */
export function withLeads(rows: GridRow[], list: readonly AuthorSpec[]): GridRow[] {
  if (!list.some((a) => a.lead !== undefined)) return rows;
  return rows.map((row, i) => {
    const tit = list[i]?.lead ? 's' : 'n';
    if ('tit' in row) {
      return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k === 'tit' ? tit : v]));
    }
    return Object.fromEntries([...Object.entries(row), ['tit', tit]]);
  });
}
