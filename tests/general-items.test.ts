import { describe, expect, it } from 'vitest';

import { generalParts, missingGeneral } from '../src/forms/general-specs.ts';
import { typesFor } from '../src/forms/use-general-item.ts';
import { diffDocuments } from '../src/model/changes.ts';
import {
  atuacaoChoices,
  generalTypes,
  insertGeneralItem,
  newGeneralItem,
  nextGeneralSequence,
  readTeam,
  setTeam,
} from '../src/model/general-items.ts';
import { isPendingImport, pendingItems, readAuthors } from '../src/model/production.ts';
import { findOrderViolations } from '../src/model/schema-order.ts';
import { validateItem } from '../src/model/validate.ts';
import {
  childElements,
  firstChild,
  getAttr,
  parseXml,
  setAttr,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';
import { isSystemAttr } from '../src/ui/field-kind.ts';
import { NEW_GENERAL_LABELS } from '../src/ui/section-types.ts';

const OWNER = { citation: 'SILVA, A.', lattesId: '1234567890123456', name: 'Ana Silva' };

const CV = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1234567890123456">
  <DADOS-GERAIS NOME-COMPLETO="Ana Silva" NOME-EM-CITACOES-BIBLIOGRAFICAS="SILVA, A.">
    <RESUMO-CV TEXTO-RESUMO-CV-RH="x"/>
    <FORMACAO-ACADEMICA-TITULACAO>
      <GRADUACAO SEQUENCIA-FORMACAO="2" NOME-INSTITUICAO="UFRGS"/>
      <MESTRADO SEQUENCIA-FORMACAO="5" NOME-INSTITUICAO="UFRGS"/>
    </FORMACAO-ACADEMICA-TITULACAO>
    <ATUACOES-PROFISSIONAIS>
      <ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="" NOME-INSTITUICAO="UFRGS" SEQUENCIA-ATIVIDADE="3" SEQUENCIA-IMPORTANCIA="1">
        <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2019"/>
        <ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
          <PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCAO-ATIVIDADE="4">
            <PROJETO-DE-PESQUISA SEQUENCIA-PROJETO="7" NOME-DO-PROJETO="Antigo"/>
          </PARTICIPACAO-EM-PROJETO>
        </ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
      </ATUACAO-PROFISSIONAL>
      <ATUACAO-PROFISSIONAL NOME-INSTITUICAO="" SEQUENCIA-ATIVIDADE=""/>
    </ATUACOES-PROFISSIONAIS>
  </DADOS-GERAIS>
  <PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS><ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="30"/></ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA>
</CURRICULO-VITAE>`;

const load = (): XDocument => parseXml(CV);
const type = (sectionId: string, itemName?: string) => {
  const types = typesFor(sectionId);
  return itemName ? types.find((t) => t.itemName === itemName)! : types[0]!;
};

describe('tipos de item novo fora da produção', () => {
  it('cada seção tem os seus; a formação tem um tipo por nível, na ordem do Lattes', () => {
    const all = typesFor('formacao');
    // Os 12 níveis da formação acadêmica e os 4 da formação complementar.
    expect(all).toHaveLength(16);
    const levels = all.slice(0, 12);
    expect(levels.slice(0, 3).map((t) => t.label)).toEqual([
      'Doutorado',
      'Mestrado',
      'Mestrado Profissional',
    ]);
    expect(levels.at(-1)!.itemName).toMatch(/POS-DOUTORADO|LIVRE-DOCENCIA/);
    expect(all.slice(12).map((t) => t.containerPath.at(-1))).toEqual(
      Array(4).fill('FORMACAO-COMPLEMENTAR'),
    );
    expect(levels.every((t) => t.seqAttr === 'SEQUENCIA-FORMACAO')).toBe(true);
    expect(type('atuacao').itemName).toBe('ATUACAO-PROFISSIONAL');
    expect(type('projetos').kind).toBe('projeto');
    expect(type('patentes').seqAttr).toBe('SEQUENCIA-PRODUCAO');
    // Patentes e Registros: a patente e cada registro, na ordem das listas do Lattes.
    expect(typesFor('patentes').map((t) => [t.itemName, t.label])).toEqual([
      ['PATENTE', 'Patente'],
      ['CULTIVAR-PROTEGIDA', 'Cultivar protegida'],
      ['CULTIVAR-REGISTRADA', 'Cultivar registrada'],
      ['DESENHO-INDUSTRIAL', 'Desenho industrial'],
      ['MARCA', 'Marca'],
      ['TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', 'Topografia de circuito integrado'],
    ]);
    expect(typesFor('patentes').every((t) => t.kind === 'patente')).toBe(true);
    expect(typesFor('producoes')).toEqual([]);
    expect(generalTypes(schema, 'formacao', () => 'x').some((t) => t.label === 'x')).toBe(true);
    expect(Object.keys(NEW_GENERAL_LABELS).sort()).toEqual([
      'atuacao',
      'dados-gerais',
      'formacao',
      'patentes',
      'projetos',
    ]);
    expect(typesFor('dados-gerais').map((t) => t.itemName)).toEqual([
      'IDIOMA',
      'PREMIO-TITULO',
      'LICENCA',
      'AREA-DE-ATUACAO',
    ]);
    // Na atuação, o que entra numa atuação que já existe pede onde entrar.
    const atuacao = typesFor('atuacao');
    expect(atuacao[0]!.itemName).toBe('ATUACAO-PROFISSIONAL');
    expect(atuacao.slice(1).every((t) => t.host)).toBe(true);
    expect(atuacao.find((t) => t.itemName === 'DISCIPLINA')).toMatchObject({
      host: 'ENSINO',
      text: true,
    });
    expect(
      typesFor('projetos')
        .slice(1)
        .map((t) => [t.itemName, t.host]),
    ).toEqual([
      ['FINANCIADOR-DO-PROJETO', 'PROJETO-DE-PESQUISA'],
      ['PRODUCAO-CT-DO-PROJETO', 'PROJETO-DE-PESQUISA'],
      ['ORIENTACAO', 'PROJETO-DE-PESQUISA'],
    ]);
  });
});

describe('item novo vazio', () => {
  it('atuação vem com um vínculo; patente com partes, registro e o dono; projeto com a equipe', () => {
    const atuacao = newGeneralItem(schema, type('atuacao'));
    expect(childElements(atuacao, 'VINCULOS')).toHaveLength(1);
    expect(getAttr(childElements(atuacao, 'VINCULOS')[0]!, 'SEQUENCIA-HISTORICO')).toBe('1');
    expect(getAttr(atuacao, 'SEQUENCIA-ATIVIDADE')).toBe('');

    const patente = newGeneralItem(schema, type('patentes'), OWNER);
    expect(childElements(patente).map((c) => c.name)).toEqual([
      'DADOS-BASICOS-DA-PATENTE',
      'DETALHAMENTO-DA-PATENTE',
      'AUTORES',
    ]);
    expect(
      firstChild(firstChild(patente, 'DETALHAMENTO-DA-PATENTE')!, 'REGISTRO-OU-PATENTE'),
    ).toBeDefined();
    expect(readAuthors(patente)).toEqual([OWNER]);
    // CPF nunca entra.
    expect(firstChild(patente, 'AUTORES')!.attrs.some((a) => a.name === 'CPF')).toBe(false);

    // Os registros têm as mesmas peças, com o nome de cada tipo.
    const marca = newGeneralItem(schema, type('patentes', 'MARCA'), OWNER);
    expect(childElements(marca).map((c) => c.name)).toEqual([
      'DADOS-BASICOS-DA-MARCA',
      'DETALHAMENTO-DA-MARCA',
      'AUTORES',
    ]);
    expect(
      firstChild(firstChild(marca, 'DETALHAMENTO-DA-MARCA')!, 'REGISTRO-OU-PATENTE'),
    ).toBeDefined();
    expect(readAuthors(marca)).toEqual([OWNER]);
    const cultivar = newGeneralItem(schema, type('patentes', 'CULTIVAR-PROTEGIDA'));
    expect(childElements(cultivar).map((c) => c.name)).toEqual([
      'DADOS-BASICOS-DA-CULTIVAR',
      'DETALHAMENTO-DA-CULTIVAR',
    ]);

    const projeto = newGeneralItem(schema, type('projetos'), OWNER);
    expect(readTeam(projeto)).toEqual([OWNER]);
    expect(newGeneralItem(schema, type('projetos')).children).toEqual([]);
    expect(newGeneralItem(schema, type('formacao', 'MESTRADO')).name).toBe('MESTRADO');
  });

  it('a equipe guarda o responsável de quem já estava e some quando fica vazia', () => {
    const projeto = newGeneralItem(schema, type('projetos'), OWNER);
    const first = childElements(firstChild(projeto, 'EQUIPE-DO-PROJETO')!)[0]!;
    expect(getAttr(first, 'FLAG-RESPONSAVEL')).toBe('NAO');
    setAttr(first, 'FLAG-RESPONSAVEL', 'SIM');
    const other = { citation: 'LIMA, B.', lattesId: '', name: 'Bruno Lima' };
    setTeam(schema, projeto, [other, OWNER, { citation: '', lattesId: '', name: '  ' }]);
    expect(readTeam(projeto)).toEqual([other, OWNER]);
    const members = childElements(firstChild(projeto, 'EQUIPE-DO-PROJETO')!);
    expect(members.map((m) => getAttr(m, 'ORDEM-DE-INTEGRACAO'))).toEqual(['1', '2']);
    expect(members.map((m) => getAttr(m, 'FLAG-RESPONSAVEL'))).toEqual(['NAO', 'SIM']);
    setTeam(schema, projeto, []);
    expect(firstChild(projeto, 'EQUIPE-DO-PROJETO')).toBeUndefined();
    expect(readTeam(projeto)).toEqual([]);
  });
});

describe('número de sequência e inserção', () => {
  it('formação: acima do maior da cópia e da exportação, no lugar que o schema manda', () => {
    const doc = load();
    const original = load().root;
    // Na exportação houve um 9 que a cópia de trabalho já não tem: não se repete.
    setAttr(
      childElements(
        firstChild(firstChild(original, 'DADOS-GERAIS')!, 'FORMACAO-ACADEMICA-TITULACAO')!,
      )[0]!,
      'SEQUENCIA-FORMACAO',
      '9',
    );
    const t = type('formacao', 'DOUTORADO');
    const item = newGeneralItem(schema, t);
    const counter = insertGeneralItem(schema, doc, t, item, { original, productionCounter: 31 });
    expect(counter).toBe(31);
    expect(getAttr(item, 'SEQUENCIA-FORMACAO')).toBe('10');
    const levels = childElements(
      firstChild(firstChild(doc.root, 'DADOS-GERAIS')!, 'FORMACAO-ACADEMICA-TITULACAO')!,
    ).map((c) => c.name);
    expect(levels).toEqual(['GRADUACAO', 'MESTRADO', 'DOUTORADO']);
    expect(findOrderViolations(schema, doc.root)).toEqual([]);
    expect(nextGeneralSequence([doc.root], 'SEQUENCIA-FORMACAO')).toBe(11);
  });

  it('cria os contêineres que faltam', () => {
    const doc = parseXml(
      '<CURRICULO-VITAE><DADOS-GERAIS NOME-COMPLETO="A"><RESUMO-CV/><IDIOMAS/></DADOS-GERAIS></CURRICULO-VITAE>',
    );
    const t = type('atuacao');
    const item = newGeneralItem(schema, t);
    insertGeneralItem(schema, doc, t, item, { productionCounter: 1 });
    expect(getAttr(item, 'SEQUENCIA-ATIVIDADE')).toBe('1');
    const dg = firstChild(doc.root, 'DADOS-GERAIS')!;
    expect(childElements(dg).map((c) => c.name)).toEqual([
      'RESUMO-CV',
      'ATUACOES-PROFISSIONAIS',
      'IDIOMAS',
    ]);
  });

  it('patente gasta o contador global de SEQUENCIA-PRODUCAO', () => {
    const doc = load();
    const t = type('patentes');
    const item = newGeneralItem(schema, t, OWNER);
    const counter = insertGeneralItem(schema, doc, t, item, { productionCounter: 31 });
    expect(getAttr(item, 'SEQUENCIA-PRODUCAO')).toBe('31');
    expect(counter).toBe(32);
    expect(firstChild(firstChild(doc.root, 'PRODUCAO-TECNICA')!, 'PATENTE')).toBe(item);
    expect(findOrderViolations(schema, doc.root)).toEqual([]);
  });

  it('registros entram em PRODUCAO-TECNICA, na ordem do schema, e não vão pelo Importar', () => {
    const doc = load();
    let counter = 31;
    for (const t of typesFor('patentes').toReversed()) {
      const item = newGeneralItem(schema, t, OWNER);
      counter = insertGeneralItem(schema, doc, t, item, { productionCounter: counter });
      expect(isPendingImport(item, 30)).toBe(false);
    }
    expect(counter).toBe(37);
    expect(
      childElements(firstChild(doc.root, 'PRODUCAO-TECNICA')!)
        .map((c) => c.name)
        .sort(),
    ).toEqual(
      typesFor('patentes')
        .map((t) => t.itemName)
        .sort(),
    );
    expect(findOrderViolations(schema, doc.root)).toEqual([]);
  });

  it('projeto entra numa participação nova dentro da atuação escolhida', () => {
    const doc = load();
    const choices = atuacaoChoices(doc);
    expect(choices.map((c) => [c.key, c.label])).toEqual([
      ['3', 'UFRGS'],
      ['#2', 'Atuação #2'],
    ]);
    const t = type('projetos');
    const item = newGeneralItem(schema, t, OWNER);
    setAttr(item, 'ANO-INICIO', '2024');
    setAttr(item, 'ANO-FIM', '2025');
    insertGeneralItem(schema, doc, t, item, { atuacao: choices[0]!.el, productionCounter: 31 });
    expect(getAttr(item, 'SEQUENCIA-PROJETO')).toBe('8');
    const container = firstChild(choices[0]!.el, 'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO')!;
    const participacoes = childElements(container);
    expect(participacoes).toHaveLength(2);
    const nova = participacoes[1]!;
    expect(getAttr(nova, 'SEQUENCIA-FUNCAO-ATIVIDADE')).toBe('5');
    expect(getAttr(nova, 'FLAG-PERIODO')).toBe('ANTERIOR');
    expect(getAttr(nova, 'ANO-INICIO')).toBe('2024');
    expect(childElements(nova)).toEqual([item]);

    // Atuação sem projetos: o contêiner nasce; projeto sem fim é atual.
    const outro = newGeneralItem(schema, t);
    insertGeneralItem(schema, doc, t, outro, { atuacao: choices[1]!.el, productionCounter: 31 });
    const p = firstChild(
      firstChild(choices[1]!.el, 'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO')!,
      'PARTICIPACAO-EM-PROJETO',
    )!;
    expect(getAttr(p, 'FLAG-PERIODO')).toBe('ATUAL');
    // Acima do maior do currículo inteiro, não só da atuação.
    expect(getAttr(p, 'SEQUENCIA-FUNCAO-ATIVIDADE')).toBe('6');
    expect(findOrderViolations(schema, doc.root)).toEqual([]);
    expect(() =>
      insertGeneralItem(schema, doc, t, newGeneralItem(schema, t), { productionCounter: 1 }),
    ).toThrow(/atuação/);
  });
});

describe('caminho até o Lattes', () => {
  it('itens novos fora da produção entram na lista de alterações, não no Importar', () => {
    const original = load();
    const doc = load();
    const add = (sectionId: string, itemName?: string, fill?: (el: XElement) => void) => {
      const t = type(sectionId, itemName);
      const item = newGeneralItem(schema, t, OWNER);
      fill?.(item);
      insertGeneralItem(schema, doc, t, item, {
        atuacao: atuacaoChoices(doc)[0]?.el,
        original: original.root,
        productionCounter: 31,
      });
      return item;
    };
    const patente = add('patentes', undefined, (el) =>
      setAttr(firstChild(el, 'DADOS-BASICOS-DA-PATENTE')!, 'TITULO', 'Invento'),
    );
    add('formacao', 'DOUTORADO', (el) => setAttr(el, 'NOME-INSTITUICAO', 'USP'));
    add('projetos', undefined, (el) => setAttr(el, 'NOME-DO-PROJETO', 'Novo'));

    // A patente tem SEQUENCIA-PRODUCAO acima do máximo, mas o Importar não a lê.
    expect(isPendingImport(patente, 30)).toBe(false);
    expect(pendingItems(doc, 30)).toEqual([]);
    const skip = (el: XElement) => isPendingImport(el, 30);
    const novos = diffDocuments(original.root, doc.root, { skip }).filter((c) => c.kind === 'novo');
    expect(novos.map((c) => c.element).sort()).toEqual([
      'DOUTORADO',
      'PARTICIPACAO-EM-PROJETO',
      'PRODUCAO-TECNICA',
    ]);
  });

  it('a validação aponta o que falta escolher', () => {
    const atuacao = newGeneralItem(schema, type('atuacao'));
    const messages = validateItem(schema, atuacao).map((p) => p.message);
    expect(messages).toContain('Vínculo: escolha uma opção');
    const patente = newGeneralItem(schema, type('patentes'));
    const problems = validateItem(schema, patente).map((p) => p.message);
    expect(problems).toContain('Inclua ao menos um autor');
    expect(problems).toContain('Título: obrigatório');
  });
});

describe('campos do formulário', () => {
  it('mostra só os campos que o nível tem, e aponta os obrigatórios vazios', () => {
    const grad = newGeneralItem(schema, type('formacao', 'GRADUACAO'));
    const parts = generalParts(schema, 'formacao', grad);
    const attrs = parts.flatMap((p) => p.fields.map((f) => f.attr));
    expect(attrs).toContain('TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO');
    expect(attrs).not.toContain('TITULO-DA-DISSERTACAO-TESE');
    expect(missingGeneral(parts)).toEqual([
      { attr: 'NOME-INSTITUICAO', element: 'GRADUACAO' },
      { attr: 'ANO-DE-INICIO', element: 'GRADUACAO' },
    ]);
    setAttr(grad, 'NOME-INSTITUICAO', 'UFPel');
    setAttr(grad, 'ANO-DE-INICIO', '2001');
    expect(missingGeneral(parts)).toEqual([]);
    // Ensino fundamental não tem bolsa nem título: as partes vazias somem.
    const fund = newGeneralItem(schema, type('formacao', 'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU'));
    expect(generalParts(schema, 'formacao', fund).map((p) => p.legend)).toEqual(['Curso']);
  });

  it('atuação, projeto e patente editam as partes certas', () => {
    const atuacao = newGeneralItem(schema, type('atuacao'));
    expect(generalParts(schema, 'atuacao', atuacao).map((p) => p.el.name)).toEqual([
      'ATUACAO-PROFISSIONAL',
      'VINCULOS',
    ]);
    const patente = newGeneralItem(schema, type('patentes'));
    expect(generalParts(schema, 'patente', patente).map((p) => p.el.name)).toEqual([
      'DADOS-BASICOS-DA-PATENTE',
      'REGISTRO-OU-PATENTE',
      'DETALHAMENTO-DA-PATENTE',
    ]);
    // Sem a parte (item montado à mão), a parte some em vez de quebrar.
    expect(generalParts(schema, 'patente', parseXml('<PATENTE/>').root)).toEqual([]);
    const attrsOf = (itemName: string) =>
      generalParts(schema, 'patente', newGeneralItem(schema, type('patentes', itemName))).flatMap(
        (p) => p.fields.map((f) => f.attr),
      );
    // A cultivar tem denominação e ano de solicitação; o tipo só se escolhe na
    // patente e na marca; a natureza é da marca.
    expect(attrsOf('CULTIVAR-PROTEGIDA')).toEqual(
      expect.arrayContaining(['DENOMINACAO', 'ANO-SOLICITACAO', 'CODIGO-DO-REGISTRO-OU-PATENTE']),
    );
    expect(attrsOf('CULTIVAR-PROTEGIDA')).not.toContain('TIPO-PATENTE');
    expect(attrsOf('DESENHO-INDUSTRIAL')).not.toContain('TIPO-PATENTE');
    expect(attrsOf('MARCA')).toEqual(expect.arrayContaining(['TIPO-PATENTE', 'NATUREZA']));
    expect(attrsOf('PATENTE')).toContain('TIPO-PATENTE');
    const desenho = newGeneralItem(schema, type('patentes', 'DESENHO-INDUSTRIAL'));
    expect(missingGeneral(generalParts(schema, 'patente', desenho)).map((m) => m.attr)).toEqual([
      'TITULO',
      'CODIGO-DO-REGISTRO-OU-PATENTE',
    ]);
    // Campos que o formulário do Lattes não tem para o tipo saem da lista principal.
    expect(attrsOf('DESENHO-INDUSTRIAL')).not.toContain('ANO-DESENVOLVIMENTO');
    expect(attrsOf('CULTIVAR-REGISTRADA')).not.toContain('FINALIDADE');
    expect(attrsOf('TOPOGRAFIA-DE-CIRCUITO-INTEGRADO')).toEqual(
      expect.arrayContaining(['ANO-DESENVOLVIMENTO', 'FINALIDADE', 'INSTITUICAO-FINANCIADORA']),
    );
    const projeto = newGeneralItem(schema, type('projetos'));
    expect(generalParts(schema, 'projeto', projeto)[0]!.fields[0]!.attr).toBe('NOME-DO-PROJETO');
  });

  it('o número da patente se digita; os outros códigos continuam do Lattes', () => {
    expect(isSystemAttr('REGISTRO-OU-PATENTE', 'CODIGO-DO-REGISTRO-OU-PATENTE')).toBe(false);
    expect(isSystemAttr('ATUACAO-PROFISSIONAL', 'CODIGO-INSTITUICAO')).toBe(true);
  });
});
