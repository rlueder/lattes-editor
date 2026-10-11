// Da lista de alterações do editor para operações nos formulários do
// Lattes. Só entra o que foi observado no Lattes (docs/lattes_internals.md,
// seção 5): campos do vínculo de uma atuação e o resumo. O resto fica
// "não suportado ainda" e segue pelo caminho de copiar à mão.

import { type Change, resolvePath } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';

/** Valor de campo; null tira o campo do envio (caixa desmarcada). */
export type FieldValues = Record<string, string | null>;

interface OpBase {
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

export type BridgeOp = ResumoOp | VinculoOp;

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
): BridgeOp | Unsupported {
  if (change.kind !== 'alterado') {
    return unsupported(change, label, 'Incluir ou excluir pela ponte: não suportado ainda');
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

  if (change.element === 'RESUMO-CV') {
    const { expect, missing, set } = mapFields(change, RESUMO_FIELDS);
    if (missing.length > 0) {
      return unsupported(change, label, `Campos não suportados ainda: ${missing.join(', ')}`);
    }
    return { expect, key: change.key, kind: 'resumo', label, set };
  }

  return unsupported(change, label, 'Formulário não suportado ainda');
}

export function isOp(p: BridgeOp | Unsupported): p is BridgeOp {
  return 'kind' in p;
}

/** Planeja a lista inteira; `entries` vem da lista de alterações do editor. */
export function planChanges(
  entries: { change: Change; itemTitle: string }[],
  root: XElement,
): { ops: BridgeOp[]; unsupported: Unsupported[] } {
  const ops: BridgeOp[] = [];
  const skipped: Unsupported[] = [];
  for (const { change, itemTitle } of entries) {
    const label = itemTitle ? `${change.form} · ${itemTitle}` : change.form;
    const planned = planChange(change, resolvePath(root, change.path), label);
    if (isOp(planned)) ops.push(planned);
    else skipped.push(planned);
  }
  return { ops, unsupported: skipped };
}
