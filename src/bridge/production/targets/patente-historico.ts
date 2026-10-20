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
import { childElements, getAttr, type XElement } from '../../../model/xml.ts';
import { PATENT_DATE_CODES, patentDateAttrOf } from '../../create-registro-rules.ts';
import type { FieldMap } from '../types.ts';
import { slashDate } from './comum-tecnica-artistica.ts';
import { dateKey } from './registros-paginas.ts';

export const HISTORY = 'HISTORICO-SITUACOES-PATENTE';
const HISTORY_DATE = 'DATA-SITUACAO-PATENTE';
const DESCRIPTION = 'DESCRICAO-SITUACAO-PATENTE';
const REG = 'REGISTRO-OU-PATENTE';

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
  const others = change.fields.filter((f) => f.attr !== HISTORY_DATE);
  if (others.length > 0) {
    return {
      reason: `${others.map((f) => f.label).join(', ')}: a descrição e o status de uma situação da patente vão à mão (o status veio SIM na exportação, e o sentido dele não foi visto); troque no Lattes`,
    };
  }
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
