// O depositante ou titular de patentes e registros, pessoa ou instituição.
//
// Observado na exportação de 27/10/2026 (uma patente de teste com uma
// instituição titular e nenhuma pessoa): a exportação põe a instituição em
// NOME-DO-DEPOSITANTE, o mesmo atributo da pessoa depositante (20/10/2026), e
// deixa NOME-DO-TITULAR vazio. O XML não diz se o nome é de pessoa ou de
// instituição; a página diz, pela grade em que a linha está
// (titularPessoaProvider ou titularInstProvider).
//
// Lido em 27/10/2026 no Lattes real, sem enviar: a janela
// pkg_titular_inst.sele_inst busca por nome (POST com f_cod, f_ctr P e
// f_nome) e responde com um seleciona('<letra><código>', '<nome>') por
// instituição; o seleciona() põe na grade a linha {l: nome, c: código sem a
// letra, tipoInst: a letra, deletable, editable}, e o check() a serializa
// como nome|código|letra. A gravação da patente de teste devolveu essa linha.
//
// O conector acha o nome de antes numa das duas grades. O nome novo é a
// pessoa do titularPessoaDP do menu (holders.ts) ou, com a capacidade
// titular-instituicao, a única instituição de mesmo nome na busca da janela.

import { foldText } from '../../model/fold-text.ts';
import type { LattesPort, ResultStatus } from '../apply.ts';
import { jsCalls, SESSION } from '../create-shared.ts';
import { encodeLatin1Form, type Pairs, pairValue } from '../form.ts';
import { isLogonPage } from '../lattes-html.ts';
import { authorNames, type GridRow, type Grids, sameWords } from './grids.ts';
import { holderReplace } from './holders.ts';

/**
 * Liga a troca do depositante instituição pelo conector. O app marca a troca
 * (holders.institutions) só para uma extensão que anuncia 'titular-instituicao'.
 */
export const INSTITUTION_HOLDERS_ENABLED = true;

/** Os depositantes da página, pessoas e instituições, pelo nome. */
const depositorNames = (grids: Grids) => [
  ...authorNames(grids.f_depositante_pessoa_l ?? []),
  ...authorNames(grids.f_depositante_inst_l ?? []),
];

/** As grades da página têm esse depositante só (ou nenhum, com o nome vazio)? */
export const sameDepositor = (grids: Grids, name: string): boolean =>
  sameWords(depositorNames(grids), name.trim() ? [name] : []);

/** Mais de um depositante na página, somadas as duas grades. */
export const severalDepositors = (grids: Grids): boolean => depositorNames(grids).length > 1;

type Failure = { detail: string; status: ResultStatus };

/**
 * A linha da única instituição de mesmo nome na busca da janela de
 * titulares; o motivo, quando a busca não a acha uma vez só.
 */
export async function institutionHolderRows(
  port: LattesPort,
  cv: string,
  name: string,
): Promise<{ rows: GridRow[] } | Failure> {
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
      detail: `Depositante: ${name} não está na lista de coautores do Lattes, e ${hits.length} instituições têm esse nome na busca dele. Escolha no Lattes. Nada foi enviado`,
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

/**
 * As duas grades com o depositante novo: nenhum, a instituição que já está
 * na grade, a pessoa (holders.ts) ou a instituição da busca. A outra grade
 * fica vazia.
 */
export async function depositorReplace(
  port: LattesPort,
  pairs: Pairs,
  menu: string,
  grids: Grids,
  holders: { after: string; institutions?: boolean },
): Promise<{ replace: Grids } | Failure> {
  const { after } = holders;
  const empty = { f_depositante_inst_l: [], f_depositante_pessoa_l: [] };
  if (!after) return { replace: empty };
  const keptInst = (grids.f_depositante_inst_l ?? []).find((r) =>
    sameWords(authorNames([r]), [after]),
  );
  if (keptInst) return { replace: { ...empty, f_depositante_inst_l: [keptInst] } };
  const person = holderReplace(grids.f_depositante_pessoa_l ?? [], menu, after);
  if ('rows' in person) return { replace: { ...empty, f_depositante_pessoa_l: person.rows } };
  if (!holders.institutions || !INSTITUTION_HOLDERS_ENABLED) {
    return { detail: person.reason, status: 'erro' };
  }
  const institution = await institutionHolderRows(port, pairValue(pairs, 'f_cod') ?? '', after);
  if ('status' in institution) return institution;
  return { replace: { ...empty, f_depositante_inst_l: institution.rows } };
}
