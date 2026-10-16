// Da lista de alterações do editor para operações nos formulários do
// Lattes. Só entra o que foi observado no Lattes (docs/lattes_internals.md,
// seção 5): campos do vínculo de uma atuação e o resumo. O resto fica
// "não suportado ainda" e segue pelo caminho de copiar à mão.

import { type Change, resolvePath } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { atuacaoByHand, vinculoByHand } from './atuacao-by-hand.ts';
import { BIOGRAPHIC_OPS_ENABLED, type BiographicOp, planBiographic } from './biographic.ts';
import { CREATE_ITEMS_ENABLED, type CreateAtuacaoOp, planCreateAtuacao } from './create.ts';
import { type CreateItemOp, planCreateItem } from './create-items.ts';
import { DELETE_ITEMS_ENABLED, type DeleteOp, planDelete } from './delete.ts';
import {
  EDIT_EVENTO_ENABLED,
  EDIT_OUVINTE_ENABLED,
  type EventoOp,
  planEvento,
} from './edit-items.ts';
import {
  EDIT_FORMACAO_COMPL_ENABLED,
  EDIT_PREMIO_ENABLED,
  type ListEditKind,
  type ListEditOp,
  planListEdit,
} from './edit-lists.ts';
import { IDIOMA_SKILLS, LEVEL } from './idioma-skills.ts';
import { manualReason } from './production/manual.ts';
import {
  EDIT_PRODUCTION_ENABLED,
  isProductionChange,
  planProduction,
  type ProductionOp,
} from './production/plan.ts';
import { stavincFromFlag } from './vinculo-flag.ts';

/** Valor de campo; null tira o campo do envio (caixa desmarcada). */
export type FieldValues = Record<string, string | null>;

export interface OpBase {
  /**
   * Valores que o formulário precisa ter agora, antes de gravar: o "antes"
   * de cada campo alterado e o início do vínculo. Se não bater, a linha do
   * Lattes não é a que o editor pensa, e nada é enviado.
   */
  expect: FieldValues;
  /**
   * Campos que confirmam que o formulário aberto é o do item, além do
   * expect, nas listas em que o número do link não basta (evento, formação):
   * o valor do Lattes, sem acento, caixa nem espaço nas pontas, precisa ser um
   * dos listados (o antes e o depois, quando outra operação da fila troca o
   * campo). Ausente nas operações que não precisam.
   */
  identity?: Record<string, string[]>;
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
  | BiographicOp
  | CreateAtuacaoOp
  | CreateItemOp
  | DeleteOp
  | EventoOp
  | IdiomaOp
  | ProductionOp
  | ListEditOp
  | ResumoOp
  | VinculoOp;

/**
 * Chaves das operações que dependem de teste num Lattes real ou da versão da
 * extensão. Sem valor, cada uma fica desligada: só planOptionsFor liga, com a
 * chave da montagem e a capacidade da extensão.
 */
export interface PlanOptions {
  biographicOps?: boolean;
  createItems?: boolean;
  deleteItems?: boolean;
  /**
   * Convidado, participante, forma, tipo, natureza e cidade do evento
   * (EDIT_EVENTO_ENABLED). Sem valor, desligada, como editOuvinte.
   */
  editEvento?: boolean;
  /** Formação complementar (edit-lists.ts, EDIT_FORMACAO_COMPL_ENABLED). */
  editFormacaoComplementar?: boolean;
  /**
   * Alteração de evento de ouvinte (edit-items.ts). Sem valor, fica
   * desligada: só planOptionsFor liga, com as capacidades da extensão. Assim,
   * esquecer as opções deixa o evento à mão, em vez de mandá-lo a uma
   * extensão que gravaria sem conferir.
   */
  editOuvinte?: boolean;
  /** Prêmios e títulos (edit-lists.ts, EDIT_PREMIO_ENABLED). */
  editPremio?: boolean;
  /** Alterar no lugar produções, orientações e bancas (production/). */
  editProduction?: boolean;
}

/**
 * Chaves de inclusão, exclusão e alteração que dependem de uma capacidade da
 * extensão. Cada uma
 * entra em BRIDGE_FEATURES (compat.ts) no mesmo commit em que a chave liga, e
 * só então, e sai no commit em que ela voltar a desligar (a exceção à regra
 * de compat.ts de que capacidade não sai): uma extensão que anunciasse a
 * capacidade com a chave desligada não teria o formulário no contrato. Mesmo
 * assim, applyOp recusa o tipo desligado na montagem dela (apply.ts,
 * ApplyGates). O teste tests/edit-flags.test.ts cobra chave e capacidade
 * juntas.
 */
export const GATED_EDITS: readonly {
  enabled: boolean;
  feature: string;
  option: keyof PlanOptions;
}[] = [
  { enabled: CREATE_ITEMS_ENABLED, feature: 'incluir-itens', option: 'createItems' },
  { enabled: DELETE_ITEMS_ENABLED, feature: 'excluir-itens', option: 'deleteItems' },
  { enabled: BIOGRAPHIC_OPS_ENABLED, feature: 'alterar-dados-gerais', option: 'biographicOps' },
  { enabled: EDIT_OUVINTE_ENABLED, feature: 'alterar-evento', option: 'editOuvinte' },
  { enabled: EDIT_EVENTO_ENABLED, feature: 'alterar-evento-completo', option: 'editEvento' },
  { enabled: EDIT_PREMIO_ENABLED, feature: 'alterar-premio', option: 'editPremio' },
  {
    enabled: EDIT_FORMACAO_COMPL_ENABLED,
    feature: 'alterar-formacao-complementar',
    option: 'editFormacaoComplementar',
  },
  { enabled: EDIT_PRODUCTION_ENABLED, feature: 'alterar-producao', option: 'editProduction' },
];

/**
 * As chaves do plano para a extensão ligada: cada alteração de GATED_EDITS
 * só vai a uma extensão que anuncia a capacidade dela (compat.ts), porque uma
 * mais antiga não tem o formulário no contrato e gravaria sem conferir. Sem
 * ela, essas mudanças ficam à mão.
 */
export function planOptionsFor(features: readonly string[]): PlanOptions {
  return Object.fromEntries(
    GATED_EDITS.map((g) => [g.option, g.enabled && features.includes(g.feature)]),
  );
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
  // Invertido: f_stavinc 1 (Sim) vem como NAO na exportação (vinculo-flag.ts).
  'FLAG-VINCULO-EMPREGATICIO': ['f_stavinc', stavincFromFlag],
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
    biographicOps = false,
    createItems = false,
    deleteItems = false,
    editEvento = false,
    editFormacaoComplementar = false,
    editOuvinte = false,
    editPremio = false,
    editProduction = false,
  }: PlanOptions = {},
  siblings: readonly Change[] = [],
): BridgeOp | Unsupported {
  // Produção, orientação ou banca que já está no Lattes (production/).
  if (editProduction && isProductionChange(change, chain)) {
    const planned = planProduction(change, chain, label, siblings);
    return 'reason' in planned ? unsupported(change, label, planned.reason) : planned;
  }
  // Inclusão: desligada até o teste no Lattes real (create.ts). Só a atuação.
  if (change.kind === 'novo' && createItems && change.element === 'ATUACAO-PROFISSIONAL') {
    const el = chain.at(-1);
    if (!el || el.name !== change.element) {
      return unsupported(change, label, 'O item não existe mais na cópia de trabalho');
    }
    const planned = planCreateAtuacao(change, el, label);
    return 'reason' in planned ? unsupported(change, label, planned.reason) : planned;
  }
  // Formação e projeto (create-items.ts), com a mesma chave.
  const created =
    change.kind === 'novo' && createItems ? planCreateItem(change, chain, label) : undefined;
  if (created) return 'reason' in created ? unsupported(change, label, created.reason) : created;
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
    const byHand = vinculoByHand(change);
    if (byHand) return unsupported(change, label, byHand);
    const { expect, missing, set } = mapFields(change, VINCULO_FIELDS);
    if (missing.length > 0) {
      return unsupported(change, label, `Campos não suportados ainda: ${missing.join(', ')}`);
    }
    // Situação (atual/anterior) acompanha o fim: sem ano de fim, é atual.
    if ('f_ano_fim' in set) {
      set.f_status = set.f_ano_fim ? 'N' : 'S';
      expect.f_status = expect.f_ano_fim ? 'N' : 'S';
    }
    // Conferência de identidade: o início do vínculo tem de bater. Além da
    // instituição no link da lista (que não confere nada quando o XML vem sem
    // CODIGO-INSTITUICAO) e dos números da atuação e do vínculo, o fim e a
    // carga horária que a operação não troca também conferem, sem acento,
    // caixa nem espaço (identity): ligações observadas nos 8 vínculos do
    // censo de 15/10/2026, sem divergência.
    if (!('f_ano_ini' in expect)) expect.f_ano_ini = getAttr(el, 'ANO-INICIO') ?? '';
    if (!('f_mes_ini' in expect)) expect.f_mes_ini = getAttr(el, 'MES-INICIO') ?? '';
    const identity: Record<string, string[]> = {};
    for (const [field, attr] of [
      ['f_ano_fim', 'ANO-FIM'],
      ['f_mes_fim', 'MES-FIM'],
      ['f_carga', 'CARGA-HORARIA-SEMANAL'],
    ] as const) {
      if (!(field in expect)) identity[field] = [getAttr(el, attr) ?? ''];
    }
    return {
      codInst: getAttr(atuacao, 'CODIGO-INSTITUICAO') || undefined,
      expect,
      identity,
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

  // Prêmios e formação complementar (edit-lists.ts), cada um com a chave própria.
  const lists = new Set<ListEditKind>();
  if (editPremio) lists.add('premio');
  if (editFormacaoComplementar) lists.add('formacao-complementar');
  const listEdit = planListEdit(change, chain, label, lists);
  if (listEdit)
    return 'reason' in listEdit ? unsupported(change, label, listEdit.reason) : listEdit;

  // Formação, endereço e identificação: desligados até o teste no Lattes real (biographic.ts).
  const biographic = biographicOps ? planBiographic(change, chain, label) : undefined;
  if (biographic) {
    return 'reason' in biographic ? unsupported(change, label, biographic.reason) : biographic;
  }
  // Participação em eventos (edit-items.ts): ouvinte testado no Lattes real em
  // 14/10/2026; o resto, com a chave própria.
  const evento =
    editOuvinte || editEvento
      ? planEvento(change, chain, label, { full: editEvento, siblings })
      : undefined;
  if (evento) return 'reason' in evento ? unsupported(change, label, evento.reason) : evento;

  // Atuação, atividades, participação em projeto e áreas de atuação
  // (atuacao-by-hand.ts), antes do motivo genérico de cada família (manual.ts).
  const atuacao = atuacaoByHand(change, chain);
  if (atuacao) return unsupported(change, label, atuacao);
  return unsupported(change, label, manualReason(chain) ?? 'Formulário não suportado ainda');
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
  // As outras mudanças da fila, para uma operação saber o que muda na outra
  // parte do mesmo item (edit-items.ts).
  const all = entries.map((e) => e.change);
  for (const { change, itemTitle } of entries) {
    const label = itemTitle ? `${change.form} · ${itemTitle}` : change.form;
    const planned = planChange(change, resolvePath(root, change.path), label, options, all);
    if (isOp(planned)) ops.push(planned);
    else skipped.push(planned);
  }
  return { ops, unsupported: skipped };
}
