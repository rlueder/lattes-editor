import { describe, expect, it } from 'vitest';

import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import {
  applyLinkedAttrs,
  followsCountry,
  NATIONALITY_COUNTRIES,
  writesOwnCode,
} from '../src/model/linked-attrs.ts';
import { element, getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { typedChoices } from '../src/schema/typed-choices.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa" NACIONALIDADE="B" SIGLA-PAIS-NACIONALIDADE="BRA" PAIS-DE-NACIONALIDADE="Brasil"/></CURRICULO-VITAE>`;

const general = (root: XElement) =>
  root.children.find((c): c is XElement => c.kind === 'element' && c.name === 'DADOS-GERAIS')!;

describe('país de nacionalidade leva a sigla e a nacionalidade', () => {
  it('outro país vira estrangeira; o Brasil, brasileira', () => {
    const el = general(parseXml(XML).root);
    setAttr(el, 'PAIS-DE-NACIONALIDADE', 'Portugal');
    expect(applyLinkedAttrs(el, 'PAIS-DE-NACIONALIDADE').sort()).toEqual([
      'NACIONALIDADE',
      'SIGLA-PAIS-NACIONALIDADE',
    ]);
    expect(getAttr(el, 'NACIONALIDADE')).toBe('E');
    expect(getAttr(el, 'SIGLA-PAIS-NACIONALIDADE')).toBe('POR');
    setAttr(el, 'PAIS-DE-NACIONALIDADE', 'Brasil');
    applyLinkedAttrs(el, 'PAIS-DE-NACIONALIDADE');
    expect(getAttr(el, 'NACIONALIDADE')).toBe('B');
  });

  it('país que o Lattes não tem não mexe no resto', () => {
    const el = general(parseXml(XML).root);
    setAttr(el, 'PAIS-DE-NACIONALIDADE', 'Atlântida');
    expect(applyLinkedAttrs(el, 'PAIS-DE-NACIONALIDADE')).toEqual([]);
    expect(getAttr(el, 'NACIONALIDADE')).toBe('B');
  });

  it('o campo do país é uma lista do Lattes, e a nacionalidade só segue', () => {
    expect(writesOwnCode('DADOS-GERAIS', 'PAIS-DE-NACIONALIDADE')).toBe(true);
    expect(followsCountry('DADOS-GERAIS', 'NACIONALIDADE')).toBe(true);
    const choices = typedChoices(element('DADOS-GERAIS'), 'PAIS-DE-NACIONALIDADE');
    expect(choices?.map((c) => c.value)).toContain('Portugal');
    expect(choices).toHaveLength(NATIONALITY_COUNTRIES.length);
  });

  it('a troca feita assim vai pelo conector, sem ficar à mão', () => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    const el = general(working);
    setAttr(el, 'PAIS-DE-NACIONALIDADE', 'Portugal');
    applyLinkedAttrs(el, 'PAIS-DE-NACIONALIDADE');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
      working,
      { biographicFull: true, biographicOps: true },
    );
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops[0]).toMatchObject({
      set: { f_nacionalidade: 'E', f_pais_nacio: 'POR' },
    });
  });
});
