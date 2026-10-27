// As produções e orientações ligadas a um projeto que já está no Lattes:
// incluir e tirar ligações, nas grades grid3 e grid4 (opaque.ts).
//
// Observado (27/10/2026, no projeto de teste, sem enviar): cada linha de
// grid3 traz no <span> o SEQUENCIA-PRODUCAO da produção ligada (36 o
// software, 37 a música) e a de grid4, o da orientação (38); os ocultos
// f_producoes_d e f_orientacoes_d têm os mesmos códigos unidos por "|". A
// exportação põe as duas listas em PRODUCOES-CT-DO-PROJETO, com o
// SEQUENCIA-PRODUCAO-CT igual ao código: a grade de cada ligação sai do tipo
// do item com esse número no currículo. O check() manda as grades como
// "c@" por linha (seção 21). Inferido, até o teste acompanhado: que o servidor
// grave a ligação nova só com o código na grade, sem passar pela janela de
// produções (pp_lista_prod).

import type { Change } from '../../model/changes.ts';
import { childElements, getAttr, walk, type XElement } from '../../model/xml.ts';
import type { LattesPort, ResultStatus } from '../apply.ts';
import { type FunderEdit, funderValue, planFunder } from './financiador.ts';
import { type FunderList, funderListValue, planFunderList } from './financiador-lista.ts';
import { opaqueCells } from './opaque.ts';
import type { ProductionRow } from './plan.ts';
import type { OpaqueGrid, ProductionTarget } from './types.ts';

const LINK = 'PRODUCAO-CT-DO-PROJETO';
const LINKS = 'PRODUCOES-CT-DO-PROJETO';
const CODE = 'SEQUENCIA-PRODUCAO-CT';

/** O que a operação de um projeto troca nas grades de financiadores e de ligações. */
export interface ProjectGridEdits {
  /** A natureza ou a instituição de um financiador, na linha dele (financiador.ts). */
  funder?: FunderEdit;
  /** Os financiadores que entram e saem (financiador-lista.ts). */
  funders?: FunderList;
  /** As produções e orientações ligadas. */
  links?: ProjectLinks;
}

/** As ligações do projeto, por grade: antes (como o Lattes tem) e depois. */
export interface ProjectLinks {
  orientacoes: { after: string[]; before: string[] };
  producoes: { after: string[]; before: string[] };
}

type Grid = 'orientacoes' | 'producoes';

/** A grade de um código: a de orientações quando o item com esse número é uma orientação. */
function gridOf(root: XElement, code: string): Grid | undefined {
  let name: string | undefined;
  walk(root, (el) => {
    if (!name && getAttr(el, 'SEQUENCIA-PRODUCAO') === code && el.name !== LINK) name = el.name;
  });
  if (!name) return undefined;
  return /ORIENTAC/.test(name) ? 'orientacoes' : 'producoes';
}

/** O código de uma mudança numa ligação: o do elemento, antes ou depois. */
const codeOf = (change: Change) =>
  change.fields.find((f) => f.attr === CODE)?.[change.kind === 'removido' ? 'before' : 'after'] ??
  '';

/**
 * As ligações depois da mudança e antes da fila inteira, ou o motivo de ir à
 * mão; undefined quando a mudança não é a inclusão ou a retirada de uma
 * ligação. As outras mudanças da fila no mesmo projeto entram no "antes",
 * para que todas virem a mesma operação.
 */
export function planProjectLinks(
  change: Change,
  item: XElement,
  root: XElement | undefined,
  siblings: readonly Change[],
): { links: ProjectLinks; rows: ProductionRow[] } | { reason: string } | undefined {
  const isLink = change.element === LINK || change.element === LINKS;
  if (!isLink || change.kind === 'alterado' || !root) return undefined;
  if (change.element === LINKS && change.kind === 'removido') {
    return { reason: 'Tirar todas as produções ligadas de uma vez: tire uma de cada vez' };
  }
  const container = childElements(item, LINKS)[0];
  const now = (container ? childElements(container, LINK) : []).map((l) => getAttr(l, CODE) ?? '');
  // As mudanças da fila nas ligações deste projeto, inclusive esta.
  const project = change.path.findIndex((p) => p.startsWith('PROJETO-DE-PESQUISA'));
  const prefix = `${change.path.slice(0, project + 1).join('/')}/`;
  const queued = siblings.filter(
    (c) =>
      (c.element === LINK || c.element === LINKS) &&
      c.kind !== 'alterado' &&
      c.key.startsWith(prefix),
  );
  const added = new Set<string>();
  const removed = new Set<string>();
  for (const c of queued.length ? queued : [change]) {
    if (c.element === LINKS) now.forEach((code) => added.add(code));
    else if (c.kind === 'novo') added.add(codeOf(c));
    else removed.add(codeOf(c));
  }
  const before = [...now.filter((c) => !added.has(c)), ...removed];
  const empty = (): ProjectLinks => ({
    orientacoes: { after: [], before: [] },
    producoes: { after: [], before: [] },
  });
  const links = empty();
  for (const [side, codes] of [
    ['after', now],
    ['before', before],
  ] as const) {
    for (const code of codes) {
      const grid = gridOf(root, code);
      if (!grid) return { reason: `O item ligado ${code} não está no currículo` };
      links[grid][side].push(code);
    }
  }
  const list = (side: 'after' | 'before') =>
    [...links.producoes[side], ...links.orientacoes[side]].join(', ') || '(nenhuma)';
  return {
    links,
    rows: [
      {
        after: list('after'),
        before: list('before'),
        label: 'Produções e orientações ligadas (números)',
        name: 'f_producoes_l',
      },
    ],
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * Os ocultos das duas grades com as ligações novas, ou o motivo de não
 * enviar: o Lattes com outras ligações que as de antes. 'feito' quando ele já
 * tem as de depois.
 */
export function linkValues(
  html: string,
  grids: readonly OpaqueGrid[],
  links: ProjectLinks,
): { values: Record<string, string> } | { detail: string; status: 'conferido' | 'divergente' } {
  const read = (element: string) => {
    const grid = grids.find((g) => g.element === element);
    return grid && opaqueCells(html, grid)?.map((r) => r[0] ?? '');
  };
  const producoes = read(LINKS);
  const orientacoes = read('ORIENTACOES');
  const divergent = {
    detail: 'O Lattes não está como o editor espera: Produções e orientações ligadas',
    status: 'divergente',
  } as const;
  if (!producoes || !orientacoes) return divergent;
  if (sameSet(producoes, links.producoes.after) && sameSet(orientacoes, links.orientacoes.after)) {
    return { detail: 'O Lattes já estava assim; nada foi enviado', status: 'conferido' };
  }
  if (
    !sameSet(producoes, links.producoes.before) ||
    !sameSet(orientacoes, links.orientacoes.before)
  ) {
    return divergent;
  }
  const grid = (codes: string[]) => codes.map((c) => `${c}@`).join('');
  return {
    values: {
      f_orientacoes_d: links.orientacoes.after.join('|'),
      f_orientacoes_l: grid(links.orientacoes.after),
      f_producoes_d: links.producoes.after.join('|'),
      f_producoes_l: grid(links.producoes.after),
    },
  };
}

/**
 * A mudança de projeto que vai pelas grades: a natureza ou a instituição de
 * um financiador (financiador.ts), ou incluir e tirar ligações.
 */
export function planProjectEdit(
  change: Change,
  chain: readonly XElement[],
  item: XElement,
  target: ProductionTarget,
  siblings: readonly Change[],
):
  | { funder: FunderEdit; rows: ProductionRow[] }
  | { funders: FunderList; rows: ProductionRow[] }
  | { links: ProjectLinks; rows: ProductionRow[] }
  | { reason: string }
  | undefined {
  if (!target.opaqueGrids?.length) return undefined;
  return (
    planFunder(change, chain, target) ??
    planFunderList(change, chain) ??
    planProjectLinks(change, item, chain[0], siblings)
  );
}

/** Os ocultos das grades que a operação troca, ou o resultado sem envio. */
export async function projectGridValues(
  port: LattesPort,
  path: string,
  html: string,
  grids: readonly OpaqueGrid[],
  op: ProjectGridEdits,
): Promise<{ values: Record<string, string> } | { detail: string; status: ResultStatus }> {
  if (op.links) return linkValues(html, grids, op.links);
  if (op.funders) {
    const list = await funderListValue(port, path, html, grids, op.funders);
    return 'status' in list ? list : { values: { [list.field]: list.value } };
  }
  if (!op.funder) return { values: {} };
  const funder = await funderValue(port, path, html, grids, op.funder);
  return 'status' in funder ? funder : { values: { [funder.field]: funder.value } };
}
