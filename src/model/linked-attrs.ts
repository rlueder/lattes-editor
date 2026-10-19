// Atributos que mudam junto com outro, no mesmo elemento. Tirar a bolsa de uma
// formação tira a agência: o Lattes não aceita agência sem bolsa, e o envio
// ficava à mão pedindo para a pessoa apagar o nome da agência também. O país
// de nacionalidade leva a sigla e a nacionalidade: na página de identificação
// do Lattes a nacionalidade segue o país (B para o Brasil, E para os outros),
// e trocar só ela ia à mão.

import listas from '../schema/listas-lattes.json' with { type: 'json' };
import { getAttr, setAttr, type XElement } from './xml.ts';

/** A formação guarda a agência em NOME-AGENCIA (a orientação usa outro nome e outro formulário). */
const FORMATION_AGENCY = ['CODIGO-AGENCIA-FINANCIADORA', 'NOME-AGENCIA'];

const COUNTRY_CODES: Readonly<Record<string, string>> = listas.codigosDosPaises;

/** Os países que o Lattes tem para a nacionalidade, em ordem alfabética. */
export const NATIONALITY_COUNTRIES: readonly string[] = Object.keys(COUNTRY_CODES).sort((a, b) =>
  a.localeCompare(b, 'pt-BR'),
);

/** Atributo cujo código o editor escreve junto, e por isso não fica travado pelo código. */
export function writesOwnCode(element: string, attr: string): boolean {
  return element === 'DADOS-GERAIS' && attr === 'PAIS-DE-NACIONALIDADE';
}

/** A nacionalidade não se escolhe: segue o país de nacionalidade. */
export function followsCountry(element: string, attr: string): boolean {
  return element === 'DADOS-GERAIS' && attr === 'NACIONALIDADE';
}

function set(el: XElement, values: Record<string, string>): string[] {
  return Object.entries(values).flatMap(([attr, value]) => {
    if (getAttr(el, attr) === value) return [];
    setAttr(el, attr, value);
    return [attr];
  });
}

/** Depois de gravar `name` em `el`, ajusta o que segue dele; devolve os atributos alterados. */
export function applyLinkedAttrs(el: XElement, name: string): string[] {
  if (writesOwnCode(el.name, name)) {
    const code = COUNTRY_CODES[getAttr(el, name) ?? ''];
    if (!code) return [];
    return set(el, { NACIONALIDADE: code === 'BRA' ? 'B' : 'E', 'SIGLA-PAIS-NACIONALIDADE': code });
  }
  if (name !== 'FLAG-BOLSA' || getAttr(el, name) === 'SIM') return [];
  if (getAttr(el, 'NOME-AGENCIA') === undefined) return [];
  return FORMATION_AGENCY.filter((attr) => {
    if (!getAttr(el, attr)) return false;
    setAttr(el, attr, '');
    return true;
  });
}
