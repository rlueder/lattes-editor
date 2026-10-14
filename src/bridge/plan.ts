// Da lista de alterações do editor para operações nos formulários do
// Lattes. Só entra o que foi observado no Lattes (docs/lattes_internals.md,
// seção 5): campos do vínculo de uma atuação e o resumo. O resto fica
// "não suportado ainda" e segue pelo caminho de copiar à mão.

import { type Change, resolvePath } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { BIOGRAPHIC_OPS_ENABLED, type BiographicOp, planBiographic } from './biographic.ts';
import { CREATE_ITEMS_ENABLED, type CreateAtuacaoOp, planCreateAtuacao } from './create.ts';
import { DELETE_ITEMS_ENABLED, type DeleteOp, planDelete } from './delete.ts';
import { EDIT_ITEMS_ENABLED, type EventoOp, planEvento } from './edit-items.ts';
import { IDIOMA_SKILLS, LEVEL } from './idioma-skills.ts';

/** Valor de campo; null tira o campo do envio (caixa desmarcada). */
export type FieldValues = Record<string, string | null>;

export interface OpBase {
  /**
   * Valores que o formulário precisa ter agora, antes de gravar: o "antes"
   * de cada campo alterado e o início do vínculo. Se não bater, a linha do
   * Lattes não é a que o editor pensa, e nada é enviado.
   */
  expect: FieldValues;
  /** Chave da mudança no editor (Change.key). */
  key: string;
  label: string;
  set: FieldValues;
}

export interface VinculoOp extends OpBase {
  codInst?: string;
  kind: 'vinculo';
  seqAtiv: string;
  seqHist: string;
}

export interface ResumoOp extends OpBase {
  kind: 'resumo';
}

/** Idioma: a exportação não traz número de sequência; a linha se acha pelo código (EN, ES…). */
export interface IdiomaOp extends OpBase {
  code: string;
  kind: 'idioma';
}

export type BridgeOp =
  BiographicOp | CreateAtuacaoOp | DeleteOp | EventoOp | IdiomaOp | ResumoOp | VinculoOp;

/** Chaves das operações que ainda não foram testadas num Lattes real. */
export interface PlanOptions {
  biographicOps?: boolean;
  createItems?: boolean;
  deleteItems?: boolean;
  editItems?: boolean;
}

export interface Unsupported {
  key: string;
  label: string;
  reason: string;
}

type Mapper = (value: string) => string | null;
const same: Mapper = (v) => v;

/** Atributo do VINCULOS → campo do formulário GN_ATIV_VINC. */
const VINCULO_FIELDS: Record<string, [string, Mapper]> = {
  'ANO-FIM': ['f_ano_fim', same],
  'ANO-INICIO': ['f_ano_ini', same],
  'CARGA-HORARIA-SEMANAL': ['f_carga', same],
  // Caixa com valor 3: marcada = dedicação exclusiva.
  'FLAG-DEDICACAO-EXCLUSIVA': ['f_regime', (v) => (v === 'SIM' ? '3' : null)],
  'FLAG-VINCULO-EMPREGATICIO': ['f_stavinc', (v) => (v === 'SIM' ? '1' : v === 'NAO' ? '0' : '')],
  'MES-FIM': ['f_mes_fim', same],
  'MES-INICIO': ['f_mes_ini', same],
  'OUTRAS-INFORMACOES': ['f_outras_inf', same],
  'OUTRAS-INFORMACOES-INGLES': ['f_outras_inf_en', same],
  'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO': ['f_enqua', same],
  'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES': ['f_enqua_en', same],
};

function idiomaFields(change: Change): {
  expect: FieldValues;
  missing: string[];
  set: FieldValues;
} {
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  for (const f of change.fields) {
    const skill = IDIOMA_SKILLS[f.attr];
    if (!skill) {
      missing.push(f.label);
      continue;
    }
    const after = LEVEL[f.after] ?? null;
    const before = LEVEL[f.before] ?? null;
    set[`FC_${skill}`] = after ? 'on' : null;
    set[`F_${skill}`] = after;
    expect[`FC_${skill}`] = before ? 'on' : null;
    expect[`F_${skill}`] = before;
  }
  return { expect, missing, set };
}

const RESUMO_FIELDS: Record<string, [string, Mapper]> = {
  'TEXTO-RESUMO-CV-RH': ['F_TEXTO', same],
  'TEXTO-RESUMO-CV-RH-EN': ['F_TEXTO_EN', same],
};

function mapFields(
  change: Change,
  table: Record<string, [string, Mapper]>,
): { expect: FieldValues; missing: string[]; set: FieldValues } {
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  for (const f of change.fields) {
    const entry = table[f.attr];
    if (!entry) {
      missing.push(f.label);
      continue;
    }
    const [field, map] = entry;
    set[field] = map(f.after);
    expect[field] = map(f.before);
  }
  return { expect, missing, set };
}

function unsupported(change: Change, label: string, reason: string): Unsupported {
  return { key: change.key, label, reason };
}

/**
 * Planeja uma mudança. `chain` é o caminho resolvido na cópia de trabalho
 * (resolvePath), da raiz até o elemento alterado.
 */
export function planChange(
  change: Change,
  chain: XElement[],
  label: string,
  {
    biographicOps = BIOGRAPHIC_OPS_ENABLED,
    createItems = CREATE_ITEMS_ENABLED,
    deleteItems = DELETE_ITEMS_ENABLED,
    editItems = EDIT_ITEMS_ENABLED,
  }: PlanOptions = {},
): BridgeOp | Unsupported {
  // Inclusão: desligada até o teste no Lattes real (create.ts). Só a atuação.
  if (change.kind === 'novo' && createItems && change.element === 'ATUACAO-PROFISSIONAL') {
    const el = chain.at(-1);
    if (!el || el.name !== change.element) {
      return unsupported(change, label, 'O item não existe mais na cópia de trabalho');
    }
    const planned = planCreateAtuacao(change, el, label);
    return 'reason' in planned ? unsupported(change, label, planned.reason) : planned;
  }
  // Exclusão: desligada até o teste no Lattes real (delete.ts).
  if (change.kind === 'removido') return planDelete(change, chain, label, deleteItems);
  if (change.kind !== 'alterado') {
    return unsupported(change, label, 'Incluir ou excluir pelo conector: não suportado ainda');
  }
  const el = chain.at(-1);
  if (!el || el.name !== change.element) {
    return unsupported(change, label, 'O item não existe mais na cópia de trabalho');
  }

  if (change.element === 'VINCULOS') {
    const atuacao = chain.at(-2);
    const seqAtiv = atuacao && getAttr(atuacao, 'SEQUENCIA-ATIVIDADE');
    const seqHist = getAttr(el, 'SEQUENCIA-HISTORICO');
    if (atuacao?.name !== 'ATUACAO-PROFISSIONAL' || !seqAtiv || !seqHist) {
      return unsupported(change, label, 'Vínculo sem número de sequência');
    }
    const { expect, missing, set } = mapFields(change, VINCULO_FIELDS);
    if (missing.length > 0) {
      return unsupported(change, label, `Campos não suportados ainda: ${missing.join(', ')}`);
    }
    // Situação (atual/anterior) acompanha o fim: sem ano de fim, é atual.
    if ('f_ano_fim' in set) {
      set.f_status = set.f_ano_fim ? 'N' : 'S';
      expect.f_status = expect.f_ano_fim ? 'N' : 'S';
    }
    // Conferência de identidade: o início do vínculo tem de bater.
    if (!('f_ano_ini' in expect)) expect.f_ano_ini = getAttr(el, 'ANO-INICIO') ?? '';
    if (!('f_mes_ini' in expect)) expect.f_mes_ini = getAttr(el, 'MES-INICIO') ?? '';
    return {
      codInst: getAttr(atuacao, 'CODIGO-INSTITUICAO') || undefined,
      expect,
      key: change.key,
      kind: 'vinculo',
      label,
      seqAtiv,
      seqHist,
      set,
    };
  }

  if (change.element === 'IDIOMA') {
    const code = getAttr(el, 'IDIOMA');
    if (!code) return unsupported(change, label, 'Idioma sem código');
    const { expect, missing, set } = idiomaFields(change);
    if (missing.length > 0) {
      return unsupported(change, label, `Campos não suportados ainda: ${missing.join(', ')}`);
    }
    // O Lattes exige ao menos uma habilidade informada.
    const anyLeft = Object.keys(IDIOMA_SKILLS).some((a) => LEVEL[getAttr(el, a) ?? '']);
    if (!anyLeft) {
      return unsupported(change, label, 'O Lattes exige ao menos uma proficiência informada');
    }
    return { code, expect, key: change.key, kind: 'idioma', label, set };
  }

  if (change.element === 'RESUMO-CV') {
    const { expect, missing, set } = mapFields(change, RESUMO_FIELDS);
    if (missing.length > 0) {
      return unsupported(change, label, `Campos não suportados ainda: ${missing.join(', ')}`);
    }
    return { expect, key: change.key, kind: 'resumo', label, set };
  }

  // Formação, endereço e identificação: desligados até o teste no Lattes real (biographic.ts).
  const biographic = biographicOps ? planBiographic(change, chain, label) : undefined;
  if (biographic) {
    return 'reason' in biographic ? unsupported(change, label, biographic.reason) : biographic;
  }
  // Participação em eventos: desligada até o teste no Lattes real (edit-items.ts).
  const evento = editItems ? planEvento(change, chain, label) : undefined;
  if (evento) return 'reason' in evento ? unsupported(change, label, evento.reason) : evento;

  return unsupported(change, label, 'Formulário não suportado ainda');
}

export function isOp(p: BridgeOp | Unsupported): p is BridgeOp {
  return 'kind' in p;
}

/** Planeja a lista inteira; `entries` vem da lista de alterações do editor. */
export function planChanges(
  entries: { change: Change; itemTitle: string }[],
  root: XElement,
  options: PlanOptions = {},
): { ops: BridgeOp[]; unsupported: Unsupported[] } {
  const ops: BridgeOp[] = [];
  const skipped: Unsupported[] = [];
  for (const { change, itemTitle } of entries) {
    const label = itemTitle ? `${change.form} · ${itemTitle}` : change.form;
    const planned = planChange(change, resolvePath(root, change.path), label, options);
    if (isOp(planned)) ops.push(planned);
    else skipped.push(planned);
  }
  return { ops, unsupported: skipped };
}
