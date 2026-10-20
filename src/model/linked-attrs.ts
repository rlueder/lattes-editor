// Atributos que mudam junto com outro, no mesmo elemento. Tirar a bolsa de uma
// formação tira a agência: o Lattes não aceita agência sem bolsa, e o envio
// ficava à mão pedindo para a pessoa apagar o nome da agência também. O país
// de nacionalidade leva a sigla e a nacionalidade: na página de identificação
// do Lattes a nacionalidade segue o país (B para o Brasil, E para os outros),
// e trocar só ela ia à mão.
//
// As datas da patente ficam em dois lugares da exportação (observado em
// 20/10/2026): no REGISTRO-OU-PATENTE (DATA-PEDIDO-DE-DEPOSITO e as outras) e
// na linha do HISTORICO-SITUACOES-PATENTE com a descrição daquela data
// ("Depósito"). No Lattes as duas são um campo só, então trocar uma troca a
// outra. Uma linha do histórico que não existe não se cria aqui: sem ela, só
// o registro muda.

import listas from '../schema/listas-lattes.json' with { type: 'json' };
import { PATENT_DATE_CODES, patentDateAttrOf } from './patent-dates.ts';
import { childElements, getAttr, setAttr, type XElement } from './xml.ts';

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

const HISTORY = 'HISTORICO-SITUACOES-PATENTE';
const HISTORY_DATE = 'DATA-SITUACAO-PATENTE';

/** O elemento que tem `el` como filho, procurado a partir de `root`. */
function parentOf(root: XElement, el: XElement): XElement | undefined {
  for (const c of childElements(root)) {
    if (c === el) return root;
    const found = parentOf(c, el);
    if (found) return found;
  }
  return undefined;
}

/**
 * A outra metade de uma data da patente, no mesmo detalhamento: as linhas do
 * histórico com a descrição da data do registro, ou o registro da data da
 * linha do histórico. Devolve "ELEMENTO@ATRIBUTO" de cada um que mudou.
 */
function linkPatentDate(el: XElement, name: string, root: XElement): string[] {
  const isRegistry = el.name === 'REGISTRO-OU-PATENTE' && name in PATENT_DATE_CODES;
  const attr =
    el.name === HISTORY && name === HISTORY_DATE
      ? patentDateAttrOf(getAttr(el, 'DESCRICAO-SITUACAO-PATENTE') ?? '')
      : undefined;
  if (!isRegistry && !attr) return [];
  const detail = parentOf(root, el);
  if (!detail) return [];
  const value = getAttr(el, name) ?? '';
  const others = isRegistry
    ? childElements(detail, HISTORY).filter(
        (h) => patentDateAttrOf(getAttr(h, 'DESCRICAO-SITUACAO-PATENTE') ?? '') === name,
      )
    : childElements(detail, 'REGISTRO-OU-PATENTE');
  const other = isRegistry ? HISTORY_DATE : attr!;
  return others.flatMap((o) => set(o, { [other]: value }).map((a) => `${o.name}@${a}`));
}

/**
 * Depois de gravar `name` em `el`, ajusta o que segue dele; devolve os
 * atributos alterados (os de outro elemento como "ELEMENTO@ATRIBUTO"). Com
 * `root`, a raiz da cópia de trabalho, segue também o que fica em outro
 * elemento (as datas da patente).
 */
export function applyLinkedAttrs(el: XElement, name: string, root?: XElement): string[] {
  if (root) {
    const linked = linkPatentDate(el, name, root);
    if (linked.length > 0) return linked;
  }
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
