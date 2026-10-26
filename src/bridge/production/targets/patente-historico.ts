// O histórico de situações da patente (HISTORICO-SITUACOES-PATENTE). Observado
// em 20/10/2026, na exportação e na página de edição de uma patente de teste:
// cada linha do histórico é uma linha da grade de situações
// (providerContatos), com DESCRICAO-SITUACAO-PATENTE como o rótulo e
// DATA-SITUACAO-PATENTE como a data; STATUS-SITUACAO-PATENTE veio "SIM", e o
// sentido dele não foi visto. A exportação guarda a mesma data também no
// REGISTRO-OU-PATENTE (DATA-PEDIDO-DE-DEPOSITO 12032007 e a situação
// "Depósito" 12032007): no Lattes as duas são um campo só, datas:N
// (registros-paginas.ts). O editor troca as duas juntas
// (src/model/linked-attrs.ts); as duas mudanças vão ao mesmo campo (a segunda
// acha o Lattes já com ele, apply.ts), e datas que ainda discordam ficam à mão.
// Sem a linha do histórico, a data do registro vai sozinha.

import type { Change } from '../../../model/changes.ts';
import { PATENT_DATE_CODES, patentDateAttrOf } from '../../../model/patent-dates.ts';
import { childElements, getAttr, type XElement } from '../../../model/xml.ts';
import type { FieldMap } from '../types.ts';
import { slashDate } from './comum-tecnica-artistica.ts';
import { dateKey } from './registros-paginas.ts';

export const HISTORY = 'HISTORICO-SITUACOES-PATENTE';
const HISTORY_DATE = 'DATA-SITUACAO-PATENTE';
const DESCRIPTION = 'DESCRICAO-SITUACAO-PATENTE';
const REG = 'REGISTRO-OU-PATENTE';
const STATUS = 'STATUS-SITUACAO-PATENTE';

/** O código da data da patente (PATENT_DATE_CODES) pela descrição da situação. */
const dateCodeOf = (description: string): string | undefined => {
  const attr = patentDateAttrOf(description);
  return attr ? PATENT_DATE_CODES[attr]?.[0] : undefined;
};

/** As partes do detalhamento da patente com esse nome (o registro, as situações). */
const detailParts = (item: XElement, name: string): XElement[] =>
  childElements(item).flatMap((c) => childElements(c, name));

const sameDate = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim() === (b ?? '').trim();

const conflict = (what: string, label: string) =>
  `${what}: a data do registro e a da situação "${label}" do histórico são o mesmo campo no Lattes; deixe as duas iguais no editor`;

/**
 * Uma linha do histórico: só a data de uma linha que já existe, com uma das
 * descrições que o conector conhece, vai, pelo mesmo campo virtual das datas
 * do REGISTRO-OU-PATENTE, e só quando a data do registro é a mesma.
 */
export function historyFields(
  change: Change,
  el: XElement,
  item: XElement,
): { fields: Record<string, FieldMap> } | { reason: string } {
  if (change.kind !== 'alterado') {
    return {
      reason:
        'Incluir ou tirar uma situação do histórico da patente vai à mão: o conector só troca a data de uma situação que já está no Lattes',
    };
  }
  const status = change.fields.filter((f) => f.attr === STATUS);
  if (status.length > 0) {
    return {
      reason: `O formulário de patente do Lattes não tem: ${status[0]!.label} (a grade de situações guarda só a situação e a data)`,
    };
  }
  const swap = change.fields.find((f) => f.attr === DESCRIPTION);
  if (swap) return situationSwap(change, el, item, swap.before);
  const description = getAttr(el, DESCRIPTION) ?? '';
  const code = dateCodeOf(description);
  if (!code) {
    const known = Object.values(PATENT_DATE_CODES)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, label]) => label)
      .join(', ');
    return {
      reason: `A data da situação "${description}" vai à mão: o conector só troca as de ${known}`,
    };
  }
  const attr = patentDateAttrOf(description)!;
  const date = getAttr(el, HISTORY_DATE);
  if (detailParts(item, REG).some((reg) => !sameDate(getAttr(reg, attr), date))) {
    return { reason: conflict(change.fields[0]!.label, description) };
  }
  return { fields: { [HISTORY_DATE]: { field: dateKey(code), toForm: slashDate } } };
}

/**
 * A situação trocada por outra (Depósito → Concessão). Na grade de datas do
 * Lattes a linha é identificada pelo código da situação, então a troca tira a
 * linha de antes e põe a nova com a data (PATENT_DATES.build). Só entre as
 * situações com atributo no registro, e com o registro já acompanhando a troca
 * (linked-attrs.ts). Inferido: que o Lattes aceite a troca assim, como a
 * página faria ao escolher outra situação na mesma linha.
 */
function situationSwap(
  change: Change,
  el: XElement,
  item: XElement,
  previous: string,
):
  | {
      also: { after: string; before: string; field: string; label: string }[];
      fields: Record<string, FieldMap>;
    }
  | { reason: string } {
  const description = getAttr(el, DESCRIPTION) ?? '';
  const from = dateCodeOf(previous);
  const to = dateCodeOf(description);
  if (!from || !to) {
    const known = Object.values(PATENT_DATE_CODES)
      .map(([, label]) => label)
      .join(', ');
    return {
      reason: `Situação da patente: o conector só troca entre ${known}, que têm data no registro; troque no Lattes`,
    };
  }
  if (from === to) {
    return {
      reason: `Situação da patente: "${description}" e "${previous}" são a mesma situação no Lattes, que grava o rótulo dela`,
    };
  }
  const siblings = detailParts(item, HISTORY).filter((h) => h !== el);
  if (siblings.some((h) => dateCodeOf(getAttr(h, DESCRIPTION) ?? '') === to)) {
    return {
      reason: `Situação da patente: "${description}" já está em outra linha do histórico, e o Lattes guarda uma linha por situação`,
    };
  }
  const date = getAttr(el, HISTORY_DATE) ?? '';
  const oldDate = change.fields.find((f) => f.attr === HISTORY_DATE)?.before ?? date;
  const fromAttr = patentDateAttrOf(previous)!;
  const toAttr = patentDateAttrOf(description)!;
  const registryFollows = detailParts(item, REG).every(
    (reg) => !getAttr(reg, fromAttr) && sameDate(getAttr(reg, toAttr), date),
  );
  if (!registryFollows) return { reason: conflict('Situação da patente', description) };
  const shown = (v: string) => slashDate(v) ?? v;
  const dateChanged = change.fields.some((f) => f.attr === HISTORY_DATE);
  return {
    // A data na linha nova; sem a data na mudança, ela vai à parte.
    also: dateChanged
      ? []
      : [{ after: shown(date), before: '', field: dateKey(to), label: description }],
    fields: {
      // A descrição tira a linha de antes, com a data que ela tinha.
      [DESCRIPTION]: {
        field: dateKey(from),
        toForm: (_v, side) => (side === 'after' ? '' : shown(oldDate)),
      },
      ...(dateChanged
        ? {
            [HISTORY_DATE]: {
              field: dateKey(to),
              toForm: (_v: string, side?: 'after' | 'before') =>
                side === 'after' ? shown(date) : '',
            },
          }
        : {}),
    },
  };
}

/**
 * Uma data do REGISTRO-OU-PATENTE: vai pelos campos de sempre (fields), mas
 * só quando as situações do histórico com a mesma data estão iguais a ela.
 */
export function registryDateFields(
  change: Change,
  el: XElement,
  item: XElement,
): { fields: Record<string, FieldMap> } | { reason: string } {
  const history = detailParts(item, HISTORY);
  for (const f of change.fields) {
    const code = PATENT_DATE_CODES[f.attr]?.[0];
    if (!code) continue;
    const row = history.find(
      (h) =>
        dateCodeOf(getAttr(h, DESCRIPTION) ?? '') === code &&
        !sameDate(getAttr(h, HISTORY_DATE), getAttr(el, f.attr)),
    );
    if (row) return { reason: conflict(f.label, getAttr(row, DESCRIPTION) ?? '') };
  }
  return { fields: {} };
}
