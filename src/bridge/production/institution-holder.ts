// O titular instituição de patentes e registros (REGISTRO-OU-PATENTE@
// NOME-DO-TITULAR, na grade titularInstProvider → f_depositante_inst_l).
//
// Lido em 27/10/2026 no Lattes real, sem enviar: a janela
// pkg_titular_inst.sele_inst busca por nome (POST com f_cod, f_ctr P e
// f_nome) e responde com um seleciona('<letra><código>', '<nome>') por
// instituição. O seleciona() da janela põe na grade a linha
// {l: nome, c: código sem a letra, tipoInst: a letra, deletable, editable},
// e o check() da página serializa c, l, t, tipoInst e staValidado na ordem do
// objeto (l|c|tipoInst numa linha escolhida assim). O conector refaz a busca
// com o nome do XML, fica com a única instituição de mesmo nome e escreve a
// linha como o seleciona() escreveria.
//
// Inferido: que a exportação guarde o nome da instituição titular em
// NOME-DO-TITULAR (a patente de teste exportada só tinha pessoa
// depositante), e que a linha gravada volte na edição com o mesmo l.

import { foldText } from '../../model/fold-text.ts';
import type { LattesPort, ResultStatus } from '../apply.ts';
import { jsCalls, SESSION } from '../create-shared.ts';
import { encodeLatin1Form, type Pairs, pairValue } from '../form.ts';
import { isLogonPage } from '../lattes-html.ts';
import { authorNames, type GridRow, type Grids, sameWords } from './grids.ts';

/**
 * Liga a troca do titular instituição pelo conector. O app só manda essas
 * operações a uma extensão que anuncia 'titular-instituicao'.
 */
export const INSTITUTION_HOLDERS_ENABLED = true;

export const INSTITUTION_HOLDER_ATTR = 'NOME-DO-TITULAR';

export const SEVERAL_INSTITUTIONS =
  'Mais de uma instituição titular vai à mão: como a exportação junta mais de uma não foi visto; troque no Lattes';

/** A troca do titular instituição: um nome só (ou nenhum) antes e depois, ou o motivo. */
export function planInstitutionHolder(f: {
  after: string;
  before: string;
}): { after: string; before: string } | { reason: string } {
  const value = { after: f.after.trim(), before: f.before.trim() };
  if (value.after.includes(';') || value.before.includes(';')) {
    return { reason: SEVERAL_INSTITUTIONS };
  }
  return value;
}

/** A grade de titulares instituições tem essa instituição só (ou nenhuma, com o nome vazio)? */
export const sameInstitution = (rows: readonly GridRow[], name: string): boolean =>
  sameWords(authorNames(rows), name.trim() ? [name] : []);

/**
 * A grade nova: vazia, ou a linha da única instituição de mesmo nome na busca
 * da janela de titulares; o motivo, quando a busca não a acha uma vez só.
 */
export async function institutionHolderRows(
  port: LattesPort,
  cv: string,
  name: string,
): Promise<{ rows: GridRow[] } | { detail: string; status: ResultStatus }> {
  if (!name) return { rows: [] };
  const html = await port.post(
    'pkg_titular_inst.sele_inst',
    encodeLatin1Form([
      ['f_cod', cv],
      ['f_ctr', 'P'],
      ['f_nome', name],
    ]),
  );
  if (isLogonPage(html)) return { detail: SESSION, status: 'sessao' };
  const hits = jsCalls(html, 'seleciona').filter(
    ([code, label]) => !!code && foldText((label ?? '').trim()) === foldText(name),
  );
  if (hits.length !== 1) {
    return {
      detail: `Titular instituição: ${hits.length} instituições com esse nome na busca do Lattes; escolha no Lattes. Nada foi enviado`,
      status: 'erro',
    };
  }
  const [code = '', label = ''] = hits[0]!;
  // Na ordem do seleciona(): o check() serializa as chaves na ordem do objeto.
  const row: GridRow = Object.fromEntries([
    ['l', label],
    ['c', code.slice(1)],
    ['tipoInst', code.slice(0, 1)],
    ['deletable', true],
    ['editable', false],
  ]);
  return { rows: [row] };
}

/** O titular instituição da grade que não está como `side` da operação diz; vazio quando está. */
export const institutionMisses = (
  op: { institutionHolder?: { after: string; before: string } },
  grids: Grids,
  side: 'after' | 'before',
): string[] =>
  op.institutionHolder &&
  !sameInstitution(grids.f_depositante_inst_l ?? [], op.institutionHolder[side])
    ? ['f_depositante_inst_l']
    : [];

/** A grade nova do titular instituição, para juntar às trocas do envio; nada sem a troca. */
export async function institutionReplace(
  port: LattesPort,
  pairs: Pairs,
  op: { institutionHolder?: { after: string; before: string } },
): Promise<{ replace: Grids } | { detail: string; status: ResultStatus }> {
  if (!op.institutionHolder) return { replace: {} };
  const cv = pairValue(pairs, 'f_cod') ?? '';
  const built = await institutionHolderRows(port, cv, op.institutionHolder.after);
  return 'status' in built ? built : { replace: { f_depositante_inst_l: built.rows } };
}
