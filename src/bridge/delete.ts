// Excluir no Lattes pelo conector (LAT-49). As listas do Lattes não têm
// controle de exclusão nas linhas: cada item se exclui pelo próprio
// formulário de edição, cujo botão "Excluir" chama del(), troca f_ctr de U
// para E e posta o mesmo formulário (docs/lattes_internals.md, seção 15).
//
// DESLIGADO: nenhuma exclusão foi enviada a um Lattes de verdade. O formato
// do POST foi lido no código das telas, mas o que o servidor responde e se a
// exclusão deixa alteração pendente de envio ao CNPq não foram observados.
// Por isso a conferência nunca lê a resposta: lê a lista de novo e confere
// que só o item excluído sumiu. A chave só liga depois de um teste
// acompanhado, num item de teste do currículo do dono.
//
// Hoje só o idioma e o vínculo de uma atuação, os dois formulários que o
// conector já altera e confere. Fora, de propósito:
// - a atuação inteira: a exclusão dela (GET com f_ctr=E2) apaga junto
//   atividades, vínculos, projetos e linhas de pesquisa;
// - as duas formações: o del() delas pode antes tornar pública outra
//   formação (SETA_ULTIMO_PUBLICO), o que ainda não foi observado;
// - o resto: os formulários não foram mapeados no conector.

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import {
  encodeLatin1Form,
  type FormControl,
  type Pairs,
  pairValue,
  setPairs,
  successfulPairs,
  withCheckRules,
} from './form.ts';
import { IDIOMA_SKILLS, LEVEL } from './idioma-skills.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import type { FieldValues, Unsupported } from './plan.ts';

/**
 * Fica false até um teste acompanhado num Lattes real. Desligada, uma
 * remoção no editor segue pelo caminho de excluir à mão; os testes ligam com
 * `enabled: true` (ou `deleteItems: true` no planejamento).
 */
export const DELETE_ITEMS_ENABLED = false;

interface DeleteBase {
  /** Valores que o formulário precisa ter agora: a identidade do item a excluir. */
  expect: FieldValues;
  key: string;
  label: string;
  /** Sempre vazio: excluir não grava campo nenhum. */
  set: FieldValues;
}

export interface DeleteIdiomaOp extends DeleteBase {
  code: string;
  kind: 'excluir-idioma';
}

export interface DeleteVinculoOp extends DeleteBase {
  codInst?: string;
  kind: 'excluir-vinculo';
  seqAtiv: string;
  seqHist: string;
}

export type DeleteOp = DeleteIdiomaOp | DeleteVinculoOp;

/** O formulário de edição de onde cada exclusão sai (o mesmo da alteração). */
const EDIT_FORM = {
  'excluir-idioma': { action: 'PKG_IDIOMA.FORM', kind: 'idioma', name: 'GN_IDIOMA' },
  'excluir-vinculo': { action: 'PKG_ATIV.VINCULOS', kind: 'vinculo', name: 'GN_ATIV_VINC' },
} as const;

export function isDeleteOp(op: { kind: string }): op is DeleteOp {
  return Object.hasOwn(EDIT_FORM, op.kind);
}

/**
 * O tipo de operação cujo formulário o contrato confere. A exclusão sai do
 * formulário de edição, então vale a conferência dele.
 */
export function contractKind<K extends string>(kind: K): K | 'idioma' | 'vinculo' {
  return Object.hasOwn(EDIT_FORM, kind) ? EDIT_FORM[kind as DeleteOp['kind']].kind : kind;
}

export const DELETE_OFF_REASON =
  'Excluir pelo conector: desligado até um teste acompanhado no Lattes';

export const ATUACAO_REASON =
  'Excluir a atuação inteira apaga junto, no Lattes, atividades, vínculos, projetos e linhas de pesquisa; exclua à mão, vendo o aviso do Lattes';

export const FORMACAO_REASON =
  'Excluir uma formação pode tornar pública outra formação no Lattes, e isso ainda não foi observado; exclua à mão';

const FORMACAO = ['FORMACAO-ACADEMICA-TITULACAO', 'FORMACAO-COMPLEMENTAR'];

/**
 * Planeja a exclusão de um item que a pessoa removeu no editor. `chain` é o
 * caminho resolvido na cópia de trabalho: o item não está mais lá, então ele
 * termina no pai. Os valores do item vêm do "antes" da mudança.
 */
export function planDelete(
  change: Change,
  chain: XElement[],
  label: string,
  enabled: boolean = DELETE_ITEMS_ENABLED,
): DeleteOp | Unsupported {
  const no = (reason: string): Unsupported => ({ key: change.key, label, reason });
  if (!enabled) return no(DELETE_OFF_REASON);
  if (change.element === 'ATUACAO-PROFISSIONAL') return no(ATUACAO_REASON);
  const inFormacao = [change.element, ...change.path].some((p) =>
    FORMACAO.some((f) => p === f || p.startsWith(`${f}[`)),
  );
  if (inFormacao) return no(FORMACAO_REASON);

  const parent = chain.at(-1);
  if (!parent || chain.length !== change.path.length - 1) {
    return no('O item ainda existe na cópia de trabalho, ou o que o continha não existe mais');
  }
  const before = (attr: string) => change.fields.find((f) => f.attr === attr)?.before ?? '';
  const base = { key: change.key, label: `Excluir: ${label}`, set: {} };

  if (change.element === 'IDIOMA') {
    const code = before('IDIOMA');
    if (!code) return no('Idioma sem código');
    const expect: FieldValues = {};
    for (const [attr, skill] of Object.entries(IDIOMA_SKILLS)) {
      const level = LEVEL[before(attr)] ?? null;
      expect[`FC_${skill}`] = level ? 'on' : null;
      expect[`F_${skill}`] = level;
    }
    return { ...base, code, expect, kind: 'excluir-idioma' };
  }

  if (change.element === 'VINCULOS') {
    const seqAtiv = getAttr(parent, 'SEQUENCIA-ATIVIDADE');
    const seqHist = before('SEQUENCIA-HISTORICO');
    if (parent.name !== 'ATUACAO-PROFISSIONAL' || !seqAtiv || !seqHist) {
      return no('Vínculo sem número de sequência');
    }
    // Conferência de identidade: o período do vínculo tem de bater.
    const expect: FieldValues = {
      f_ano_fim: before('ANO-FIM'),
      f_ano_ini: before('ANO-INICIO'),
      f_mes_fim: before('MES-FIM'),
      f_mes_ini: before('MES-INICIO'),
    };
    return {
      ...base,
      codInst: getAttr(parent, 'CODIGO-INSTITUICAO') || undefined,
      expect,
      kind: 'excluir-vinculo',
      seqAtiv,
      seqHist,
    };
  }

  return no('Excluir este tipo de item pelo conector: não suportado ainda');
}

class Stop extends Error {
  status: OpResult['status'];
  constructor(status: OpResult['status'], detail: string) {
    super(detail);
    this.status = status;
  }
}

async function getChecked(port: LattesPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path)) throw new Stop('sessao', 'A sessão do Lattes caiu; entre de novo');
  return html;
}

/** O XML traz CODIGO-INSTITUICAO sem a letra que o Lattes põe na frente no f_codinst. */
function sameInstitution(fromLattes: string | undefined, fromXml: string | undefined): boolean {
  if (!fromXml) return true;
  if (!fromLattes) return false;
  return fromLattes === fromXml || fromLattes.replace(/^[A-Za-z]/, '') === fromXml;
}

function formControls(port: LattesPort, html: string, form: string): FormControl[] {
  const controls = port.readForm(html, form);
  if (!controls) {
    throw isLogonPage(html)
      ? new Stop('sessao', 'A sessão do Lattes caiu; entre de novo')
      : new Stop('erro', `Formulário ${form} não encontrado`);
  }
  return controls;
}

/**
 * O que as listas do Lattes mostram agora em volta do item: cada linha vira
 * um id ("idioma:2", "atuacao:5", "vinculo:1") e, quando abre um formulário,
 * o caminho dele. Antes e depois da exclusão, a diferença tem de ser só o
 * item excluído.
 */
async function snapshot(op: DeleteOp, port: LattesPort): Promise<Map<string, string>> {
  const menu = await port.menuHtml();
  const rows = new Map<string, string>();
  if (op.kind === 'excluir-idioma') {
    const lista = findLinks(menu, 'pkg_idioma.lista')[0];
    if (!lista) throw new Stop('erro', 'Idiomas não encontrados no menu do Lattes');
    for (const l of findLinks(await getChecked(port, lista.path), 'pkg_idioma.form')) {
      if (l.params.f_seq) rows.set(`idioma:${l.params.f_seq}`, l.path);
    }
    return rows;
  }
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
  const grids = findLinks(await getChecked(port, lista.path), 'pkg_ativ.cargos_vinculos').filter(
    (l) => l.params.f_seq_ativ,
  );
  for (const g of grids) rows.set(`atuacao:${g.params.f_seq_ativ}`, g.path);
  const mine = grids.filter(
    (l) => l.params.f_seq_ativ === op.seqAtiv && sameInstitution(l.params.f_codinst, op.codInst),
  );
  if (mine.length !== 1) {
    throw new Stop(
      'erro',
      `Atuação ${op.seqAtiv} não encontrada no Lattes (${mine.length} achadas)`,
    );
  }
  for (const v of findLinks(await getChecked(port, mine[0]!.path), 'pkg_ativ.vinculos')) {
    if (v.params.f_seq_hist) rows.set(`vinculo:${v.params.f_seq_hist}`, v.path);
  }
  return rows;
}

/** A linha da lista que é o item a excluir; para o idioma, a que abre o formulário com o mesmo código. */
async function findTarget(
  op: DeleteOp,
  port: LattesPort,
  rows: Map<string, string>,
): Promise<string> {
  if (op.kind === 'excluir-vinculo') {
    const id = `vinculo:${op.seqHist}`;
    if (!rows.has(id)) throw new Stop('erro', `Vínculo ${op.seqHist} não encontrado no Lattes`);
    return id;
  }
  const hits: string[] = [];
  for (const [id, path] of rows) {
    const controls = formControls(port, await getChecked(port, path), 'GN_IDIOMA');
    if (pairValue(successfulPairs(controls), 'F_COD_IDIOMA') === op.code) hits.push(id);
  }
  if (hits.length !== 1) {
    throw new Stop('erro', `Idioma ${op.code} não encontrado no Lattes (${hits.length} achados)`);
  }
  return hits[0]!;
}

/**
 * O del() do formulário troca f_ctr para E. Se a página não tem mais isso,
 * o Lattes mudou a exclusão e nada é enviado. Um E2 (a atuação inteira) não
 * casa.
 */
const DEL_TO_E = /f_ctr\.value\s*=\s*["']E["']/;

/** Ids que estavam e sumiram, e os que apareceram. */
function difference(before: Map<string, string>, after: Map<string, string>) {
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    gone: [...before.keys()].filter((id) => !after.has(id)),
  };
}

/**
 * Exclui e confere. Antes: acha a linha do item, abre o formulário dele e
 * confere a identidade (modo de alteração, números de sequência, valores que
 * o editor tinha). Envia o formulário como o del() do Lattes, com f_ctr=E.
 * Depois: lê as listas de novo, sem olhar a resposta do POST, e só dá por
 * conferido se o item sumiu e nada mais mudou.
 */
export async function applyDelete(op: DeleteOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const { action, name } = EDIT_FORM[op.kind];
    const before = await snapshot(op, port);
    const target = await findTarget(op, port, before);
    const html = await getChecked(port, before.get(target)!);
    const controls = formControls(port, html, name);
    if (!DEL_TO_E.test(html)) {
      return result(
        'erro',
        'O formulário do Lattes não exclui mais como o conector espera; nada foi enviado',
      );
    }
    const pairs: Pairs = successfulPairs(controls);
    const checked = withCheckRules(name, controls, pairs);
    if (pairValue(checked, 'f_ctr') !== 'U') {
      return result('erro', 'O formulário não está em modo de alteração');
    }
    const identity: FieldValues =
      op.kind === 'excluir-idioma'
        ? { F_COD_IDIOMA: op.code, f_seq: target.slice('idioma:'.length) }
        : { f_seq_ativ: op.seqAtiv, f_seq_hist: op.seqHist };
    const wrong = Object.entries({ ...op.expect, ...identity })
      .filter(([field, value]) => pairValue(checked, field) !== value)
      .map(([field]) => field);
    if (wrong.length > 0) {
      return result('divergente', `O Lattes não está como o editor espera: ${wrong.join(', ')}`);
    }

    // Como o del() do Lattes: o formulário inteiro, como está, só com f_ctr=E.
    // Um erro no envio (rede, aba fechada) não quer dizer que o pedido não
    // chegou: a conferência pela lista roda do mesmo jeito.
    let sendError: string | undefined;
    try {
      await port.post(action, encodeLatin1Form(setPairs(pairs, { f_ctr: 'E' })));
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'falha inesperada';
    }

    // Daqui em diante o Lattes pode ter excluído: toda falha diz isso, para
    // ninguém mandar de novo às cegas.
    const lead = sendError
      ? `O envio da exclusão deu erro (${sendError}) e pode ter chegado ao Lattes`
      : 'O Lattes recebeu a exclusão';
    const maybe = (why: string) =>
      result('divergente', `${lead}, mas ${why}. Confira no Lattes antes de mandar de novo.`);
    let after: Map<string, string>;
    try {
      after = await snapshot(op, port);
    } catch (err) {
      return maybe(`a conferência falhou (${err instanceof Error ? err.message : 'sem detalhe'})`);
    }
    const { added, gone } = difference(before, after);
    if (after.has(target)) return maybe('o item continua na lista do Lattes');
    const others = gone.filter((id) => id !== target);
    if (others.length > 0 || added.length > 0) {
      return maybe(`a lista mudou além do item: ${[...others, ...added].join(', ')}`);
    }
    return result('conferido', 'Excluído e conferido no Lattes');
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
