// As tabelas atributo → [campo, conversor] do conector (dados-gerais-edit.ts,
// formacao-edit.ts, edit-items.ts…) ao contrário: o valor que o formulário
// mostra de volta para o atributo do XML. O conversor só vai do XML para o
// formulário; aqui o valor do XML é o candidato que ele leva ao mesmo valor
// do formulário. Os candidatos: o próprio valor, as opções do enumerado do
// XSD, SIM e NAO (os FLAG-* sem enumerado), a data sem barras (dd/mm/aaaa → DDMMAAAA), o país pelo código e os
// rótulos que quem chama souber (a cor ou raça, que o XSD não enumera).

import { setAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { isScreenAttr } from '../../schema/screen-fields.ts';
import { countryName } from '../edit-items.ts';

export type ToForm = (xml: string) => string | null | undefined;

/** O valor do XML que o conversor leva a `shown`; undefined quando nenhum candidato leva. */
export function fromShown(
  element: string,
  attr: string,
  toForm: ToForm,
  shown: string,
  labels: readonly string[] = [],
): string | undefined {
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  const candidates = [
    shown,
    ...(spec?.enum ?? []),
    ...labels,
    'SIM',
    'NAO',
    shown.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$1$2$3'),
    countryName(shown) ?? '',
    '',
  ];
  // Nada marcado (rádio sem escolha, conversor que dá null para o vazio): vazio.
  return candidates.find((c) => toForm(c) === shown) ?? (shown === '' ? '' : undefined);
}

export type FieldTable = Record<string, readonly [string, ToForm]>;

/**
 * Os atributos de `el` pela tabela, com o campo + sufixo. Campo que a página
 * não trouxe fica de fora; valor sem candidato também, e volta em `unread`.
 */
export function readTable(
  el: XElement,
  table: FieldTable,
  values: Record<string, string>,
  options: { labels?: Record<string, readonly string[]>; suffix?: string } = {},
): string[] {
  const unread: string[] = [];
  // Só os atributos do elemento: a tabela pode servir a vários (a formação).
  // Os campos só de tela (tela:*) não estão no XSD; quem chama passa os do elemento.
  const own = new Set(lattesSchema.elements[el.name]?.attributes.map((a) => a.name));
  for (const [attr, [field, toForm]] of Object.entries(table)) {
    if (!own.has(attr) && !isScreenAttr(attr)) continue;
    const shown = values[`${field}${options.suffix ?? ''}`];
    if (shown === undefined) continue;
    const xml = fromShown(el.name, attr, toForm, shown, options.labels?.[attr]);
    if (xml === undefined) unread.push(attr);
    else setAttr(el, attr, xml);
  }
  return unread;
}
