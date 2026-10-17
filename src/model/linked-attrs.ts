// Atributos que mudam junto com outro, no mesmo elemento. Tirar a bolsa de uma
// formação tira a agência: o Lattes não aceita agência sem bolsa, e o envio
// ficava à mão pedindo para a pessoa apagar o nome da agência também.

import { getAttr, setAttr, type XElement } from './xml.ts';

/** A formação guarda a agência em NOME-AGENCIA (a orientação usa outro nome e outro formulário). */
const FORMATION_AGENCY = ['CODIGO-AGENCIA-FINANCIADORA', 'NOME-AGENCIA'];

/** Depois de gravar `name` em `el`, ajusta o que segue dele; devolve os atributos alterados. */
export function applyLinkedAttrs(el: XElement, name: string): string[] {
  if (name !== 'FLAG-BOLSA' || getAttr(el, name) === 'SIM') return [];
  if (getAttr(el, 'NOME-AGENCIA') === undefined) return [];
  return FORMATION_AGENCY.filter((attr) => {
    if (!getAttr(el, attr)) return false;
    setAttr(el, attr, '');
    return true;
  });
}
