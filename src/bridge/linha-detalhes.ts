// O que uma linha de pesquisa nova leva além do título: os objetivos, se está
// ativa, o título e os objetivos em inglês e as grades de palavras-chave,
// áreas e setores. A grade da atividade de pesquisa e desenvolvimento só tem
// o título (f_espec_l); o resto fica no formulário da própria linha
// (GN_LINHA, POST PKG_LINHAPESQ.FORM, lido em 19/10/2026), aberto pela lista
// pkg_linhapesq.lista, que traz cada linha com F_SEQ_ATIV, F_SEQ_FUNCAO e
// F_SEQ_LINHA (production/targets/demais.ts).
//
// Depois que a grade grava a linha nova, o conector abre o formulário dela,
// achada pela atividade e pelo título, troca esses campos e relê. Inferido
// até o teste acompanhado: que a linha criada pela grade apareça na lista com
// o título enviado, e que o formulário dela grave os campos como na alteração
// de uma linha que já existe.

import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort } from './apply.ts';
import { newGridPairs, newGridProblems, type NewItemGrids, newItemGrids } from './create-grids.ts';
import { getChecked, readBack, readPairs, Stop } from './create-shared.ts';
import { encodeLatin1Form, setPairs } from './form.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

export const LINHA = 'LINHA-DE-PESQUISA';
export const LINHA_TITLE = 'TITULO-DA-LINHA-DE-PESQUISA';

/** Os atributos da linha que vão no formulário dela, e o campo de cada um. */
const FIELDS: Record<string, [string, (v: string) => string | undefined]> = {
  'FLAG-LINHA-DE-PESQUISA-ATIVA': ['f_status', (v) => ({ NAO: 'N', SIM: 'S' })[v]],
  'OBJETIVOS-LINHA-DE-PESQUISA': ['f_ref', (v) => v],
  'OBJETIVOS-LINHA-DE-PESQUISA-INGLES': ['f_ref_en', (v) => v],
  'TITULO-DA-LINHA-DE-PESQUISA-INGLES': ['f_titulo_en', (v) => v],
};

/** O que vai no formulário de uma linha nova, depois da grade. */
export interface LinhaDetails {
  grids?: NewItemGrids;
  set: FieldValues;
  title: string;
}

/**
 * Os campos de uma linha nova além do título; undefined quando ela só tem o
 * título. O formulário exige o campo Ativa (seção 22): sem ele, o motivo.
 */
export function planLinhaDetails(linha: XElement): LinhaDetails | { reason: string } | undefined {
  const title = (getAttr(linha, LINHA_TITLE) ?? '').trim();
  const set: FieldValues = {};
  for (const [attr, [field, map]] of Object.entries(FIELDS)) {
    const value = getAttr(linha, attr)?.trim();
    if (!value) continue;
    const mapped = map(value);
    if (mapped === undefined) {
      return { reason: `Valor sem correspondência no formulário da linha de pesquisa: ${value}` };
    }
    set[field] = mapped;
  }
  const grids = newItemGrids(linha);
  if (grids && 'reason' in grids) return grids;
  if (Object.keys(set).length === 0 && !grids) return undefined;
  if (!set.f_status) {
    return { reason: 'O Lattes exige dizer se a linha de pesquisa está ativa' };
  }
  return { ...(grids ? { grids } : {}), set, title };
}

const FORM = 'GN_LINHA';
const ACTION = 'PKG_LINHAPESQ.FORM';

const param = (params: Record<string, string>, name: string) =>
  params[name] ?? params[name.toLowerCase()] ?? '';

/**
 * Preenche o formulário de cada linha nova da atividade. Devolve o que não
 * voltou como foi; lança Stop quando a sessão caiu ou a linha não foi achada.
 */
export async function fillLinhas(
  port: LattesPort,
  activity: { seqAtiv: string; seqFuncao: string },
  lines: readonly LinhaDetails[],
): Promise<string[]> {
  if (lines.length === 0) return [];
  const menu = await port.menuHtml();
  const lista = findLinks(menu, 'pkg_linhapesq.lista')[0];
  if (!lista) throw new Stop('divergente', 'Linhas de pesquisa não encontradas no menu do Lattes');
  const rows = findLinks(await getChecked(port, lista.path), 'pkg_linhapesq.form').filter(
    (l) =>
      param(l.params, 'F_SEQ_LINHA') &&
      param(l.params, 'F_SEQ_ATIV') === activity.seqAtiv &&
      param(l.params, 'F_SEQ_FUNCAO') === activity.seqFuncao,
  );
  const read = await Promise.all(
    rows.map(async (row) => ({ path: row.path, ...(await readPairs(port, row.path, FORM)) })),
  );
  const problems: string[] = [];
  for (const line of lines) {
    const hits = read.filter(
      (r) =>
        foldText((r.pairs.find(([k]) => k === 'f_titulo')?.[1] ?? '').trim()) ===
        foldText(line.title),
    );
    if (hits.length !== 1) {
      throw new Stop(
        'divergente',
        `A linha de pesquisa "${line.title}" não apareceu uma vez só na lista do Lattes (${hits.length}); os objetivos e o resto não foram enviados`,
      );
    }
    const hit = hits[0]!;
    const grids = line.grids ? newGridPairs(line.grids, menu) : { set: {} };
    if ('detail' in grids) throw new Stop('erro', grids.detail);
    const response = await port.post(
      ACTION,
      encodeLatin1Form(setPairs(hit.pairs, { ...line.set, ...grids.set })),
    );
    if (isLogonPage(response)) throw new Stop('sessao', 'A sessão do Lattes caiu; entre de novo');
    const html = await getChecked(port, hit.path);
    const saved = await readPairs(port, hit.path, FORM);
    const check = readBack(saved, line.set);
    const wrong = [...check.differ, ...check.unread];
    if (line.grids) wrong.push(...newGridProblems(html, line.grids));
    problems.push(...wrong.map((w) => `${line.title}: ${w}`));
  }
  return problems;
}
