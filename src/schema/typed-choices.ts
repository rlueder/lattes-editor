// Campos tipados (LAT-48): as listas que o próprio Lattes oferece, no lugar de
// texto livre. Cada lista entra aqui só com o formato do XML conferido numa
// exportação real; o que ainda é inferido fica marcado. Ver
// docs/campos_tipados.md.

import { getAttr, type XElement } from '../model/xml.ts';
import listas from './listas-lattes.json' with { type: 'json' };

export interface Choice {
  label: string;
  value: string;
}

const asChoices = (values: readonly string[]): Choice[] =>
  values.map((value) => ({ label: value, value }));

/**
 * País e idioma pelo nome, como o XML guarda (exportação real de 13/10/2026:
 * PAIS="Brasil" em produções, eventos, endereço e nascimento; IDIOMA="Inglês"
 * nas produções). O idioma da seção Idiomas é código (EN) e fica de fora.
 */
const COUNTRY_ATTRS = new Set(['PAIS', 'PAIS-DE-NASCIMENTO', 'PAIS-DE-PUBLICACAO', 'PAIS-DO-EVENTO']);
const LANGUAGE_ATTRS = new Set(['IDIOMA', 'IDIOMA-DA-OBRA-ORIGINAL']);
const COUNTRIES = asChoices(listas.paises);
const LANGUAGES = asChoices(listas.idiomas);

/**
 * Participação em eventos: o formulário do Lattes (PKG_EVENTO.form, lido em
 * 13/10/2026) tem uma natureza por tipo de evento, e o XML separa um elemento
 * por natureza. A natureza segue o elemento: "Congresso" e "Encontro"
 * conferidos na exportação real; o texto das outras é o do combo do Lattes.
 */
const EVENT_NATURE: Record<string, string> = {
  CONGRESSO: 'Congresso',
  ENCONTRO: 'Encontro',
  EXPOSICAO: 'Exposição',
  FEIRA: 'Feira',
  OFICINA: 'Oficina',
  OLIMPIADA: 'Olimpíada',
  SEMINARIO: 'Seminário',
  SIMPOSIO: 'Simpósio',
};

/** "Ouvinte" conferido na exportação real; "Convidado" e "Participante" são o texto do rádio. */
const PARTICIPATION_FORMS = ['Convidado', 'Participante', 'Ouvinte'] as const;

/** O tipo depende da forma (F_TPO no formulário do Lattes); ouvinte não tem tipo. */
const PARTICIPATION_TYPES: Record<string, readonly string[]> = {
  Convidado: ['Conferencista', 'Simposista', 'Moderador', 'Avaliador', 'Homenageado'],
  Ouvinte: [],
  Participante: ['Poster / Painel', 'Apresentação oral', 'Outras formas'],
};

const EVENT_BASICS =
  /^DADOS-BASICOS-(?:DA-PARTICIPACAO-EM-([A-Z]+)|DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS)$/;

/** Dados básicos de uma participação em evento (congresso, encontro, outras...). */
export function isEventBasics(element: string): boolean {
  return EVENT_BASICS.test(element);
}

/**
 * Título só para quem apresentou: o formulário do Lattes pede "Título da
 * apresentação (apenas para convidado e participante)". Ouvinte, ou forma
 * ainda não escolhida, não precisa.
 */
export function titleRequired(basics: XElement): boolean {
  if (!isEventBasics(basics.name)) return true;
  const form = getAttr(basics, 'FORMA-PARTICIPACAO') ?? '';
  return form === 'Convidado' || form === 'Participante';
}

/**
 * Valor que segue de outra escolha e não se digita: a natureza da
 * participação em evento sai do tipo de evento (o elemento). Nas "outras
 * participações", é "Outra", a última opção do combo.
 */
export function derivedValue(element: string, attr: string): string | undefined {
  if (attr !== 'NATUREZA') return undefined;
  const m = EVENT_BASICS.exec(element);
  if (!m) return undefined;
  return m[1] ? EVENT_NATURE[m[1]] : 'Outra';
}

/**
 * A lista de um campo tipado, ou undefined para campo livre. `el` é o
 * elemento do campo: o tipo de participação depende da forma escolhida nele.
 */
export function typedChoices(el: XElement, attr: string): Choice[] | undefined {
  if (COUNTRY_ATTRS.has(attr)) return COUNTRIES;
  if (LANGUAGE_ATTRS.has(attr) && el.name !== 'IDIOMA') return LANGUAGES;
  if (!isEventBasics(el.name)) return undefined;
  if (attr === 'FORMA-PARTICIPACAO') return asChoices(PARTICIPATION_FORMS);
  if (attr === 'TIPO-PARTICIPACAO') {
    return asChoices(PARTICIPATION_TYPES[getAttr(el, 'FORMA-PARTICIPACAO') ?? ''] ?? []);
  }
  return undefined;
}

/** O que dizer quando um campo tipado não tem opção (tipo de participação de ouvinte). */
export function emptyChoicesHint(el: XElement, attr: string): string | undefined {
  if (attr !== 'TIPO-PARTICIPACAO' || !isEventBasics(el.name)) return undefined;
  return getAttr(el, 'FORMA-PARTICIPACAO') ? 'Não se aplica a ouvinte' : 'Escolha a forma primeiro';
}

/** Valor preenchido que não está na lista do Lattes (vazio e derivados não contam). */
export function outOfList(el: XElement, attr: string): boolean {
  const value = getAttr(el, attr) ?? '';
  if (!value) return false;
  const derived = derivedValue(el.name, attr);
  if (derived !== undefined) return value !== derived;
  const choices = typedChoices(el, attr);
  return choices !== undefined && !choices.some((c) => c.value === value);
}
