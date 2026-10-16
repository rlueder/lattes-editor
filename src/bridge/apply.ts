// Aplicar uma operação no Lattes: achar o formulário, conferir que ele está
// como o editor espera, enviar com só os campos da operação trocados, ler de
// novo e conferir que só eles mudaram. Qualquer surpresa para a fila.
//
// Roda dentro da aba do Lattes (sessão do próprio usuário) ou num teste, com
// um Lattes falso: o acesso à rede e ao DOM entra pela porta (LattesPort).

import {
  BIOGRAPHIC_SPECS,
  type BiographicOp,
  isBiographicOp,
  locateBiographic,
} from './biographic.ts';
import { applyCreateAtuacao } from './create.ts';
import {
  applyCreateAtividade,
  applyCreateEvento,
  applyCreateFormacao,
  applyCreateGeneral,
  applyCreateProjeto,
  applyCreateRegistro,
  applyCreateVinculo,
} from './create-items.ts';
import { applyDelete, type DeleteOp, isDeleteOp } from './delete.ts';
import {
  EDIT_EVENTO_ENABLED,
  EVENTO_SPEC,
  type EventoOp,
  isEventoOp,
  isFullEvento,
  locateEvento,
} from './edit-items.ts';
import {
  countListEdits,
  enabledListEdits,
  isListEditOp,
  LIST_EDIT_WATCH,
  type ListEditKind,
  type ListEditOp,
  listEditSpec,
  locateListEdit,
} from './edit-lists.ts';
import { fieldLabel } from './field-labels.ts';
import {
  encodeLatin1Form,
  type FormControl,
  identityMismatches,
  normalizeNewlines,
  type Pairs,
  pairValue,
  setPairs,
  successfulPairs,
  withCheckRules,
} from './form.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import type { BridgeOp, FieldValues } from './plan.ts';

export interface LattesPort {
  /** GET de um caminho relativo a /cvlattesweb/; texto já decodificado de Latin-1. */
  get(path: string): Promise<string>;
  /** HTML do menu do editor (a página aberta na aba). */
  menuHtml(): Promise<string> | string;
  post(path: string, body: string): Promise<string>;
  /** Controles de um formulário pelo nome, ou undefined se a página não o tem. */
  readForm(html: string, formName: string): FormControl[] | undefined;
}

export type ResultStatus = 'conferido' | 'divergente' | 'erro' | 'sessao';

export interface OpResult {
  /** Números que o Lattes deu a um item criado (SEQUENCIA-ATIVIDADE…). */
  assigned?: Record<string, string>;
  detail: string;
  key: string;
  status: ResultStatus;
}

type EditOp = Exclude<
  BridgeOp,
  | BiographicOp
  | DeleteOp
  | EventoOp
  | ListEditOp
  | {
      kind:
        | 'criar-atividade'
        | 'criar-atuacao'
        | 'criar-dado'
        | 'criar-evento'
        | 'criar-formacao'
        | 'criar-projeto'
        | 'criar-registro'
        | 'criar-vinculo';
    }
>;

const FORMS: Record<EditOp['kind'], { action: string; name: string }> = {
  idioma: { action: 'PKG_IDIOMA.FORM', name: 'GN_IDIOMA' },
  resumo: { action: 'PKG_RESUME.FORM', name: 'RES' },
  vinculo: { action: 'PKG_ATIV.VINCULOS', name: 'GN_ATIV_VINC' },
};

class Stop extends Error {
  status: ResultStatus;
  constructor(status: ResultStatus, detail: string) {
    super(detail);
    this.status = status;
  }
}

async function getChecked(port: LattesPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path))
    throw new Stop('sessao', 'A sessão do Lattes expirou; entre de novo');
  return html;
}

/**
 * O XML traz CODIGO-INSTITUICAO sem a letra que o Lattes põe na frente no
 * f_codinst (001000000998 no XML, D001000000998 no link). Observado em
 * 11/10/2026; o sentido da letra não se sabe.
 */
export function sameInstitution(
  fromLattes: string | undefined,
  fromXml: string | undefined,
): boolean {
  if (!fromXml) return true;
  if (!fromLattes) return false;
  return fromLattes === fromXml || fromLattes.replace(/^[A-Za-z]/, '') === fromXml;
}

/** Caminho do formulário da operação, seguindo os links do próprio Lattes. */
async function locate(op: EditOp, port: LattesPort, menu: string): Promise<string> {
  if (op.kind === 'resumo') {
    // Inferido: o único procedimento pkg_resume linkado no menu abre o resumo.
    const link = findLinks(menu, 'pkg_resume.')[0];
    if (!link) throw new Stop('erro', 'Resumo não encontrado no menu do Lattes');
    return link.path;
  }
  if (op.kind === 'idioma') {
    // Cada linha da lista abre um formulário; o certo é o que traz o mesmo código.
    const lista = findLinks(menu, 'pkg_idioma.lista')[0];
    if (!lista) throw new Stop('erro', 'Idiomas não encontrados no menu do Lattes');
    const listaHtml = await getChecked(port, lista.path);
    const forms = findLinks(listaHtml, 'pkg_idioma.form').filter((l) => l.params.f_seq);
    const hits: string[] = [];
    for (const f of forms) {
      const { pairs } = await readPairs(port, f.path, 'GN_IDIOMA');
      if (pairValue(pairs, 'F_COD_IDIOMA') === op.code) hits.push(f.path);
    }
    if (hits.length !== 1) {
      throw new Stop('erro', `Idioma ${op.code} não encontrado no Lattes (${hits.length} achados)`);
    }
    return hits[0]!;
  }
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
  const listaHtml = await getChecked(port, lista.path);
  const grids = findLinks(listaHtml, 'pkg_ativ.cargos_vinculos').filter(
    (l) => l.params.f_seq_ativ === op.seqAtiv && sameInstitution(l.params.f_codinst, op.codInst),
  );
  if (grids.length !== 1) {
    throw new Stop(
      'erro',
      `Atuação ${op.seqAtiv} não encontrada no Lattes (${grids.length} achadas)`,
    );
  }
  const gridHtml = await getChecked(port, grids[0]!.path);
  const vinculos = findLinks(gridHtml, 'pkg_ativ.vinculos').filter(
    (l) => l.params.f_seq_hist === op.seqHist,
  );
  if (vinculos.length !== 1) {
    throw new Stop('erro', `Vínculo ${op.seqHist} não encontrado no Lattes`);
  }
  return vinculos[0]!.path;
}

async function readPairs(
  port: LattesPort,
  path: string,
  form: string,
): Promise<{ controls: FormControl[]; pairs: Pairs }> {
  const html = await getChecked(port, path);
  const controls = port.readForm(html, form);
  if (!controls) {
    throw isLogonPage(html)
      ? new Stop('sessao', 'A sessão do Lattes expirou; entre de novo')
      : new Stop('erro', `Formulário ${form} não encontrado`);
  }
  return { controls, pairs: withCheckRules(form, controls, successfulPairs(controls)) };
}

const same = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && normalizeNewlines(a) === normalizeNewlines(b));

function mismatches(pairs: Pairs, values: FieldValues): string[] {
  return Object.entries(values)
    .filter(([name, v]) => !same(pairValue(pairs, name), v))
    .map(([name]) => name);
}

/** Campos que mudaram entre dois envios (por nome). */
function changedNames(a: Pairs, b: Pairs): string[] {
  const names = new Set([...a, ...b].map(([k]) => k));
  return [...names].filter((n) => !same(pairValue(a, n), pairValue(b, n)));
}

/**
 * As alterações atrás de chave que este lado grava: as que têm o formulário
 * no contrato dele. O app só manda essas operações a uma extensão que anuncia
 * a capacidade (plan.ts, GATED_EDITS), mas a extensão não confia nisso: uma
 * operação de um tipo cuja chave ela tem desligada para sem enviar nada.
 */
export interface ApplyGates {
  editEvento: boolean;
  lists: ReadonlySet<ListEditKind>;
}

export const BUILD_GATES: ApplyGates = {
  editEvento: EDIT_EVENTO_ENABLED,
  lists: enabledListEdits(),
};

/** Por que esta extensão não grava a operação; undefined quando grava. */
function gatedOut(op: BridgeOp, gates: ApplyGates): string | undefined {
  if (isListEditOp(op) && !gates.lists.has(op.kind)) {
    return 'Esta extensão não tem o formulário deste tipo no contrato; a alteração fica à mão';
  }
  if (isEventoOp(op) && !gates.editEvento && isFullEvento(op)) {
    return 'Esta extensão só altera eventos de ouvinte; a alteração fica à mão';
  }
  return undefined;
}

export async function applyOp(
  op: BridgeOp,
  port: LattesPort,
  gates: ApplyGates = BUILD_GATES,
): Promise<OpResult> {
  if (op.kind === 'criar-atuacao') return applyCreateAtuacao(op, port);
  if (op.kind === 'criar-formacao') return applyCreateFormacao(op, port);
  if (op.kind === 'criar-projeto') return applyCreateProjeto(op, port);
  if (op.kind === 'criar-registro') return applyCreateRegistro(op, port);
  if (op.kind === 'criar-dado') return applyCreateGeneral(op, port);
  if (op.kind === 'criar-atividade') return applyCreateAtividade(op, port);
  if (op.kind === 'criar-evento') return applyCreateEvento(op, port);
  if (op.kind === 'criar-vinculo') return applyCreateVinculo(op, port);
  if (isDeleteOp(op)) return applyDelete(op, port);
  const result = (status: ResultStatus, detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  const gated = gatedOut(op, gates);
  if (gated) return result('erro', gated);
  try {
    // Formação, endereço e identificação (biographic.ts), participação em
    // eventos (edit-items.ts) e as listas sem número (edit-lists.ts):
    // formulários e caminhos próprios.
    const spec: { action: string; mode?: string; name: string } = isBiographicOp(op)
      ? BIOGRAPHIC_SPECS[op.kind]
      : isEventoOp(op)
        ? EVENTO_SPEC
        : isListEditOp(op)
          ? listEditSpec(op.kind)
          : FORMS[op.kind];
    const { action, name } = spec;
    const menu = await port.menuHtml();
    const get = (p: string) => getChecked(port, p);
    // Nas listas sem número, quantas linhas havia: um envio que inclui em vez
    // de alterar aparece como uma linha a mais.
    let listed: number | undefined;
    const path = isBiographicOp(op)
      ? await locateBiographic(op, menu, get)
      : isEventoOp(op)
        ? await locateEvento(op, menu, get)
        : isListEditOp(op)
          ? await locateListEdit(
              op,
              menu,
              get,
              async (p) => (await readPairs(port, p, name)).pairs,
            ).then((found) => {
              listed = found.listed;
              return found.path;
            })
          : await locate(op, port, menu);
    const before = await readPairs(port, path, name);

    // O f_ctr da edição é U; o da formação complementar vem vazio (seção 15).
    if (pairValue(before.pairs, 'f_ctr') !== (spec.mode ?? 'U')) {
      return result('erro', 'O formulário não está em modo de alteração');
    }
    const labels = (names: string[]) => names.map((n) => fieldLabel(n, op.kind)).join(', ');
    const wrong = [
      ...mismatches(before.pairs, op.expect),
      ...identityMismatches(op.identity, (n) => pairValue(before.pairs, n)),
    ];
    if (wrong.length > 0) {
      return result('divergente', `O Lattes não está como o editor espera: ${labels(wrong)}`);
    }
    for (const [field, value] of Object.entries(op.set)) {
      const limit = before.controls.find((c) => c.name === field)?.maxLength;
      if (value && limit && limit > 0 && value.length > limit) {
        return result(
          'erro',
          `${fieldLabel(field, op.kind)} passa do limite do Lattes (${limit} caracteres)`,
        );
      }
    }
    // Nada a trocar: só no evento, onde a natureza vai para ser conferida e
    // não trocada (edit-items.ts). O "antes" já bateu, e enviar o formulário
    // igual só acenderia a pendência. Os outros tipos seguem enviando sempre.
    if (isEventoOp(op) && mismatches(before.pairs, op.set).length === 0) {
      return result('conferido', 'O Lattes já estava assim; nada foi enviado');
    }

    const next = setPairs(before.pairs, op.set);
    const response = await port.post(action, encodeLatin1Form(next));
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');

    if (isListEditOp(op) && listed !== undefined) {
      // O f_ctr desses formulários não distingue sempre incluir de alterar (o
      // da formação complementar vem vazio nos dois): a lista não pode ter
      // ganhado linha.
      const now = await countListEdits(op.kind, menu, get);
      if (now > listed) {
        return result(
          'divergente',
          `O Lattes incluiu uma linha nova em vez de alterar (${listed} antes, ${now} depois): confira a lista no Lattes e exclua a cópia`,
        );
      }
    }

    const after = await readPairs(port, path, name);
    const notSaved = mismatches(after.pairs, op.set);
    if (notSaved.length > 0) {
      return result('divergente', `O Lattes não gravou: ${labels(notSaved)}`);
    }
    // f_vinculo é preenchido no envio (check()); a página sempre o traz vazio.
    const unexpected = changedNames(before.pairs, after.pairs).filter(
      (n) => !(n in op.set) && n !== 'f_vinculo',
    );
    // Campos desabilitados não vão nos pares; os que identificam o item
    // (instituição e curso da formação complementar) se conferem à parte.
    const value = (controls: FormControl[], n: string) =>
      controls.find((c) => c.name === n)?.value ?? null;
    for (const n of isListEditOp(op) ? LIST_EDIT_WATCH[op.kind] : []) {
      if (!same(value(before.controls, n), value(after.controls, n))) unexpected.push(n);
    }
    if (unexpected.length > 0) {
      return result('divergente', `Outros campos mudaram no Lattes: ${labels(unexpected)}`);
    }
    return result('conferido', 'Gravado e conferido no Lattes');
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}

/** Aplica em ordem e para na primeira operação que não for conferida, ou quando pedirem. */
export async function applyAll(
  ops: BridgeOp[],
  port: LattesPort,
  hooks: {
    gates?: ApplyGates;
    onResult?: (r: OpResult) => void;
    shouldStop?: () => boolean;
  } = {},
): Promise<OpResult[]> {
  const results: OpResult[] = [];
  for (const op of ops) {
    if (hooks.shouldStop?.()) break;
    const r = await applyOp(op, port, hooks.gates);
    results.push(r);
    hooks.onResult?.(r);
    if (r.status !== 'conferido') break;
  }
  return results;
}
