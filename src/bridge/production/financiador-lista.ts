// Incluir e tirar financiadores de um projeto que já está no Lattes, na grade
// grid2 (financiador.ts lê a linha e troca a natureza e a instituição).
//
// Tirar é deixar a linha do financiador de fora da grade, achada pelo código
// da instituição. Incluir acha a instituição pela busca do financiador e põe
// uma linha nova com a letra da natureza. Observado (27/10/2026) só a linha de
// um financiador com código do projeto e valor ("…|1234;N;|026|100,00|B|"):
// a linha nova vai com o código do projeto e a moeda e o valor vazios
// (";N;" e "|"), como a janela de edição deixaria sem eles. **Inferido**, até
// o teste acompanhado; a releitura confere a grade inteira.

import type { Change } from '../../model/changes.ts';
import { childElements, getAttr, type XElement } from '../../model/xml.ts';
import type { LattesPort, ResultStatus } from '../apply.ts';
import { FUNDER, FUNDER_NATURE, FUNDERS, searchFunder } from './financiador.ts';
import { opaqueCells, serializeCells } from './opaque.ts';
import type { ProductionRow } from './plan.ts';
import type { OpaqueGrid } from './types.ts';

/** Os financiadores que entram (nome e letra da natureza) e os que saem (código). */
export interface FunderList {
  add: { letter: string; name: string }[];
  remove: string[];
}

type Failure = { detail: string; status: ResultStatus };

/** A inclusão ou a retirada de financiadores; undefined quando a mudança não é delas. */
export function planFunderList(
  change: Change,
  chain: readonly XElement[],
): { funders: FunderList; rows: ProductionRow[] } | { reason: string } | undefined {
  const el = chain.at(-1);
  if (change.kind === 'alterado' || !el) return undefined;
  if (change.element === FUNDERS && change.kind === 'removido') {
    return { reason: 'Tirar todos os financiadores de uma vez: tire um de cada vez' };
  }
  if (change.element === FUNDER && change.kind === 'removido') {
    const code = change.fields.find((f) => f.attr === 'CODIGO-INSTITUICAO')?.before.trim() ?? '';
    if (!code) return { reason: 'Financiador sem o código da instituição para achar a linha' };
    const name = change.fields.find((f) => f.attr === 'NOME-INSTITUICAO')?.before ?? code;
    return {
      funders: { add: [], remove: [code] },
      rows: [{ after: '(sai)', before: name, label: 'Financiador', name: 'f_inst_l' }],
    };
  }
  const added =
    change.element === FUNDERS ? childElements(el, FUNDER) : change.element === FUNDER ? [el] : [];
  if (added.length === 0) return undefined;
  const add: FunderList['add'] = [];
  for (const f of added) {
    const name = (getAttr(f, 'NOME-INSTITUICAO') ?? '').trim();
    const letter = FUNDER_NATURE[getAttr(f, 'NATUREZA') ?? ''];
    if (!name) return { reason: 'Financiador novo sem a instituição' };
    if (!letter) {
      return {
        reason:
          'Natureza do financiador: o Lattes pede Auxílio Financeiro, Bolsa, Remuneração, Cooperação ou Outra',
      };
    }
    add.push({ letter, name });
  }
  return {
    funders: { add, remove: [] },
    rows: add.map((a) => ({
      after: a.name,
      before: '',
      label: 'Financiador novo',
      name: 'f_inst_l',
    })),
  };
}

const sameCode = (cell: string | undefined, code: string) =>
  cell === code || cell?.slice(1) === code;

/** A grade de financiadores com as linhas novas e sem as que saem, ou o resultado sem envio. */
export async function funderListValue(
  port: LattesPort,
  path: string,
  html: string,
  grids: readonly OpaqueGrid[],
  list: FunderList,
): Promise<{ field: string; value: string } | Failure> {
  const grid = grids.find((g) => g.element === FUNDERS);
  const rows = grid?.serialize ? opaqueCells(html, grid) : undefined;
  if (!rows || !grid?.serialize) {
    return { detail: 'A página do Lattes não trouxe a grade de financiadores', status: 'erro' };
  }
  let next = rows.filter((r) => !list.remove.some((code) => sameCode(r[0], code)));
  for (const a of list.add) {
    const found = await searchFunder(port, path, a.name);
    if ('status' in found) return found;
    if (next.some((r) => r[0] === found.code)) continue;
    next = [...next, [found.code, ';N;', '|', a.letter]];
  }
  if (next.length === rows.length && next.every((r, i) => r === rows[i])) {
    return { detail: 'O Lattes já estava assim; nada foi enviado', status: 'conferido' };
  }
  return { field: grid.field, value: serializeCells(next, grid.serialize) };
}
