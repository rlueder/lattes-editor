import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { validateItem } from '../src/model/validate.ts';
import { parseXml, setAttr } from '../src/model/xml.ts';
import {
  CATEGORIES,
  onlyCategory,
  summaryLine,
  validateCv,
  worst,
} from '../src/review/validation.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';
import { buildSections } from '../src/ui/sections.ts';

const TODAY = new Date(2026, 9, 15);

function cv(xml: string) {
  const root = parseXml(`<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001">
    <DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NOME-EM-CITACOES-BIBLIOGRAFICAS="TESTE, P." NACIONALIDADE="B" PERMISSAO-DE-DIVULGACAO="NAO">
      ${xml}
    </DADOS-GERAIS>
  </CURRICULO-VITAE>`).root;
  return { root, sections: buildSections(root) };
}

const atuacao = (inner: string, attrs = '') =>
  `<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Universidade A" CODIGO-INSTITUICAO="001" SEQUENCIA-ATIVIDADE="1" ${attrs}>${inner}</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS>`;

describe('validação do currículo inteiro (LAT-25)', () => {
  it('confere cada item das seções, uma vez, com o lugar do item e o tipo do achado', async () => {
    const demo = await loadCv(
      new Uint8Array(readFileSync(new URL('../fixtures/demo.xml', import.meta.url))),
      'demo.xml',
    );
    const sections = buildSections(demo.doc.root);
    const v = validateCv(schema, demo.doc.root, sections, TODAY);
    // Os eventos da demonstração não têm participantes: é o que a demonstração mostra.
    expect(v.items.map((r) => r.place?.sectionId)).toEqual(['eventos', 'eventos', 'eventos']);
    expect(v.items[0]!.checks).toEqual([
      { category: 'autores', message: 'Inclua ao menos um participante', severity: 'erro' },
    ]);
    expect(v.byCategory.autores).toBe(3);
    expect(v.bySeverity).toEqual({ aviso: 0, erro: 3, nota: 0 });
    expect(v.total).toBeGreaterThan(30);
    expect(summaryLine(v)).toBe('3 para corrigir');
  });

  it('junta a revisão de consistência aos problemas do schema, o mais grave primeiro', () => {
    const { root, sections } = cv(
      atuacao(
        '<VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2000" ANO-FIM="" TIPO-DE-VINCULO="NAO_INFORMADO"/>',
      ),
    );
    const v = validateCv(schema, root, sections, TODAY);
    const report = v.items.find((r) => r.item.name === 'ATUACAO-PROFISSIONAL')!;
    expect(report.place?.sectionId).toBe('atuacao');
    expect(report.title).toBe('Universidade A');
    expect(report.checks.map((c) => [c.category, c.severity])).toEqual([
      ['lista', 'erro'],
      ['consistencia', 'nota'],
    ]);
    expect(worst(report)).toBe(report.checks[0]!.severity);
  });

  it('o projeto dentro da atuação é conferido em Projetos, não na atuação', () => {
    const projeto =
      '<ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO><PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCIONAL="1"><PROJETO-DE-PESQUISA SEQUENCIA-PROJETO="1" NOME-DO-PROJETO="Projeto X" ANO-INICIO="20x0" SITUACAO="EM_ANDAMENTO" NATUREZA="PESQUISA"/></PARTICIPACAO-EM-PROJETO></ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>';
    const { root, sections } = cv(atuacao(projeto));
    const v = validateCv(schema, root, sections, TODAY);
    const yearChecks = v.items.flatMap((r) =>
      r.checks.filter((c) => c.category === 'ano').map(() => r.place?.sectionId),
    );
    expect(yearChecks).toEqual(['projetos']);
  });

  it('o bloco de identificação vale só pelos atributos dele', () => {
    const { root, sections } = cv(
      '<IDIOMAS><IDIOMA IDIOMA="EN" PROFICIENCIA-DE-LEITURA="X"/></IDIOMAS>',
    );
    const dg = root.children.find((c) => c.kind === 'element' && c.name === 'DADOS-GERAIS');
    if (dg?.kind !== 'element') throw new Error('sem DADOS-GERAIS');
    setAttr(dg, 'PERMISSAO-DE-DIVULGACAO', 'TALVEZ');
    const v = validateCv(schema, root, sections, TODAY);
    // O problema do idioma fica no idioma, não na identificação.
    expect(v.items.find((r) => r.item.name === 'IDIOMA')?.checks).toHaveLength(1);
    const identificacao = v.items.find((r) => r.title === 'Identificação');
    expect(identificacao?.checks).toEqual([
      expect.objectContaining({ category: 'lista', severity: 'erro' }),
    ]);
    expect(identificacao?.place?.sectionId).toBe('dados-gerais');
  });

  it('filtra por tipo e resume as contagens', () => {
    const { root, sections } = cv(
      atuacao(
        '<VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2000" ANO-FIM="" TIPO-DE-VINCULO="X"/>',
      ),
    );
    const v = validateCv(schema, root, sections, TODAY);
    expect(onlyCategory(v.items)).toBe(v.items);
    const lists = onlyCategory(v.items, 'lista');
    expect(lists.every((r) => r.checks.every((c) => c.category === 'lista'))).toBe(true);
    expect(onlyCategory(v.items, 'consistencia')).toHaveLength(1);
    expect(onlyCategory(v.items, 'doi')).toEqual([]);
    expect(Object.keys(v.byCategory)).toEqual([...CATEGORIES]);
    expect(summaryLine({ bySeverity: { aviso: 1, erro: 0, nota: 2 } })).toBe('3 para conferir');
    expect(summaryLine({ bySeverity: { aviso: 0, erro: 2, nota: 1 } })).toBe(
      '2 para corrigir · 1 para conferir',
    );
    expect(summaryLine({ bySeverity: { aviso: 0, erro: 0, nota: 0 } })).toBe('Nada a corrigir');
  });

  it('currículo sem achados', () => {
    const { root, sections } = cv('');
    const v = validateCv(schema, root, sections, TODAY);
    expect(v.items).toEqual([]);
    expect(summaryLine(v)).toBe('Nada a corrigir');
  });
});

describe('validateItem: o tipo de cada problema', () => {
  it('participantes de evento e banca, autores no resto', () => {
    const evento = parseXml(
      '<PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="1"><DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO ANO="2020" TITULO="T"/></PARTICIPACAO-EM-CONGRESSO>',
    ).root;
    const problems = validateItem(schema, evento, TODAY);
    expect(problems.find((p) => p.kind === 'autores')?.message).toBe(
      'Inclua ao menos um participante',
    );
  });

  it('skip deixa partes de fora', () => {
    const item = parseXml(
      '<ATUACAO-PROFISSIONAL><VINCULOS ANO-INICIO="20x0"/></ATUACAO-PROFISSIONAL>',
    ).root;
    expect(validateItem(schema, item, TODAY).some((p) => p.kind === 'ano')).toBe(true);
    expect(validateItem(schema, item, TODAY, (el) => el.name === 'VINCULOS')).toEqual([]);
  });
});
