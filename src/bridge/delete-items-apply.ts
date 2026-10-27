// A exclusão de delete-items.ts no Lattes: acha o formulário do item pelo
// caminho da alteração, confere que é ele, faz o que o del() da página faz e
// lê a lista de novo. Só dá por conferido quando a linha do item sumiu e
// nenhuma outra mudou.

import type { LattesPort, OpResult } from './apply.ts';
import { formacaoLinks } from './biographic.ts';
import { getChecked, readPairs, sameCode, Stop } from './create-shared.ts';
import type { DeleteAtuacaoOp, DeleteItemOp, DeleteLocator } from './delete-items.ts';
import { locateAtividade } from './edit-atividade.ts';
import { EVENTO_SPEC, eventoForms } from './edit-items.ts';
import { editLinks, listEditSpec } from './edit-lists.ts';
import { encodeLatin1Form, type Pairs, pairValue, setPairs } from './form.ts';
import { findLinks } from './lattes-html.ts';
import { locate, productionRows } from './production/locate.ts';
import { folded, productionTarget } from './production/plan.ts';

/** O del() troca f_ctr para E; sem isso na página, o Lattes mudou e nada vai. */
const DEL_TO_E = /f_ctr\.value\s*=\s*["']E["']/;
/** O del() das formações chama SETA_ULTIMO_PUBLICO antes quando contPriv é "0". */
const NO_OTHER_PUBLIC = /contPriv\s*=\s*["']0["']/;
const SETOU =
  'O Lattes tornou pública a última formação concluída, porque nenhuma outra era pública (como a página faz)';

interface Form {
  action: string;
  mode: string;
  name: string;
}

type Get = (path: string) => Promise<string>;

/** As linhas da lista do item (os caminhos dos formulários) e o formulário dele. */
async function rowsAndForm(
  locator: DeleteLocator,
  port: LattesPort,
  menu: string,
): Promise<{ form: Form; rows: string[] }> {
  const get: Get = (p) => getChecked(port, p);
  if (locator.by === 'producao') {
    const t = productionTarget(locator.target);
    if (!t) throw new Stop('erro', 'Esta extensão não conhece este tipo de item');
    const { links } = await productionRows(locator, t, port, menu);
    return { form: { ...t.form, mode: 'U' }, rows: links.map((l) => l.path) };
  }
  if (locator.by === 'evento') {
    const forms = await eventoForms(menu, get);
    if (!forms) throw new Stop('erro', 'Participação em eventos não encontrada no menu do Lattes');
    return { form: { ...EVENTO_SPEC, mode: 'U' }, rows: forms.map((f) => f.path) };
  }
  if (locator.by === 'formacao') {
    const links = await formacaoLinks(menu, get, locator.list);
    if (!links) throw new Stop('erro', 'Formação acadêmica não encontrada no menu do Lattes');
    return {
      form: { action: 'pkg_formacao.FORM', mode: 'U', name: 'GN_FORMACAO2' },
      rows: links.map((l) => l.path),
    };
  }
  if (locator.by === 'lista') {
    const links = await editLinks(locator.kind, menu, get);
    if (!links) throw new Stop('erro', 'A lista do item não está no menu do Lattes');
    const spec = listEditSpec(locator.kind);
    return { form: { action: spec.action, mode: spec.mode ?? 'U', name: spec.name }, rows: links };
  }
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
  const grid = findLinks(await get(lista.path), 'pkg_ativ.cargos_vinculos').find(
    (l) =>
      l.params.f_seq_ativ === locator.seqAtiv &&
      (!locator.codInst || sameCode(l.params.f_codinst, locator.codInst)),
  );
  if (!grid) throw new Stop('erro', `Atuação ${locator.seqAtiv} não encontrada no Lattes`);
  const rows = findLinks(await get(grid.path), 'pkg_ativ.cargo')
    .filter((l) => l.params.f_seq_funcao && !l.params.f_ctr)
    .map((l) => l.path);
  return { form: { action: 'PKG_ATIV.cargo', mode: 'U', name: 'GN_ATIV_CARGO' }, rows };
}

/** O caminho do formulário do item, pelo localizador. */
async function itemPath(
  op: DeleteItemOp,
  port: LattesPort,
  menu: string,
  rows: string[],
  form: Form,
): Promise<string> {
  const { locator } = op;
  if (locator.by === 'producao') {
    const t = productionTarget(locator.target)!;
    return (await locate(locator, t, port, menu)).path;
  }
  if (locator.by === 'atividade') return locateAtividade(locator, port);
  const hits: string[] = [];
  for (const path of rows) {
    if (locator.by === 'evento' || locator.by === 'formacao') {
      const seq = /[?&]f_seq=([^&]*)/i.exec(path)?.[1];
      if (seq === locator.seq) hits.push(path);
      continue;
    }
    const { pairs } = await readPairs(port, path, form.name);
    const same = Object.entries(locator.match).every(
      ([k, v]) => folded(pairValue(pairs, k) ?? '') === folded(v ?? ''),
    );
    if (same) hits.push(path);
  }
  if (hits.length !== 1) {
    throw new Stop('erro', `O item não foi achado uma vez só no Lattes (${hits.length} achados)`);
  }
  return hits[0]!;
}

/** O ajax do del() das formações; undefined sem nada a dizer, ou o resultado de parar. */
async function setaUltimoPublico(
  op: DeleteItemOp,
  port: LattesPort,
  html: string,
  pairs: Pairs,
): Promise<{ note?: string } | { stop: string }> {
  if (!op.seta || !NO_OTHER_PUBLIC.test(html)) return {};
  const body: [string, string][] = [
    ['f_cod', pairValue(pairs, 'f_cod') ?? ''],
    ['f_seq', pairValue(pairs, 'f_seq') ?? ''],
    ...(op.locator.by === 'formacao'
      ? ([['f_tipo', pairValue(pairs, 'f_tipo') ?? '']] as [string, string][])
      : []),
    ['f_op', 'E'],
  ];
  const answer = (await port.post(op.seta, encodeLatin1Form(body))).trim();
  if (answer === 'SETOU') return { note: SETOU };
  if (answer === 'ULTIMO') return {};
  return { stop: 'O Lattes respondeu "Ocorreu um erro!" antes de excluir; nada foi excluído' };
}

export async function applyDeleteItem(op: DeleteItemOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  let posted = false;
  try {
    const menu = await port.menuHtml();
    const { form, rows: before } = await rowsAndForm(op.locator, port, menu);
    const path = await itemPath(op, port, menu, before, form);
    const html = await getChecked(port, path);
    const { pairs } = await readPairs(port, path, form.name);
    if (!DEL_TO_E.test(html)) {
      return result(
        'erro',
        'O formulário do Lattes não exclui como o conector espera; nada foi enviado',
      );
    }
    if (pairValue(pairs, 'f_ctr') !== form.mode) {
      return result('erro', 'O formulário não está em modo de alteração');
    }
    const wrong = Object.entries(op.identity)
      .filter(([k, v]) => folded(pairValue(pairs, k) ?? '') !== folded(v ?? ''))
      .map(([k]) => k);
    if (wrong.length > 0) {
      return result('divergente', `O Lattes não está como o editor espera: ${wrong.join(', ')}`);
    }
    const seta = await setaUltimoPublico(op, port, html, pairs);
    if ('stop' in seta) return result('erro', seta.stop);
    posted = true;
    await port.post(form.action, encodeLatin1Form(setPairs(pairs, { f_ctr: 'E' })));
    const after = (await rowsAndForm(op.locator, port, await port.menuHtml())).rows;
    const problem = listProblem(before, after, path);
    if (problem)
      return result(
        'divergente',
        `O Lattes recebeu a exclusão, mas ${problem}. Confira no Lattes antes de mandar de novo`,
      );
    const done = result('conferido', 'Excluído e conferido no Lattes');
    return seta.note ? { ...done, detail: `${done.detail}. ${seta.note}`, partial: true } : done;
  } catch (err) {
    if (err instanceof Stop && !posted) return result(err.status, err.message);
    const why = err instanceof Error ? err.message : 'falha inesperada';
    return posted
      ? result(
          'divergente',
          `A exclusão pode ter chegado ao Lattes (${why}); confira antes de mandar de novo`,
        )
      : result('erro', why);
  }
}

/** O que a lista mostra de diferente além do item que saiu; undefined quando só ele saiu. */
function listProblem(before: string[], after: string[], target: string): string | undefined {
  if (after.includes(target)) return 'o item continua na lista do Lattes';
  const gone = before.filter((p) => p !== target && !after.includes(p));
  const added = after.filter((p) => !before.includes(p));
  if (gone.length > 0 || added.length > 0) return 'a lista mudou além do item';
  return undefined;
}

/** A atuação inteira, pelo GET com f_ctr=E2 do dele() da tela de cargos e vínculos. */
export async function applyDeleteAtuacao(op: DeleteAtuacaoOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  const atuacoes = async () => {
    const lista = findLinks(await port.menuHtml(), 'pkg_ativ.lista')[0];
    if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
    const links = findLinks(await getChecked(port, lista.path), 'pkg_ativ.cargos_vinculos').filter(
      (l) => l.params.f_seq_ativ,
    );
    return { cv: lista.params.f_cod ?? '', links };
  };
  let sent = false;
  try {
    const { cv, links } = await atuacoes();
    const mine = links.filter(
      (l) =>
        l.params.f_seq_ativ === op.seqAtiv &&
        (!op.codInst || sameCode(l.params.f_codinst, op.codInst)),
    );
    if (mine.length !== 1) {
      return result(
        'erro',
        `Atuação ${op.seqAtiv} não encontrada no Lattes (${mine.length} achadas)`,
      );
    }
    const page = await getChecked(port, mine[0]!.path);
    if (!/f_ctr=E2/.test(page)) {
      return result(
        'erro',
        'A tela da atuação não exclui como o conector espera; nada foi enviado',
      );
    }
    sent = true;
    await getChecked(port, `pkg_ativ.form?f_cod=${cv}&f_seq_ativ=${op.seqAtiv}&f_ctr=E2`);
    const after = (await atuacoes()).links.map((l) => l.path);
    const problem = listProblem(
      links.map((l) => l.path),
      after,
      mine[0]!.path,
    );
    if (problem) {
      return result('divergente', `O Lattes recebeu a exclusão, mas ${problem}. Confira no Lattes`);
    }
    return result('conferido', `Excluída e conferida no Lattes. ${ATUACAO_CASCADE_DONE}`);
  } catch (err) {
    if (err instanceof Stop && !sent) return result(err.status, err.message);
    const why = err instanceof Error ? err.message : 'falha inesperada';
    return sent
      ? result(
          'divergente',
          `A exclusão pode ter chegado ao Lattes (${why}); confira antes de mandar de novo`,
        )
      : result('erro', why);
  }
}

const ATUACAO_CASCADE_DONE =
  'Com ela saíram as atividades, os vínculos, os projetos e as linhas de pesquisa dela';
