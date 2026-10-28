// Um financiador que já está no projeto: a instituição e a natureza, pela
// linha dele na grade grid2 (opaque.ts).
//
// Lido em 27/10/2026 no Lattes real, sem enviar, no projeto de teste com um
// financiador: a linha manda "código com a letra|código do projeto;N;|moeda|
// valor|letra da natureza|". A janela PKG_PROJETO.EDITAR_FINANCIAMENTO, que
// edita a linha, tem a natureza num select com A Auxílio Financeiro, B Bolsa,
// R Remuneração, C Cooperação e O Outra. A busca de instituições do
// financiador é um POST a PKG_PROJETO.PP_LISTA_INST (F_CTR C, F_COD,
// F_PGM INSTFINANC, F_COD_INST vazio, F_SEQ_FUNCAO, F_SEQ_ATIV, F_SEQ_PROJ e
// f_nome), que responde com um seleciona('<letra><código>', '<nome>',
// '<sigla>') por instituição; o seleciona() leva o código à janela de
// edição. A exportação traz o nome (o segundo argumento) em NOME-INSTITUICAO
// e o código sem a letra em CODIGO-INSTITUICAO.
//
// O conector troca só a primeira célula (a instituição achada pelo nome, uma
// vez só) e a quarta (a letra). Inferido, até o teste acompanhado: que o
// Lattes grave a linha assim, sem passar pela janela de edição. A releitura
// confere a grade inteira.

import { enumLabel } from '../../labels/labels.ts';
import type { Change } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { getAttr, type XElement } from '../../model/xml.ts';
import type { LattesPort, ResultStatus } from '../apply.ts';
import { jsCalls, SESSION } from '../create-shared.ts';
import { encodeLatin1Form } from '../form.ts';
import { isLogonPage } from '../lattes-html.ts';
import { opaqueCells, serializeCells } from './opaque.ts';
import type { ProductionRow } from './plan.ts';
import type { OpaqueGrid, ProductionTarget } from './types.ts';

/** O financiador pelo conector (op.funder): só a uma extensão com 'financiador-projeto'. */
export const EDIT_FUNDERS_ENABLED = true;

export const FUNDER = 'FINANCIADOR-DO-PROJETO';
export const FUNDERS = 'FINANCIADORES-DO-PROJETO';

/** NATUREZA do XML → a letra do select da janela de edição (27/10/2026). */
export const FUNDER_NATURE: Record<string, string> = {
  AUXILIO_FINANCEIRO: 'A',
  BOLSA: 'B',
  COOPERACAO: 'C',
  OUTRO: 'O',
  REMUNERACAO: 'R',
};

const INSTITUTION_CELL = 0;
const NATURE_CELL = 3;

/**
 * A troca num financiador: a linha pelo código da instituição de antes, o
 * nome da instituição e a letra da natureza antes e depois.
 */
export interface FunderEdit {
  code: string;
  institution?: { after: string; before: string };
  nature?: { after: string; before: string };
}

type Failure = { detail: string; status: ResultStatus };

/**
 * A troca e as linhas do que muda, ou o motivo de ir à mão; undefined quando a
 * mudança não é num financiador que já está no projeto.
 */
export function planFunder(
  change: Change,
  chain: readonly XElement[],
  target: ProductionTarget,
): { funder: FunderEdit; rows: ProductionRow[] } | { reason: string } | undefined {
  const el = chain.at(-1);
  if (
    !el ||
    change.element !== FUNDER ||
    change.kind !== 'alterado' ||
    chain.at(-2)?.name !== FUNDERS ||
    !target.opaqueGrids?.some((g) => g.element === FUNDERS)
  ) {
    return undefined;
  }
  const funder: FunderEdit = { code: (getAttr(el, 'CODIGO-INSTITUICAO') ?? '').trim() };
  for (const f of change.fields) {
    if (f.attr === 'NATUREZA') {
      const [before, after] = [FUNDER_NATURE[f.before], FUNDER_NATURE[f.after]];
      if (!after) {
        return {
          reason:
            'Natureza do financiador: o Lattes pede Auxílio Financeiro, Bolsa, Remuneração, Cooperação ou Outra',
        };
      }
      if (!before) return { reason: 'Natureza do financiador: a de antes não é uma do Lattes' };
      funder.nature = { after, before };
    } else if (f.attr === 'NOME-INSTITUICAO') {
      if (!f.after.trim()) {
        return {
          reason: 'Financiador: o Lattes pede a instituição; tirar o financiador vai no Lattes',
        };
      }
      funder.institution = { after: f.after.trim(), before: f.before.trim() };
    } else {
      return {
        reason:
          'Financiador: o código da instituição sai da busca do Lattes; troque o nome da instituição',
      };
    }
  }
  if (!funder.code) {
    return { reason: 'Financiador sem o código da instituição para achar a linha no Lattes' };
  }
  const rows = change.fields.map((f) => ({
    after: f.attr === 'NATUREZA' ? enumLabel(f.after) : f.after,
    before: f.attr === 'NATUREZA' ? enumLabel(f.before) : f.before,
    label: f.label,
    name: 'f_inst_l',
  }));
  return { funder, rows };
}

/** Um parâmetro do link do projeto, sem olhar a caixa do nome. */
function pathParam(path: string, name: string): string {
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  for (const [k, v] of query) if (k.toLowerCase() === name.toLowerCase()) return v.trim();
  return '';
}

/**
 * O código (com a letra) da única instituição de mesmo nome na busca do
 * financiador; o motivo, quando a busca não a acha uma vez só.
 */
export async function searchFunder(
  port: LattesPort,
  path: string,
  name: string,
): Promise<{ code: string } | Failure> {
  const param = (n: string) => pathParam(path, n);
  const html = await port.post(
    'PKG_PROJETO.PP_LISTA_INST',
    encodeLatin1Form([
      ['F_CTR', 'C'],
      ['F_COD', param('f_cod')],
      ['F_PGM', 'INSTFINANC'],
      ['F_COD_INST', ''],
      ['F_SEQ_FUNCAO', param('F_SEQ_FUNCAO')],
      ['F_SEQ_ATIV', param('F_SEQ_ATIV')],
      ['F_SEQ_PROJ', param('F_SEQ_PROJ')],
      ['f_nome', name],
    ]),
  );
  if (isLogonPage(html)) return { detail: SESSION, status: 'sessao' };
  const hits = jsCalls(html, 'seleciona').filter(
    ([code, label]) => !!code && foldText((label ?? '').trim()) === foldText(name),
  );
  if (hits.length !== 1) {
    return {
      detail: `Financiador: ${hits.length} instituições com o nome ${name} na busca do Lattes. Escolha no Lattes. Nada foi enviado`,
      status: 'erro',
    };
  }
  return { code: hits[0]![0]! };
}

const DIVERGENT: Failure = {
  detail: 'O Lattes não está como o editor espera: Financiador',
  status: 'divergente',
};

const sameCode = (cell: string | undefined, code: string) =>
  cell === code || cell?.slice(1) === code;

/**
 * O oculto da grade com a linha do financiador trocada, ou o resultado sem
 * envio: conferido quando o Lattes já está assim, divergente quando a linha
 * não está uma vez só ou não tem o de antes.
 */
export async function funderValue(
  port: LattesPort,
  path: string,
  html: string,
  grids: readonly OpaqueGrid[],
  edit: FunderEdit,
): Promise<{ field: string; value: string } | Failure> {
  const grid = grids.find((g) => g.element === FUNDERS);
  const rows = grid?.serialize ? opaqueCells(html, grid) : undefined;
  if (!rows || !grid?.serialize) return DIVERGENT;
  let code: string | undefined;
  if (edit.institution) {
    const found = await searchFunder(port, path, edit.institution.after);
    if ('status' in found) return found;
    code = found.code;
  }
  // A linha pelo código de antes; numa segunda vez, já com o novo.
  const byOld = rows.filter((r) => sameCode(r[INSTITUTION_CELL], edit.code));
  const byNew = code ? rows.filter((r) => r[INSTITUTION_CELL] === code) : [];
  const hits = byOld.length > 0 ? byOld : byNew;
  if (hits.length !== 1) return DIVERGENT;
  const row = hits[0]!;
  const nature = row[NATURE_CELL];
  if (edit.nature && nature !== edit.nature.before && nature !== edit.nature.after) {
    return DIVERGENT;
  }
  const want = row.map((v, i) =>
    i === INSTITUTION_CELL && code
      ? code
      : i === NATURE_CELL && edit.nature
        ? edit.nature.after
        : v,
  );
  if (want.every((v, i) => v === row[i])) {
    return { detail: 'O Lattes já estava assim; nada foi enviado', status: 'conferido' };
  }
  const edited = rows.map((r) => (r === row ? want : r));
  return { field: grid.field, value: serializeCells(edited, grid.serialize) };
}
