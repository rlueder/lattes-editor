// Incluir uma atividade de uma atuação que já está no Lattes, nas naturezas
// que não são o ensino (direção, pesquisa e desenvolvimento, estágio, serviço
// técnico, extensão, treinamento, outra e conselho), pelo mesmo formulário
// GN_ATIV_CARGO (create-atividade.ts).
//
// Observado: os campos de cada natureza (censo de 27/10/2026, entradas
// atividade-1 a atividade-B): o órgão, o período e a grade de descrições
// f_espec_l, a mesma do ensino ("<n>@<c>?<texto>!", oito linhas, a linha
// digitada com c 0). O check() exige o órgão ou unidade e ao menos uma
// descrição. A janela de órgãos da atividade (prc_orgao_cargo) e a alteração
// do órgão foram lidas e gravadas em 21/10/2026 (seção 22). Inferido, até o
// teste acompanhado: que a inclusão grave o órgão como a alteração, e a
// descrição de cada natureza no atributo que a exportação mostra.

import type { Change } from '../model/changes.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { type CreateAtividadeOp, specGrid } from './create-atividade.ts';
import type { Planned } from './create-shared.ts';
import { ACTIVITY_TYPES } from './edit-atividade.ts';
import { ACTIVITY_ORGAN_ELEMENTS } from './organ-windows.ts';
import { ORGAN_PARTS } from './production/organ.ts';

/**
 * A inclusão dessas naturezas pelo conector: só a uma extensão com
 * 'atividade-nova-orgao'. Uma mais antiga abriria o formulário do ensino.
 */
export const CREATE_ACTIVITY_ORGAN_ENABLED = true;

/** As linhas da grade que vêm de elementos filhos: o título num atributo, ou o texto. */
const GRID_CHILDREN: Record<string, { child: string; title?: string }> = {
  'PESQUISA-E-DESENVOLVIMENTO': {
    child: 'LINHA-DE-PESQUISA',
    title: 'TITULO-DA-LINHA-DE-PESQUISA',
  },
  'TREINAMENTO-MINISTRADO': { child: 'TREINAMENTO' },
};

/** O que a linha de pesquisa nova leva além do título; vai depois, pela tela de linhas. */
const LINE_OWN = new Set(['SEQUENCIA-LINHA', 'TITULO-DA-LINHA-DE-PESQUISA']);

const PERIOD = new Set(['ANO-FIM', 'ANO-INICIO', 'FLAG-PERIODO', 'MES-FIM', 'MES-INICIO']);
const ORGAN = new Set([...Object.values(ORGAN_PARTS.organ), ...Object.values(ORGAN_PARTS.unit)]);

const textOf = (el: XElement) =>
  el.children
    .map((c) => (c.kind === 'text' ? c.value : ''))
    .join('')
    .trim();

/** A atividade que a mudança traz: a própria, ou o contêiner novo com uma só. */
export function cargoItem(el: XElement): XElement | undefined {
  if (ACTIVITY_ORGAN_ELEMENTS.has(el.name)) return el;
  if (!el.name.startsWith('ATIVIDADES-')) return undefined;
  const kids = childElements(el);
  return kids.length === 1 && ACTIVITY_ORGAN_ELEMENTS.has(kids[0]!.name) ? kids[0] : undefined;
}

/** O motivo de a atividade nova ir à mão sem o órgão escolhido na lista. */
export const ORGAN_BY_HAND =
  'O Lattes exige o órgão ou unidade na inclusão da atividade: escolha na lista do Lattes, em Órgão';

/** Uma atividade nova de outra natureza como inclusão; o motivo, quando vai à mão. */
export function planCreateCargo(
  change: Change,
  chain: XElement[],
  item: XElement,
  label: string,
): Planned<CreateAtividadeOp> {
  const type = ACTIVITY_TYPES[item.name];
  if (!type) return { reason: 'Natureza de atividade que o conector não conhece' };
  const atuacao = chain.find((c) => c.name === 'ATUACAO-PROFISSIONAL');
  const seqAtiv = atuacao && getAttr(atuacao, 'SEQUENCIA-ATIVIDADE');
  if (!seqAtiv) return { reason: 'A atuação da atividade ainda não está no Lattes' };
  const own = new Set([
    ...PERIOD,
    ...ORGAN,
    'SEQUENCIA-FUNCAO-ATIVIDADE',
    'FORMATO-CARGO-OU-FUNCAO',
    ...(type.description ? [type.description] : []),
  ]);
  const extra = item.attrs.filter((a) => a.value.trim() && !own.has(a.name)).map((a) => a.name);
  if (extra.length > 0) {
    return { reason: `Campos que o formulário de atividade não tem: ${extra.join(', ')}` };
  }
  // As descrições: o atributo da natureza numa linha, ou os filhos da grade.
  const grid = GRID_CHILDREN[item.name];
  const kids = grid ? childElements(item, grid.child) : [];
  if (grid?.title) {
    const more = kids.flatMap((k) => [
      ...k.attrs.filter((a) => a.value.trim() && !LINE_OWN.has(a.name)).map((a) => a.name),
      ...childElements(k).map((c) => c.name),
    ]);
    if (more.length > 0) {
      return {
        reason: `A grade da atividade leva só o título da linha de pesquisa; o resto (${[...new Set(more)].join(', ')}) vai pela tela de linhas de pesquisa depois de criar`,
      };
    }
  }
  const lines = grid
    ? kids.map((k) => (grid.title ? (getAttr(k, grid.title) ?? '') : textOf(k)).trim())
    : [(type.description && getAttr(item, type.description)?.trim()) || ''];
  if (lines.filter(Boolean).length === 0) {
    return { reason: 'O Lattes exige ao menos uma descrição da atividade' };
  }
  if (lines.some((l) => /[@?!]/.test(l))) {
    return { reason: 'Descrição com @, ? ou !, que a grade do Lattes usa como separador' };
  }
  const start = getAttr(item, 'ANO-INICIO') ?? '';
  const end = getAttr(item, 'ANO-FIM') ?? '';
  if (!start) return { reason: 'A atividade precisa do ano de início' };
  const organCode = getAttr(item, ORGAN_PARTS.organ.code)?.trim() ?? '';
  const unitCode = getAttr(item, ORGAN_PARTS.unit.code)?.trim() ?? '';
  if (!organCode) {
    return getAttr(item, ORGAN_PARTS.organ.name)?.trim()
      ? { reason: 'Órgão e unidade: escolha pela lista do Lattes, que grava o código junto' }
      : { reason: ORGAN_BY_HAND };
  }
  return {
    codInst: (atuacao && getAttr(atuacao, 'CODIGO-INSTITUICAO')) || undefined,
    expect: {},
    key: change.key,
    kind: 'criar-atividade',
    label,
    natur: type.natur,
    organ:
      unitCode && unitCode !== organCode
        ? { code: unitCode, parent: organCode }
        : { code: organCode },
    seqAtiv,
    set: {
      f_ano_fim: end,
      f_ano_ini: start,
      f_espec_l: specGrid(lines.filter(Boolean)),
      f_mes_fim: getAttr(item, 'MES-FIM') ?? '',
      f_mes_ini: getAttr(item, 'MES-INICIO') ?? '',
      f_status: end ? 'N' : 'S',
    },
  };
}
