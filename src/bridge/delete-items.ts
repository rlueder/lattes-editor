// Excluir no Lattes os itens que delete.ts não cobre: as produções, os
// projetos, as orientações, as bancas, a licença e a linha de pesquisa
// (production/), os eventos, os prêmios, as duas formações, as atividades e a
// atuação inteira. Cada um se exclui como o botão Excluir da página: o
// formulário de alteração do item, achado pelo mesmo caminho da alteração,
// com f_ctr trocado para E (seção 15). Nas formações, o del() da página antes
// pode tornar pública outra formação (SETA_ULTIMO_PUBLICO); o conector faz o
// mesmo e diz isso no resultado. A atuação inteira sai por GET com f_ctr=E2 e
// leva junto atividades, vínculos, projetos e linhas de pesquisa, como o
// aviso do Lattes diz; o editor só a manda quando a pessoa tirou a atuação
// inteira, com tudo isso dentro.
//
// Observado: a exclusão de um evento de teste pelo POST com f_ctr=E
// (14/10/2026). Inferido, até o teste acompanhado: as outras telas, que o
// servidor exclua do mesmo jeito; a exclusão da atividade, cujo formulário
// não foi visto com o botão Excluir (sem o del() na página, nada vai).

import type { Change } from '../model/changes.ts';
import { resolvePath } from '../model/changes.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { AP_LEVELS, FORMATION_LEVELS } from './create-formacao.ts';
import { ACTIVITY_TYPES } from './edit-atividade.ts';
import { EVENT_CODES } from './edit-items.ts';
import { COMPL_LEVELS, isComplementaryItem, type ListEditKind } from './edit-lists.ts';
import type { FieldValues, Unsupported } from './plan.ts';
import { productionIdentity } from './production/identity.ts';
import { PRODUCTION_TARGETS } from './production/targets/index.ts';

/** As exclusões deste módulo. O plano só as usa com a capacidade 'excluir-mais'. */
export const DELETE_MORE_ENABLED = true;

/** Como achar o formulário do item, pelo mesmo caminho da alteração. */
export type DeleteLocator =
  | { by: 'atividade'; codInst?: string; natur: string; seqAtiv: string; seqFuncao: string }
  | { by: 'evento'; seq: string }
  | { by: 'formacao'; list: 'AP' | 'FA'; seq: string }
  | { by: 'lista'; kind: ListEditKind; match: FieldValues }
  | {
      by: 'producao';
      listParams?: Record<string, string>;
      match: { title: string; year: string };
      target: string;
    };

export interface DeleteItemOp {
  expect: FieldValues;
  /** Campos do formulário que confirmam que é o item (sem acento nem caixa). */
  identity: FieldValues;
  key: string;
  kind: 'excluir-item';
  label: string;
  locator: DeleteLocator;
  rows: { after: string; before: string; label: string; name: string }[];
  set: FieldValues;
  /** O ajax que o del() das formações chama antes, quando nenhuma outra formação é pública. */
  seta?: string;
}

export interface DeleteAtuacaoOp {
  codInst?: string;
  expect: FieldValues;
  key: string;
  kind: 'excluir-atuacao';
  label: string;
  rows: { after: string; before: string; label: string; name: string }[];
  seqAtiv: string;
  set: FieldValues;
}

export const isDeleteItemOp = (op: { kind: string }): op is DeleteAtuacaoOp | DeleteItemOp =>
  op.kind === 'excluir-item' || op.kind === 'excluir-atuacao';

/** O aviso do Lattes na exclusão da atuação inteira (seção 15). */
export const ATUACAO_CASCADE =
  'Apaga no Lattes a atuação com todas as atividades, vínculos, projetos e linhas de pesquisa dela';

const at = (el: XElement | undefined, attr: string) => (el ? (getAttr(el, attr) ?? '') : '');
const partOf = (el: XElement, prefix: string) =>
  childElements(el).find((c) => c.name.startsWith(prefix));

/**
 * A exclusão de um item tirado no editor, pelo item como estava no original;
 * undefined quando o tipo não é deste módulo.
 */
export function planDeleteItem(
  change: Change,
  original: XElement,
  label: string,
): DeleteAtuacaoOp | DeleteItemOp | Unsupported | undefined {
  if (change.kind !== 'removido') return undefined;
  const chain = resolvePath(original, change.path);
  const item = chain.at(-1);
  if (!item || item.name !== change.element || chain.length !== change.path.length)
    return undefined;
  const no = (reason: string): Unsupported => ({ key: change.key, label, reason });
  const base = {
    expect: {},
    key: change.key,
    label: `Excluir: ${label}`,
    rows: [{ after: '(sai do Lattes)', before: label, label: 'Item', name: 'f_ctr' }],
    set: {},
  };
  const atuacao = chain.find((e) => e.name === 'ATUACAO-PROFISSIONAL');

  if (item.name === 'ATUACAO-PROFISSIONAL') {
    const seqAtiv = at(item, 'SEQUENCIA-ATIVIDADE');
    if (!seqAtiv) return no('Atuação sem número de sequência');
    return {
      ...base,
      codInst: at(item, 'CODIGO-INSTITUICAO') || undefined,
      kind: 'excluir-atuacao',
      rows: [{ after: ATUACAO_CASCADE, before: label, label: 'Atuação', name: 'f_ctr' }],
      seqAtiv,
    };
  }

  const target = PRODUCTION_TARGETS.find((t) => t.element === item.name);
  if (target) {
    const found = productionIdentity(change, item, target);
    if ('reason' in found) return no(found.reason);
    return {
      ...base,
      identity: {},
      kind: 'excluir-item',
      locator: { by: 'producao', ...found, target: target.id },
    };
  }

  if (item.name in EVENT_CODES) {
    const seq = at(item, 'SEQUENCIA-PRODUCAO');
    if (!seq) return no('Evento sem número de sequência');
    const basics = partOf(item, 'DADOS-BASICOS-');
    const detail = partOf(item, 'DETALHAMENTO-');
    return {
      ...base,
      identity: {
        f_ano: at(basics, 'ANO'),
        F_COD_PROD: EVENT_CODES[item.name]!,
        f_nme_evento: at(detail, 'NOME-DO-EVENTO'),
      },
      kind: 'excluir-item',
      locator: { by: 'evento', seq },
    };
  }

  if (item.name === 'PREMIO-TITULO') {
    return {
      ...base,
      identity: {},
      kind: 'excluir-item',
      locator: {
        by: 'lista',
        kind: 'premio',
        match: {
          f_ano: at(item, 'ANO-DA-PREMIACAO'),
          f_titulo: at(item, 'NOME-DO-PREMIO-OU-TITULO'),
        },
      },
    };
  }

  if (isComplementaryItem(item.name, chain.at(-2)?.name)) {
    return {
      ...base,
      identity: { f_nivel: at(item, 'NIVEL') || COMPL_LEVELS[item.name]! },
      kind: 'excluir-item',
      locator: {
        by: 'lista',
        kind: 'formacao-complementar',
        match: { f_curso_old: at(item, 'NOME-CURSO'), f_inst_old: at(item, 'NOME-INSTITUICAO') },
      },
      seta: 'PKG_FORMACAO_COMPL.SETA_ULTIMO_PUBLICO',
    };
  }

  const level = FORMATION_LEVELS[item.name] ?? AP_LEVELS[item.name];
  if (level && chain.at(-2)?.name === 'FORMACAO-ACADEMICA-TITULACAO') {
    const seq = at(item, 'SEQUENCIA-FORMACAO');
    if (!seq) return no('Formação sem número de sequência');
    const ap = Object.values(AP_LEVELS).includes(level);
    // A livre-docência não tem início: o ano que a identifica é o de obtenção.
    const year: FieldValues =
      level === '6'
        ? { f_ano_obten: at(item, 'ANO-DE-OBTENCAO-DO-TITULO') }
        : { f_ano_ini: at(item, 'ANO-DE-INICIO') };
    return {
      ...base,
      identity: { f_nivel: level, ...year },
      kind: 'excluir-item',
      locator: { by: 'formacao', list: ap ? 'AP' : 'FA', seq },
      seta: 'PKG_FORMACAO.SETA_ULTIMO_PUBLICO',
    };
  }

  const type = ACTIVITY_TYPES[item.name];
  if (type && atuacao) {
    const seqAtiv = at(atuacao, 'SEQUENCIA-ATIVIDADE');
    const seqFuncao = at(item, 'SEQUENCIA-FUNCAO-ATIVIDADE');
    if (!seqAtiv || !seqFuncao) return no('Atividade sem número de sequência');
    return {
      ...base,
      identity: { f_ano_ini: at(item, 'ANO-INICIO') },
      kind: 'excluir-item',
      locator: {
        by: 'atividade',
        codInst: at(atuacao, 'CODIGO-INSTITUICAO') || undefined,
        natur: type.natur,
        seqAtiv,
        seqFuncao,
      },
    };
  }
  return undefined;
}
