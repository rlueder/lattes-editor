// O caminho de volta das especificações do conector (src/bridge/production/):
// o valor de um campo do formulário do Lattes de volta para o atributo do XML.
// O conector grava pelo `toForm` de cada campo (XML → formulário); aqui, o
// valor do formulário volta para o XML pelo candidato cujo `toForm` dá o mesmo
// valor. É a mesma regra que o Lattes simulado usa para gravar um POST
// (scripts/lattes-simulado/producao.ts) e que "Atualizar do Lattes" usa para
// ler um item pelo formulário (refresh/merge.ts).
//
// Inferido: que o Lattes guarde o valor de cada campo como o formulário o
// mostra. Os pares campo e atributo são os das especificações, com a origem
// (observada ou inferida) anotada em cada alvo.

import type { Change } from '../../model/changes.ts';
import { insertInSchemaOrder } from '../../model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../model/xml.ts';
import { availabilityToForm } from '../../schema/availability.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { LICENSE_TYPES, licenseToForm } from '../../schema/license-types.ts';
import { countryName } from '../edit-items.ts';
import idiomas from '../production/idiomas-lattes.json' with { type: 'json' };
import { country, date, language } from '../production/mappers.ts';
import type { FieldMap, ProductionTarget } from '../production/types.ts';

export const mapOf = (m: FieldMap | string): FieldMap => (typeof m === 'string' ? { field: m } : m);

/**
 * A parte do item (DADOS-BASICOS-…), ou o próprio item quando o atributo é
 * dele. A parte pode estar mais funda (o REGISTRO-OU-PATENTE fica dentro do
 * detalhamento): procura por nível, os filhos antes dos netos.
 */
export function partOf(item: XElement, child: string): XElement | undefined {
  if (child === item.name) return item;
  let level = childElements(item);
  while (level.length > 0) {
    const hit = level.find((c) => c.name === child);
    if (hit) return hit;
    level = level.flatMap((c) => childElements(c));
  }
  return undefined;
}

/** A parte do item, criada onde o schema a põe (com os contêineres do caminho) quando falta. */
export function ensurePart(item: XElement, child: string): XElement {
  const found = partOf(item, child);
  if (found) return found;
  const path = schemaPathWithin(item.name, child) ?? [];
  let parent = item;
  for (const name of path) {
    let next = childElements(parent, name)[0];
    if (!next) {
      next = element(name, {});
      insertInSchemaOrder(lattesSchema, parent, next);
    }
    parent = next;
  }
  const part = element(child, {});
  insertInSchemaOrder(lattesSchema, parent, part);
  return part;
}

/** Os contêineres entre um elemento e um descendente dele, pelo schema (o caminho mais curto). */
export function schemaPathWithin(from: string, to: string): string[] | undefined {
  let frontier: string[][] = [[]];
  const seen = new Set([from]);
  while (frontier.length > 0) {
    const next: string[][] = [];
    for (const path of frontier) {
      const parent = path.at(-1) ?? from;
      for (const c of lattesSchema.elements[parent]?.children ?? []) {
        if (c.name === to) return path;
        if (seen.has(c.name)) continue;
        seen.add(c.name);
        next.push([...path, c.name]);
      }
    }
    frontier = next;
  }
  return undefined;
}

/** Quebras de linha iguais nos dois lados: o formulário manda CRLF. */
const sameText = (a: string, b: string) =>
  a.replace(/\r\n?/g, '\n').trim() === b.replace(/\r\n?/g, '\n').trim();

/**
 * O valor do formulário de volta para o XML: o candidato cujo toForm dá o
 * mesmo valor. `labels`: os valores de texto livre que o tipo conhece (a
 * NATUREZA da qualificação, que o XSD não enumera). undefined: nenhum
 * candidato dá esse valor, e o atributo fica como está.
 */
export function fromForm(
  element: string,
  attr: string,
  map: FieldMap,
  value: string,
  labels: readonly string[] = [],
): string | undefined {
  if (!map.toForm) return value;
  if (map.toForm === availabilityToForm) {
    return value === '' ? 'NAO_INFORMADO' : value.toUpperCase();
  }
  if (value === '') return '';
  if (map.toForm === country) return countryName(value);
  // O tipo da licença: o XSD só enumera MATERNIDADE; os outros dois valores
  // são os inferidos que o envio usa (license-types.ts).
  if (map.toForm === licenseToForm) {
    return Object.entries(LICENSE_TYPES).find(([, code]) => code === value)?.[0];
  }
  if (map.toForm === date) return value.replace(/\//g, '');
  if (map.toForm === language) {
    return Object.entries(idiomas as Record<string, string>).find(([, c]) => c === value)?.[0];
  }
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  // Por último, o próprio valor (lista cujo valor é o rótulo) e a data sem as
  // barras (dd/mm/aaaa do formulário, DDMMAAAA do XML).
  const candidates = [
    ...(spec?.enum ?? []),
    ...labels,
    'SIM',
    'NAO',
    value.replace(/\//g, ''),
    value,
  ];
  // O toForm que só dá o Sim do lado de antes (o potencial de inovação, que
  // pede o texto) também volta pelo que o formulário mostra.
  return (
    candidates.find((c) => map.toForm!(c) === value) ??
    candidates.find((c) => map.toForm!(c, 'before') === value)
  );
}

/**
 * Os campos dos ganchos de parte (partFields: o tipo do mestrado, a natureza
 * do livro), com o valor do item como está: chave "FILHO@ATRIBUTO" e os campos
 * a mais (also) com o valor de agora. Campos virtuais (datas:1) ficam de fora.
 */
export function partMaps(t: ProductionTarget, item: XElement) {
  const fields: [string, FieldMap][] = [];
  const also: [string, string][] = [];
  for (const [child, hook] of Object.entries(t.partFields ?? {})) {
    const part = partOf(item, child);
    if (!part) continue;
    const change: Change = {
      element: child,
      fields: part.attrs.map((a) => ({
        after: a.value,
        attr: a.name,
        before: a.value,
        label: a.name,
      })),
      form: '',
      key: '',
      kind: 'alterado',
      path: [],
    };
    const result = hook(change, part, item);
    if ('reason' in result) continue;
    for (const [attr, m] of Object.entries(result.fields)) {
      if (!mapOf(m).field.includes(':')) fields.push([`${child}@${attr}`, mapOf(m)]);
    }
    for (const a of result.also ?? []) also.push([a.field, a.after]);
  }
  return { also, fields };
}

/** O valor de um campo como o formulário o tem; null ou undefined quando o campo não veio. */
export type FieldValue = (field: string) => string | null | undefined;

export interface WriteOptions {
  /**
   * A leitura de "Atualizar do Lattes": o valor que o formulário mostra igual
   * ao do XML (pelo toForm) deixa o atributo como está, sem trocar a grafia;
   * e um campo vazio não cria atributo nem parte que o item não tem.
   */
  keepEquivalent?: boolean;
}

/**
 * Os campos da especificação, do formulário para o XML; o que não veio fica
 * como está. Sem keepEquivalent, cada campo que veio é gravado como chegou,
 * como o servidor simulado faz com um POST.
 */
export function writeFields(
  t: ProductionTarget,
  item: XElement,
  get: FieldValue,
  options: WriteOptions = {},
): void {
  const write = ([key, m]: [string, FieldMap | string]) => {
    const [child, attr] = key.split('@') as [string, string];
    const map = mapOf(m);
    const value = get(map.field);
    if (value === null || value === undefined) return;
    let part = partOf(item, child);
    const current = part ? getAttr(part, attr) : undefined;
    if (options.keepEquivalent) {
      if (current !== undefined) {
        const shown = map.toForm ? map.toForm(current, 'before') : current;
        if (shown !== undefined && sameText(shown, value)) return;
      } else if (value === '') return;
    }
    const labels = attr === 'NATUREZA' ? Object.keys(t.lookups?.course?.natures ?? {}) : [];
    const saved = fromForm(child, attr, map, value, labels);
    if (saved === undefined) return;
    if (options.keepEquivalent && current !== undefined && sameText(current, saved)) return;
    part ??= ensurePart(item, child);
    setAttr(part, attr, saved);
  };
  Object.entries(t.fields).forEach(write);
  // Os dos ganchos depois: o código da natureza do livro depende do tipo já gravado.
  partMaps(t, item).fields.forEach(write);
}
