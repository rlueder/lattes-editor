import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildImportFile, lattesTimestamp } from '../src/import-export/import-file.ts';
import { loadCv, maxSequenciaProducao } from '../src/model/document.ts';
import {
  addProduction,
  authorElementName,
  findBySequencia,
  importableTypes,
  itemPart,
  knownAreas,
  knownAuthors,
  newItem,
  nextSequencia,
  pendingItems,
  productionType,
  pruneEmptyExtras,
  readAreas,
  readAuthors,
  readKeywords,
  removeProduction,
  replaceProduction,
  setAreas,
  setAuthors,
  setKeywords,
} from '../src/model/production.ts';
import { findOrderViolations } from '../src/model/schema-order.ts';
import { validateItem } from '../src/model/validate.ts';
import { getAttr, parseXml, serializeXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

const ROOT = join(import.meta.dirname, '..');
const loadFixture = async (name: string) =>
  loadCv(new Uint8Array(readFileSync(join(ROOT, 'fixtures', name))), name);

/** Preenche o que a validação exige: enums, título e ano, como faria o formulário. */
function fillForExport(el: XElement): void {
  for (const a of el.attrs) {
    const spec = schema.elements[el.name]?.attributes.find((s) => s.name === a.name);
    if (spec?.enum && !spec.enum.includes(a.value)) a.value = spec.enum[0]!;
    if (/^ANO($|-)/.test(a.name) && !a.value) a.value = '2025';
    if (a.name.startsWith('TITULO') && !a.name.endsWith('INGLES') && !a.value) a.value = 'Título';
  }
  for (const c of el.children) if (c.kind === 'element') fillForExport(c);
}

const ME = { citation: 'TESTE, P. A.', lattesId: '0000000000000001', name: 'Pessoa de Teste Ação' };
const COAUTHOR = { citation: 'SILVA, M.', lattesId: '', name: 'Maria Silva' };

describe('importableTypes', () => {
  it('cobre os 17 módulos e expande os caminhos com "*"', () => {
    const types = importableTypes(schema);
    expect(new Set(types.map((t) => t.module.id)).size).toBe(17);
    expect(productionType(schema, 'TRABALHO-EM-EVENTOS')?.containerPath).toEqual([
      'PRODUCAO-BIBLIOGRAFICA',
      'TRABALHOS-EM-EVENTOS',
    ]);
    // Apresentação de trabalho pertence ao próprio módulo, não a "Outras produções técnicas".
    const apresentacao = types.filter((t) => t.itemName === 'APRESENTACAO-DE-TRABALHO');
    expect(apresentacao.map((t) => t.module.id)).toEqual(['apresentacao']);
    expect(types.some((t) => t.itemName === 'PATENTE')).toBe(false);
  });
});

describe('newItem', () => {
  it('monta o formato do item aceito em 10/10/2026 (guia, 3.5)', () => {
    const item = newItem(schema, 'TRABALHO-EM-EVENTOS', 33);
    setAuthors(schema, item, [ME]);
    setKeywords(schema, item, ['design', '']);
    const xml = serializeXml({ epilog: '', prolog: '', root: item });
    expect(xml).toMatch(/^<TRABALHO-EM-EVENTOS SEQUENCIA-PRODUCAO="33">/);
    expect(xml).toContain('<DADOS-BASICOS-DO-TRABALHO NATUREZA="" TITULO-DO-TRABALHO=""');
    expect(xml).toContain('FLAG-RELEVANCIA="NAO"');
    expect(xml).toContain(
      '<AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa de Teste Ação" NOME-PARA-CITACAO="TESTE, P. A." ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ="0000000000000001"/>',
    );
    expect(xml).not.toContain('CPF');
    expect(xml).toContain('PALAVRA-CHAVE-1="design" PALAVRA-CHAVE-2=""');
    expect(xml).not.toContain('AREAS-DO-CONHECIMENTO');
    expect(findOrderViolations(schema, item)).toEqual([]);
  });

  it('recusa tipo desconhecido ou sem SEQUENCIA-PRODUCAO', () => {
    expect(() => newItem(schema, 'NAO-EXISTE', 1)).toThrow('desconhecido');
    expect(() => newItem(schema, 'DADOS-GERAIS', 1)).toThrow('SEQUENCIA-PRODUCAO');
  });
});

describe('autores', () => {
  it('usa o elemento de autoria do tipo e mantém a ordem', () => {
    expect(authorElementName(schema, 'ARTIGO-PUBLICADO')).toBe('AUTORES');
    expect(authorElementName(schema, 'PARTICIPACAO-EM-CONGRESSO')).toBe(
      'PARTICIPANTE-DE-EVENTOS-CONGRESSOS',
    );
    expect(authorElementName(schema, 'PARTICIPACAO-EM-BANCA-DE-MESTRADO')).toBe(
      'PARTICIPANTE-BANCA',
    );
    expect(authorElementName(schema, 'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO')).toBeUndefined();

    const item = newItem(schema, 'PARTICIPACAO-EM-CONGRESSO', 40);
    setAuthors(schema, item, [COAUTHOR, ME]);
    expect(readAuthors(item)).toEqual([COAUTHOR, ME]);
    setAuthors(schema, item, [ME]);
    expect(readAuthors(item)).toEqual([ME]);
    expect(findOrderViolations(schema, item)).toEqual([]);

    const orientacao = newItem(schema, 'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', 41);
    expect(() => setAuthors(schema, orientacao, [ME])).toThrow('autoria');
  });

  it('lista coautores do currículo sem repetir, com o dono primeiro', () => {
    const doc = parseXml(`<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001">
      <DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste Ação" NOME-EM-CITACOES-BIBLIOGRAFICAS="TESTE, P. A.;TESTE, P."/>
      <X><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa de Teste Ação" NOME-PARA-CITACAO="TESTE, P." ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ=""/>
      <AUTORES NOME-COMPLETO-DO-AUTOR="Maria Silva" NOME-PARA-CITACAO="SILVA, M." ORDEM-DE-AUTORIA="2" NRO-ID-CNPQ=""/>
      <PARTICIPANTE-BANCA NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA="maria silva " ORDEM-PARTICIPANTE="1"/>
      <AUTORES NOME-COMPLETO-DO-AUTOR="" ORDEM-DE-AUTORIA="3"/></X>
    </CURRICULO-VITAE>`);
    expect(knownAuthors(doc)).toEqual([ME, COAUTHOR]);
  });
});

describe('extras', () => {
  it('palavras-chave: até 6, remove quando vazias; extras vazios saem', () => {
    const item = newItem(schema, 'ARTIGO-PUBLICADO', 50);
    setKeywords(schema, item, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(readKeywords(item)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    setKeywords(schema, item, ['  ']);
    expect(readKeywords(item)).toEqual([]);

    item.children.push(
      parseXml('<AREAS-DO-CONHECIMENTO><AREA-DO-CONHECIMENTO-1 X=""/></AREAS-DO-CONHECIMENTO>')
        .root,
    );
    item.children.push(parseXml('<INFORMACOES-ADICIONAIS DESCRICAO-INFO-ADICIONAL="x"/>').root);
    pruneEmptyExtras(item);
    expect(item.children.map((c) => (c.kind === 'element' ? c.name : c.kind))).toEqual([
      'DADOS-BASICOS-DO-ARTIGO',
      'DETALHAMENTO-DO-ARTIGO',
      'INFORMACOES-ADICIONAIS',
    ]);
    expect(itemPart(item, 'DETALHAMENTO')?.name).toBe('DETALHAMENTO-DO-ARTIGO');
  });
});

describe('arquivo de importação', () => {
  it('um item novo de cada tipo importável: ordem do schema e XSD válido', async () => {
    const cv = await loadFixture('synthetic_minimal.xml');
    const loadedMax = maxSequenciaProducao(cv.doc);
    let next = loadedMax + 1;
    for (const type of importableTypes(schema)) {
      const item = newItem(schema, type.itemName, next++);
      if (authorElementName(schema, type.itemName)) setAuthors(schema, item, [ME, COAUTHOR]);
      const basics = itemPart(item, 'DADOS-BASICOS');
      const title = basics?.attrs.find((a) => a.name.startsWith('TITULO'));
      if (basics && title) setAttr(basics, title.name, `Item novo ${type.itemName}`);
      expect(validateItem(schema, item).length).toBeGreaterThan(0);
      fillForExport(item);
      expect(validateItem(schema, item)).toEqual([]);
      addProduction(schema, cv.doc, type, item);
    }
    expect(findOrderViolations(schema, cv.doc.root)).toEqual([]);

    const file = buildImportFile(cv.doc, cv.encoding, loadedMax, new Date(2026, 9, 11, 9, 5, 7));
    expect(file.fileName).toBe('0000000000000001-importacao.xml');
    expect(file.newItems).toBe(importableTypes(schema).length);
    expect(file.modules).toHaveLength(17);

    const text = new TextDecoder('latin1').decode(file.bytes);
    expect(text).toContain('DATA-ATUALIZACAO="11102026" HORA-ATUALIZACAO="090507"');

    const dir = mkdtempSync(join(tmpdir(), 'lattes-import-'));
    const path = join(dir, file.fileName);
    writeFileSync(path, file.bytes);
    const xsd = join(ROOT, 'schema/CurriculoLattes_2022_patched.xsd');
    expect(() =>
      execFileSync('xmllint', ['--noout', '--schema', xsd, path], { stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('só lista os módulos com itens novos e não altera o documento de origem', async () => {
    const cv = await loadFixture('synthetic_minimal.xml');
    const loadedMax = maxSequenciaProducao(cv.doc);
    const type = productionType(schema, 'ARTIGO-PUBLICADO')!;
    addProduction(schema, cv.doc, type, newItem(schema, 'ARTIGO-PUBLICADO', loadedMax + 1));
    const before = serializeXml(cv.doc);
    const file = buildImportFile(cv.doc, cv.encoding, loadedMax);
    expect(file.modules.map((m) => m.label)).toEqual(['Artigos completos publicados']);
    expect(serializeXml(cv.doc)).toBe(before);
    expect(getAttr(cv.doc.root, 'DATA-ATUALIZACAO')).toBe('15032024');
  });

  it('cria contêineres que faltam, acha e remove por sequência', () => {
    const doc = parseXml(
      '<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS/></CURRICULO-VITAE>',
    );
    const type = productionType(schema, 'TRABALHO-EM-EVENTOS')!;
    addProduction(schema, doc, type, newItem(schema, 'TRABALHO-EM-EVENTOS', 7));
    expect(pendingItems(doc, 6)).toHaveLength(1);
    expect(pendingItems(doc, 7)).toHaveLength(0);
    expect(findBySequencia(doc, 7)?.name).toBe('TRABALHO-EM-EVENTOS');
    expect(removeProduction(doc, 7)).toBe(true);
    expect(removeProduction(doc, 7)).toBe(false);
    expect(findBySequencia(doc, 7)).toBeUndefined();
    expect(buildImportFile(doc, 'UTF-8', 0).modules).toEqual([]);
  });

  it('troca item pela sequência e calcula o próximo número livre', () => {
    const doc = parseXml('<CURRICULO-VITAE><DADOS-GERAIS/></CURRICULO-VITAE>');
    const type = productionType(schema, 'ARTIGO-PUBLICADO')!;
    addProduction(schema, doc, type, newItem(schema, 'ARTIGO-PUBLICADO', 33));
    const edited = newItem(schema, 'ARTIGO-PUBLICADO', 33);
    setAttr(itemPart(edited, 'DADOS-BASICOS')!, 'TITULO-DO-ARTIGO', 'Editado');
    expect(replaceProduction(doc, 33, edited)).toBe(true);
    expect(replaceProduction(doc, 99, edited)).toBe(false);
    expect(findBySequencia(doc, 33)).toBe(edited);
    expect(nextSequencia(doc, 0)).toBe(34);
    expect(nextSequencia(doc, 40)).toBe(40);
  });

  it('formata data e hora com zeros à esquerda', () => {
    expect(lattesTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toEqual({
      date: '02012026',
      time: '030405',
    });
  });
});

describe('áreas do conhecimento', () => {
  const DESIGN = {
    area: 'Desenho Industrial',
    bigArea: 'CIENCIAS_SOCIAIS_APLICADAS',
    specialty: '',
    subArea: 'Programação Visual',
  };

  it('grava até 3 áreas no formato do item aceito em 10/10/2026; sem áreas, o bloco sai', () => {
    const item = newItem(schema, 'TRABALHO-EM-EVENTOS', 33);
    const empty = { area: '', bigArea: '', specialty: '', subArea: '' };
    setAreas(schema, item, [DESIGN, empty, DESIGN, DESIGN, DESIGN]);
    expect(readAreas(item)).toEqual([DESIGN, DESIGN, DESIGN]);
    const xml = serializeXml({ epilog: '', prolog: '', root: item });
    expect(xml).toContain(
      '<AREAS-DO-CONHECIMENTO><AREA-DO-CONHECIMENTO-1 NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_SOCIAIS_APLICADAS" NOME-DA-AREA-DO-CONHECIMENTO="Desenho Industrial" NOME-DA-SUB-AREA-DO-CONHECIMENTO="Programação Visual" NOME-DA-ESPECIALIDADE=""/>',
    );
    expect(findOrderViolations(schema, item)).toEqual([]);
    setAreas(schema, item, [empty]);
    expect(readAreas(item)).toEqual([]);
    expect(serializeXml({ epilog: '', prolog: '', root: item })).not.toContain(
      'AREAS-DO-CONHECIMENTO',
    );
  });

  it('lista as áreas já usadas, das mais frequentes', () => {
    const doc = parseXml(`<CURRICULO-VITAE>
      <DADOS-GERAIS><AREAS-DE-ATUACAO><AREA-DE-ATUACAO SEQUENCIA-AREA-DE-ATUACAO="1" NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_EXATAS_E_DA_TERRA" NOME-DA-AREA-DO-CONHECIMENTO="Ciência da Computação" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE=""/></AREAS-DE-ATUACAO></DADOS-GERAIS>
      <X><AREAS-DO-CONHECIMENTO><AREA-DO-CONHECIMENTO-1 NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_SOCIAIS_APLICADAS" NOME-DA-AREA-DO-CONHECIMENTO="Desenho Industrial" NOME-DA-SUB-AREA-DO-CONHECIMENTO="Programação Visual" NOME-DA-ESPECIALIDADE=""/></AREAS-DO-CONHECIMENTO></X>
      <Y><AREAS-DO-CONHECIMENTO><AREA-DO-CONHECIMENTO-1 NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_SOCIAIS_APLICADAS" NOME-DA-AREA-DO-CONHECIMENTO="Desenho Industrial" NOME-DA-SUB-AREA-DO-CONHECIMENTO="Programação Visual" NOME-DA-ESPECIALIDADE=""/><AREA-DO-CONHECIMENTO-2 NOME-GRANDE-AREA-DO-CONHECIMENTO="" NOME-DA-AREA-DO-CONHECIMENTO="" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE=""/></AREAS-DO-CONHECIMENTO></Y>
    </CURRICULO-VITAE>`);
    expect(knownAreas(doc).map((a) => a.area)).toEqual([
      'Desenho Industrial',
      'Ciência da Computação',
    ]);
  });
});
