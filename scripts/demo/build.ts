// Peças comuns do currículo de demonstração (scripts/gen-demo.ts): o elemento
// com todos os atributos do schema, a contagem de SEQUENCIA-PRODUCAO e as
// pessoas fictícias.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { element, type XElement } from '../../src/model/xml.ts';
import schemaJson from '../../src/schema/lattes.json' with { type: 'json' };
import type { LattesSchema } from '../../src/schema/types.ts';

export const schema = schemaJson as LattesSchema;

type Values = Record<string, string>;

/**
 * Um elemento com todos os atributos do schema, na ordem dele, e os valores
 * dados. Atributo desconhecido ou valor fora do enumerado interrompe a geração.
 */
export function el(name: string, values: Values = {}, children: XElement[] = []): XElement {
  const spec = schema.elements[name];
  if (!spec) throw new Error(`Elemento desconhecido: ${name}`);
  for (const [key, value] of Object.entries(values)) {
    const attr = spec.attributes.find((a) => a.name === key);
    if (!attr) throw new Error(`${name}: atributo desconhecido ${key}`);
    if (attr.enum && value && !attr.enum.includes(value)) {
      throw new Error(`${name}.${key}: "${value}" fora de ${attr.enum.join('|')}`);
    }
  }
  const attrs = spec.attributes
    .filter((a) => !a.name.startsWith('CPF'))
    .map((a) => ({
      name: a.name,
      value:
        values[a.name] ??
        a.default ??
        (a.name.startsWith('FLAG-') && a.enum?.includes('NAO') ? 'NAO' : ''),
    }));
  const out = element(name, attrs);
  for (const child of children) insertInSchemaOrder(schema, out, child);
  return out;
}

let seq = 0;
/** SEQUENCIA-PRODUCAO: um contador para todas as produções do currículo. */
export const nextSeq = () => String(++seq);

export const ANA = { cite: 'LIMA, A. B. S.', name: 'Ana Beatriz Souza Lima' };
export const COAUTHORS: Record<string, { cite: string; name: string }> = {
  ferreira: { cite: 'FERREIRA, L. M.', name: 'Luísa Martins Ferreira' },
  mendes: { cite: 'MENDES, P. R.', name: 'Paulo Roberto Mendes' },
  nascimento: { cite: 'NASCIMENTO, J. P.', name: 'João Pedro Nascimento' },
  oliveira: { cite: 'OLIVEIRA, T. S.', name: 'Tiago Silveira Oliveira' },
  rocha: { cite: 'ROCHA, G. A.', name: 'Gabriela Alves Rocha' },
  vieira: { cite: 'VIEIRA, H. C.', name: 'Helena Castro Vieira' },
};

export function authors(keys: string[]): XElement[] {
  return keys.map((key, i) => {
    const person = key === 'ana' ? ANA : COAUTHORS[key]!;
    return el('AUTORES', {
      'NOME-COMPLETO-DO-AUTOR': person.name,
      'NOME-PARA-CITACAO': person.cite,
      'ORDEM-DE-AUTORIA': String(i + 1),
    });
  });
}

export const keywords = (words: string[]) =>
  el('PALAVRAS-CHAVE', Object.fromEntries(words.map((w, i) => [`PALAVRA-CHAVE-${i + 1}`, w])));
