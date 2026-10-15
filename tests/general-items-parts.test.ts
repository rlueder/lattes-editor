// Os itens novos da LAT-57 fora da produção: dados gerais, formação
// complementar e o que entra numa atuação ou num projeto que já existe.

import { describe, expect, it } from 'vitest';

import { generalParts, missingGeneral } from '../src/forms/general-specs.ts';
import { itemText, setItemText, titleOf, typesFor } from '../src/forms/use-general-item.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { hostChoices, insertGeneralItem, newGeneralItem } from '../src/model/general-items.ts';
import { findOrderViolations } from '../src/model/schema-order.ts';
import {
  childElements,
  firstChild,
  getAttr,
  parseXml,
  serializeXml,
  setAttr,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

const CV = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1234567890123456">
  <DADOS-GERAIS NOME-COMPLETO="Ana Silva">
    <ATUACOES-PROFISSIONAIS>
      <ATUACAO-PROFISSIONAL NOME-INSTITUICAO="UFRGS" SEQUENCIA-ATIVIDADE="3">
        <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2019"/>
        <ATIVIDADES-DE-ENSINO>
          <ENSINO SEQUENCIA-FUNCAO-ATIVIDADE="4" ANO-INICIO="2020" NOME-CURSO="Biologia">
            <DISCIPLINA SEQUENCIA-ESPECIFICACAO="2">Genética</DISCIPLINA>
          </ENSINO>
        </ATIVIDADES-DE-ENSINO>
        <ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
          <PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCAO-ATIVIDADE="5">
            <PROJETO-DE-PESQUISA SEQUENCIA-PROJETO="7" NOME-DO-PROJETO="Palmeiras" ANO-INICIO="2021"/>
          </PARTICIPACAO-EM-PROJETO>
        </ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
      </ATUACAO-PROFISSIONAL>
      <ATUACAO-PROFISSIONAL NOME-INSTITUICAO="USP" SEQUENCIA-ATIVIDADE="6"/>
    </ATUACOES-PROFISSIONAIS>
  </DADOS-GERAIS>
</CURRICULO-VITAE>`;

const type = (sectionId: string, itemName: string) =>
  typesFor(sectionId).find((t) => t.itemName === itemName)!;

function add(sectionId: string, itemName: string, host?: XElement, fill?: (el: XElement) => void) {
  const doc = parseXml(CV);
  const t = type(sectionId, itemName);
  const item = newGeneralItem(schema, t);
  fill?.(item);
  const hostEl = host && hostChoices(doc, t.host!).find((c) => c.el.name === host.name)?.el;
  insertGeneralItem(schema, doc, t, item, { host: hostEl, productionCounter: 1 });
  return { doc, item };
}

describe('onde o item entra', () => {
  it('as escolhas mostram a instituição, o que é e o período', () => {
    const doc = parseXml(CV);
    expect(hostChoices(doc, 'ATUACAO-PROFISSIONAL').map((c) => c.label)).toEqual(['UFRGS', 'USP']);
    expect(hostChoices(doc, 'ENSINO').map((c) => c.label)).toEqual([
      'UFRGS · Biologia (2020, atual)',
    ]);
    expect(hostChoices(doc, 'PROJETO-DE-PESQUISA').map((c) => c.label)).toEqual([
      'UFRGS · Palmeiras (2021, atual)',
    ]);
    expect(hostChoices(doc, 'PESQUISA-E-DESENVOLVIMENTO')).toEqual([]);
  });

  it('vínculo e atividade entram na atuação escolhida, com número acima do maior', () => {
    const doc = parseXml(CV);
    const [, usp] = hostChoices(doc, 'ATUACAO-PROFISSIONAL');
    const vinculo = newGeneralItem(schema, type('atuacao', 'VINCULOS'));
    setAttr(vinculo, 'ANO-INICIO', '2024');
    insertGeneralItem(schema, doc, type('atuacao', 'VINCULOS'), vinculo, {
      host: usp!.el,
      productionCounter: 1,
    });
    expect(childElements(usp!.el, 'VINCULOS')).toEqual([vinculo]);
    expect(getAttr(vinculo, 'SEQUENCIA-HISTORICO')).toBe('2');

    const t = type('atuacao', 'DIRECAO-E-ADMINISTRACAO');
    const direcao = newGeneralItem(schema, t);
    setAttr(direcao, 'ANO-INICIO', '2022');
    insertGeneralItem(schema, doc, t, direcao, { host: usp!.el, productionCounter: 1 });
    expect(
      firstChild(usp!.el, 'ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO')!.children.includes(direcao),
    ).toBe(true);
    expect(getAttr(direcao, 'SEQUENCIA-FUNCAO-ATIVIDADE')).toBe('6');
    expect(getAttr(direcao, 'FLAG-PERIODO')).toBe('ATUAL');
    expect(findOrderViolations(schema, doc.root)).toEqual([]);
    // Sem lugar, não entra.
    expect(() =>
      insertGeneralItem(schema, doc, t, newGeneralItem(schema, t), { productionCounter: 1 }),
    ).toThrow(/onde entrar/);
  });

  it('disciplina é só o nome, dentro da atividade de ensino', () => {
    const { doc, item } = add('atuacao', 'DISCIPLINA', parseXml('<ENSINO/>').root, (el) =>
      setItemText(el, 'Evolução'),
    );
    expect(itemText(item)).toBe('Evolução');
    expect(getAttr(item, 'SEQUENCIA-ESPECIFICACAO')).toBe('3');
    expect(serializeXml(doc)).toContain(
      '<DISCIPLINA SEQUENCIA-ESPECIFICACAO="2">Genética</DISCIPLINA><DISCIPLINA SEQUENCIA-ESPECIFICACAO="3">Evolução</DISCIPLINA>',
    );
    expect(titleOf(item, type('atuacao', 'DISCIPLINA'))).toBe('Evolução');
    setItemText(item, '');
    expect(item.children).toEqual([]);
  });

  it('financiador entra no projeto; a mudança é um item novo dentro dele', () => {
    const original = parseXml(CV);
    const { doc, item } = add(
      'projetos',
      'FINANCIADOR-DO-PROJETO',
      parseXml('<PROJETO-DE-PESQUISA/>').root,
      (el) => setAttr(el, 'NOME-INSTITUICAO', 'CNPq'),
    );
    expect(getAttr(item, 'SEQUENCIA-FINANCIADOR')).toBe('1');
    const novos = diffDocuments(original.root, doc.root).filter((c) => c.kind === 'novo');
    expect(novos.map((c) => c.element)).toEqual(['FINANCIADORES-DO-PROJETO']);
    expect(titleOf(item, type('projetos', 'FINANCIADOR-DO-PROJETO'))).toBe('CNPq');
  });

  it('idioma e prêmio entram nos dados gerais, sem número; a área ganha o seu', () => {
    const idioma = add('dados-gerais', 'IDIOMA', undefined, (el) => setAttr(el, 'IDIOMA', 'EN'));
    expect(getAttr(firstChild(idioma.doc.root, 'DADOS-GERAIS')!, 'NOME-COMPLETO')).toBe(
      'Ana Silva',
    );
    expect(
      childElements(firstChild(firstChild(idioma.doc.root, 'DADOS-GERAIS')!, 'IDIOMAS')!),
    ).toEqual([idioma.item]);
    expect(titleOf(idioma.item, type('dados-gerais', 'IDIOMA'))).toBe('EN');
    const area = add('dados-gerais', 'AREA-DE-ATUACAO');
    expect(getAttr(area.item, 'SEQUENCIA-AREA-DE-ATUACAO')).toBe('1');
    expect(findOrderViolations(schema, area.doc.root)).toEqual([]);
  });
});

describe('campos dos formulários novos', () => {
  const parts = (sectionId: string, itemName: string) =>
    generalParts(
      schema,
      type(sectionId, itemName).kind,
      newGeneralItem(schema, type(sectionId, itemName)),
    );
  const attrs = (sectionId: string, itemName: string) =>
    parts(sectionId, itemName).flatMap((p) => p.fields.map((f) => f.attr));

  it('cada tipo mostra só o que o elemento tem, e pede o obrigatório', () => {
    expect(attrs('dados-gerais', 'PREMIO-TITULO')).toEqual([
      'NOME-DO-PREMIO-OU-TITULO',
      'NOME-DA-ENTIDADE-PROMOTORA',
      'ANO-DA-PREMIACAO',
      'NOME-DO-PREMIO-OU-TITULO-INGLES',
    ]);
    expect(missingGeneral(parts('dados-gerais', 'PREMIO-TITULO')).map((m) => m.attr)).toEqual([
      'NOME-DO-PREMIO-OU-TITULO',
      'ANO-DA-PREMIACAO',
    ]);
    expect(attrs('atuacao', 'ENSINO')).toEqual(
      expect.arrayContaining(['TIPO-ENSINO', 'NOME-CURSO', 'ANO-INICIO']),
    );
    expect(attrs('atuacao', 'DIRECAO-E-ADMINISTRACAO')).toContain('CARGO-OU-FUNCAO');
    expect(attrs('atuacao', 'DIRECAO-E-ADMINISTRACAO')).not.toContain('TIPO-ENSINO');
    expect(attrs('atuacao', 'VINCULOS')).toContain('TIPO-DE-VINCULO');
    expect(attrs('atuacao', 'LINHA-DE-PESQUISA')[0]).toBe('TITULO-DA-LINHA-DE-PESQUISA');
    expect(attrs('projetos', 'ORIENTACAO')).toEqual(['TITULO-ORIENTACAO', 'TIPO-ORIENTACAO']);
    expect(attrs('projetos', 'FINANCIADOR-DO-PROJETO')).toEqual(['NOME-INSTITUICAO', 'NATUREZA']);
    expect(attrs('dados-gerais', 'AREA-DE-ATUACAO')[0]).toBe('NOME-GRANDE-AREA-DO-CONHECIMENTO');
    expect(attrs('dados-gerais', 'LICENCA')).toEqual([
      'TIPO-LICENCA',
      'DATA-INICIO-LICENCA',
      'DATA-FIM-LICENCA',
    ]);
    expect(attrs('formacao', 'MBA')).toEqual(
      expect.arrayContaining(['NOME-INSTITUICAO', 'NOME-CURSO']),
    );
    expect(parts('atuacao', 'DISCIPLINA')).toEqual([]);
  });
});
