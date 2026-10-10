import { describe, expect, it } from 'vitest';

import { attributeLabel, elementLabel, enumLabel, fold } from '../src/labels/labels.ts';
import { findOrderViolations, insertInSchemaOrder } from '../src/model/schema-order.ts';
import {
  childElements,
  cloneElement,
  element,
  escapeText,
  parseXml,
  serializeXml,
  setAttr,
  XmlParseError,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { summarize } from '../src/ui/summary.ts';

describe('rótulos', () => {
  it('usa o rótulo escrito à mão quando existe', () => {
    expect(elementLabel('ARTIGOS-PUBLICADOS')).toBe('Artigos completos publicados');
    expect(attributeLabel('NRO-ID-CNPQ')).toBe('ID Lattes');
    expect(enumLabel('NAO')).toBe('Não');
  });

  it('humaniza o nome XML com acentos e siglas', () => {
    expect(attributeLabel('TITULO-DO-TRABALHO')).toBe('Título do trabalho');
    expect(attributeLabel('ISSN-DO-PERIODICO')).toBe('ISSN do periódico');
    expect(enumLabel('MEIO_DIGITAL')).toBe('Meio digital');
    expect(elementLabel('PARTICIPACAO-EM-BANCA-DE-MESTRADO')).toBe(
      'Participação em banca de mestrado',
    );
    expect(attributeLabel('---')).toBe('---');
  });

  it('dobra acentos e caixa para busca', () => {
    expect(fold('Formação Acadêmica')).toBe('formacao academica');
  });
});

describe('summarize', () => {
  it('junta título dos dados básicos e ano', () => {
    const item = parseXml(
      '<TRABALHO-EM-EVENTOS><DADOS-BASICOS-DO-TRABALHO TITULO-DO-TRABALHO="Um título" TITULO-DO-TRABALHO-INGLES="A title" ANO-DO-TRABALHO="2025"/></TRABALHO-EM-EVENTOS>',
    ).root;
    expect(summarize(item)).toBe('Um título · 2025');
  });

  it('cai para nome e depois descrição; vazio sem nada', () => {
    expect(summarize(parseXml('<X NOME-INSTITUICAO="UFPel"/>').root)).toBe('UFPel');
    expect(summarize(parseXml('<X DESCRICAO="Algo" ANO=""/>').root)).toBe('Algo');
    expect(summarize(parseXml('<X OUTRO="1"/>').root)).toBe('');
  });
});

describe('ordem do schema, casos de borda', () => {
  it('pai ou filho desconhecido vai para o fim', () => {
    const unknownParent = element('NAO-EXISTE');
    insertInSchemaOrder(lattesSchema, unknownParent, element('A'));
    insertInSchemaOrder(lattesSchema, unknownParent, element('B'));
    expect(childElements(unknownParent).map((c) => c.name)).toEqual(['A', 'B']);

    const pb = parseXml(
      '<PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS/></PRODUCAO-BIBLIOGRAFICA>',
    ).root;
    insertInSchemaOrder(lattesSchema, pb, element('FORA-DO-SCHEMA'));
    expect(childElements(pb).at(-1)?.name).toBe('FORA-DO-SCHEMA');
  });

  it('ignora texto entre filhos ao calcular a posição e aponta elemento desconhecido', () => {
    const pb = parseXml(
      '<PRODUCAO-BIBLIOGRAFICA>\n  <ARTIGOS-PUBLICADOS/>\n  <NOVO/>\n</PRODUCAO-BIBLIOGRAFICA>',
    ).root;
    insertInSchemaOrder(lattesSchema, pb, element('TRABALHOS-EM-EVENTOS'));
    expect(childElements(pb)[0]?.name).toBe('TRABALHOS-EM-EVENTOS');
    expect(findOrderViolations(lattesSchema, pb)).toEqual([
      'PRODUCAO-BIBLIOGRAFICA/NOVO: elemento fora do schema',
    ]);
  });
});

describe('XML, casos de borda', () => {
  it('preserva BOM, DOCTYPE com subconjunto, PI e comentários dentro e fora da raiz', () => {
    const src =
      '﻿<?xml version="1.0"?><!DOCTYPE A [<!ELEMENT A ANY>]><?pi x?><A><!-- c --><?pi y?>t</A><!-- fim -->';
    expect(serializeXml(parseXml(src))).toBe(src);
  });

  it('aceita aspas simples e espaços em volta do "="', () => {
    const doc = parseXml("<A X = 'um' ></A >");
    expect(serializeXml(doc)).toBe('<A X="um"></A>');
  });

  it('setAttr cria atributo novo e cloneElement copia fundo', () => {
    const el = element('A', [{ name: 'X', value: '1' }]);
    setAttr(el, 'Y', '2');
    const copy = cloneElement(el);
    setAttr(copy, 'X', '9');
    expect(serializeXml({ epilog: '', prolog: '', root: el })).toBe('<A X="1" Y="2"/>');
  });

  it('escapa texto', () => {
    expect(escapeText('a<b>&\r')).toBe('a&lt;b&gt;&amp;&#13;');
  });

  it('serializa CDATA e texto em elementos novos', () => {
    const el = element('A', {}, [
      { kind: 'cdata', value: 'x' },
      { kind: 'text', value: '<' },
      { kind: 'raw', value: '<!--r-->' },
      element('B'),
    ]);
    expect(serializeXml({ epilog: '', prolog: '', root: el })).toBe(
      '<A><![CDATA[x]]>&lt;<!--r--><B/></A>',
    );
  });

  it.each([
    ['', 'sem elemento raiz'],
    ['<A B="1/>', 'sem fechamento'],
    ['<A B=1/>', 'Aspas esperadas'],
    ['<A B/>', "'=' esperado"],
    ['<A B="<"/>', "'<' dentro"],
    ['<A></A x>', "'>' esperado"],
    ['<A>&amp</A>', "sem ';'"],
    ['<A><!-- x</A>', 'Comentário sem fechamento'],
    ['<!DOCTYPE A [', 'DOCTYPE sem fechamento'],
    ['<1/>', 'Nome esperado'],
    ['<A>texto', 'sem fechamento'],
  ])('rejeita %j', (src, message) => {
    expect(() => parseXml(src)).toThrow(XmlParseError);
    expect(() => parseXml(src)).toThrow(message);
  });
});
