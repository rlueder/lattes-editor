// Aplicar uma operação no Lattes: achar o formulário, conferir que ele está
// como o editor espera, enviar com só os campos da operação trocados, ler de
// novo e conferir que só eles mudaram. Qualquer surpresa para a fila.
//
// Roda dentro da aba do Lattes (sessão do próprio usuário) ou num teste, com
// um Lattes falso: o acesso à rede e ao DOM entra pela porta (LattesPort).

import {
  encodeLatin1Form,
  type FormControl,
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
  detail: string;
  key: string;
  status: ResultStatus;
}

const FORMS: Record<BridgeOp['kind'], { action: string; name: string }> = {
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
  if (isLogonPage(html, path)) throw new Stop('sessao', 'A sessão do Lattes caiu; entre de novo');
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
async function locate(op: BridgeOp, port: LattesPort, menu: string): Promise<string> {
  if (op.kind === 'resumo') {
    // Inferido: o único procedimento pkg_resume linkado no menu abre o resumo.
    const link = findLinks(menu, 'pkg_resume.')[0];
    if (!link) throw new Stop('erro', 'Resumo não encontrado no menu do Lattes');
    return link.path;
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
      ? new Stop('sessao', 'A sessão do Lattes caiu; entre de novo')
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

export async function applyOp(op: BridgeOp, port: LattesPort): Promise<OpResult> {
  const result = (status: ResultStatus, detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const { action, name } = FORMS[op.kind];
    const path = await locate(op, port, await port.menuHtml());
    const before = await readPairs(port, path, name);

    if (pairValue(before.pairs, 'f_ctr') !== 'U') {
      return result('erro', 'O formulário não está em modo de alteração');
    }
    const wrong = mismatches(before.pairs, op.expect);
    if (wrong.length > 0) {
      return result('divergente', `O Lattes não está como o editor espera: ${wrong.join(', ')}`);
    }
    for (const [field, value] of Object.entries(op.set)) {
      const limit = before.controls.find((c) => c.name === field)?.maxLength;
      if (value && limit && limit > 0 && value.length > limit) {
        return result('erro', `${field} passa do limite do Lattes (${limit} caracteres)`);
      }
    }

    const next = setPairs(before.pairs, op.set);
    const response = await port.post(action, encodeLatin1Form(next));
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes caiu; entre de novo');

    const after = await readPairs(port, path, name);
    const notSaved = mismatches(after.pairs, op.set);
    if (notSaved.length > 0) {
      return result('erro', `O Lattes não gravou: ${notSaved.join(', ')}`);
    }
    // f_vinculo é preenchido no envio (check()); a página sempre o traz vazio.
    const unexpected = changedNames(before.pairs, after.pairs).filter(
      (n) => !(n in op.set) && n !== 'f_vinculo',
    );
    if (unexpected.length > 0) {
      return result('erro', `Outros campos mudaram no Lattes: ${unexpected.join(', ')}`);
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
  hooks: { onResult?: (r: OpResult) => void; shouldStop?: () => boolean } = {},
): Promise<OpResult[]> {
  const results: OpResult[] = [];
  for (const op of ops) {
    if (hooks.shouldStop?.()) break;
    const r = await applyOp(op, port);
    results.push(r);
    hooks.onResult?.(r);
    if (r.status !== 'conferido') break;
  }
  return results;
}
