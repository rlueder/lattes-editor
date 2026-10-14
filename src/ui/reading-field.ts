// Que controle um pedaço do texto vira na edição do modo de leitura. Segue
// as mesmas regras do AttributeField (código do Lattes, lista, data, ano),
// mas para um campo sem borda, no lugar do texto.

import { enumLabel } from '../labels/labels.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { matchesDerived, typedChoices } from '../schema/typed-choices.ts';
import { codeAttrFor, codeChoices, isBooleanAttr, isSystemAttr } from './field-kind.ts';
import { isLattesDateAttr, isValidLattesDate } from './lattes-date.ts';
import { isFourDigitYear, isLattesYearAttr } from './lattes-year.ts';
import { type LiveAvailability, liveKind } from './live-lists.ts';
import type { PartFormat } from './reading-layout.ts';
import { PROSE_MIN } from './reading-layout.ts';

export type InlineKind = 'date' | 'live' | 'locked' | 'long' | 'select' | 'text' | 'year';

/** Atributos de texto longo mesmo quando curtos (resumo, outras informações). */
const LONG_ATTRS = /^(TEXTO-|OUTRAS-INFORMACOES|DESCRICAO-|INFORMACAO-ADICIONAL)/;

export function inlineKind(el: XElement, attr: string, live: LiveAvailability): InlineKind {
  const value = getAttr(el, attr) ?? '';
  const spec = lattesSchema.elements[el.name]?.attributes.find((a) => a.name === attr);
  // Contatos serializados pelo Lattes num texto só: lidos aqui, editados lá.
  if (el.name === 'ENDERECO' && (attr === 'ELETRONICO' || attr === 'REDE-SOCIAL') && value) {
    return 'locked';
  }
  const lk = liveKind(el, attr, live);
  if (lk === 'area-derivada') return 'locked';
  if (lk) return 'live';
  const code = codeAttrFor(el.name, attr);
  if (code && getAttr(el, code)) return 'locked';
  if (matchesDerived(el, attr) || isSystemAttr(el.name, attr)) return 'locked';
  if (isBooleanAttr(attr, spec, value)) return 'select';
  if (codeChoices(el.name, attr) || typedChoices(el, attr) || spec?.enum) return 'select';
  const siblings = el.attrs.map((a) => a.name);
  if (isLattesDateAttr(el.name, attr, siblings) && (value === '' || isValidLattesDate(value))) {
    return 'date';
  }
  if (isLattesYearAttr(el.name, attr) && (value === '' || isFourDigitYear(value))) return 'year';
  return LONG_ATTRS.test(attr) || value.length > PROSE_MIN ? 'long' : 'text';
}

export interface Option {
  label: string;
  value: string;
}

/**
 * Opções de um campo de lista: sim/não, códigos conhecidos, listas tipadas
 * ou o enum do XSD. O valor salvo fora da lista continua como opção, para
 * não sumir ao abrir a edição.
 */
export function selectOptions(el: XElement, attr: string, format?: PartFormat): Option[] {
  const value = getAttr(el, attr) ?? '';
  const spec = lattesSchema.elements[el.name]?.attributes.find((a) => a.name === attr);
  const label = (v: string) =>
    format === 'level' ? enumLabel(v).toLocaleLowerCase('pt-BR') : enumLabel(v);
  let options: Option[];
  if (isBooleanAttr(attr, spec, value)) {
    options = [
      { label: 'Sim', value: 'SIM' },
      { label: 'Não', value: 'NAO' },
    ];
  } else {
    options =
      codeChoices(el.name, attr) ??
      typedChoices(el, attr) ??
      (spec?.enum ?? []).map((v) => ({ label: label(v), value: v }));
  }
  const known = value === '' || options.some((o) => o.value === value);
  return [{ label: '(vazio)', value: '' }, ...(known ? [] : [{ label: value, value }]), ...options];
}
