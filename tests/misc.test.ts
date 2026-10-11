import { describe, expect, it } from 'vitest';

import { attributeLabel, elementLabel, enumLabel, fold, slugify } from '../src/labels/labels.ts';
import { repairMojibake } from '../src/model/mojibake.ts';
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
import { groupFields, isBooleanAttr, isSystemAttr } from '../src/ui/field-kind.ts';
import { formatLattesDate } from '../src/ui/format.ts';
import { parseHash } from '../src/ui/hash-route.ts';

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

describe('formatLattesDate', () => {
  it('DDMMAAAA vira DD/MM/AAAA; o resto fica de fora', () => {
    expect(formatLattesDate('17082026')).toBe('17/08/2026');
    expect(formatLattesDate('2026-08-17')).toBeUndefined();
    expect(formatLattesDate(undefined)).toBeUndefined();
  });
});

describe('repairMojibake', () => {
  it('desfaz UTF-8 lido como Latin-1; deixa o resto em paz', () => {
    expect(repairMojibake('EndereÃ§o: http://x')).toBe('Endereço: http://x');
    expect(repairMojibake('Endereço')).toBeUndefined();
    expect(repairMojibake('Ã solta')).toBeUndefined();
    expect(repairMojibake('Ã§ e — fora do Latin-1')).toBeUndefined();
    expect(repairMojibake('miolo do livro &quot;Eu, criminalista&quot;')).toBe(
      'miolo do livro "Eu, criminalista"',
    );
    expect(repairMojibake('A &amp; B &#233; &#xE7;')).toBe('A & B é ç');
    expect(repairMojibake('EndereÃ§o &quot;x&quot;')).toBe('Endereço "x"');
    expect(repairMojibake('A & B')).toBeUndefined();
  });
});

describe('parseHash', () => {
  it('seção, grupo e ano; acentos codificados; vazio e inválido', () => {
    expect(parseHash('#dados-gerais')).toEqual({ sectionId: 'dados-gerais' });
    expect(parseHash('#atuacao/atuacao-profissional/2020')).toEqual({
      anchor: 'atuacao/atuacao-profissional/2020',
      sectionId: 'atuacao',
    });
    expect(parseHash('#outros/pa%C3%ADs')).toEqual({ anchor: 'outros/país', sectionId: 'outros' });
    expect(parseHash('')).toBeUndefined();
    expect(parseHash('#%E0%A4%A')).toBeUndefined();
  });
});

describe('slugify', () => {
  it('rótulo vira trecho de URL', () => {
    expect(slugify('Participação em eventos, congressos, exposições e feiras')).toBe(
      'participacao-em-eventos-congressos-exposicoes-e-feiras',
    );
  });
});

describe('tipo de campo', () => {
  it('códigos e sequências do Lattes são só leitura; NIVEL só na formação', () => {
    expect(isSystemAttr('MESTRADO', 'CODIGO-INSTITUICAO')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'SEQUENCIA-FORMACAO')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'CODIGO-CURSO-CAPES')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'NIVEL')).toBe(true);
    expect(isSystemAttr('IDIOMA', 'NIVEL')).toBe(false);
    expect(isSystemAttr('MESTRADO', 'NOME-INSTITUICAO')).toBe(false);
  });

  it('sim/não: enum SIM/NAO ou FLAG-* em texto com SIM/NAO', () => {
    const yesNo = { enum: ['SIM', 'NAO'], name: 'X', required: false };
    expect(isBooleanAttr('PERMISSAO-DE-DIVULGACAO', yesNo, 'NAO')).toBe(true);
    expect(isBooleanAttr('FLAG-BOLSA', undefined, 'NAO')).toBe(true);
    expect(isBooleanAttr('FLAG-BOLSA', undefined, '')).toBe(true);
    expect(isBooleanAttr('FLAG-BOLSA', undefined, 'TALVEZ')).toBe(false);
    expect(
      isBooleanAttr(
        'FLAG-PERIODO',
        { enum: ['ANTERIOR', 'ATUAL'], name: 'FLAG-PERIODO', required: false },
        'ATUAL',
      ),
    ).toBe(false);
    expect(isBooleanAttr('NOME', undefined, 'SIM')).toBe(false);
  });
});

describe('groupFields', () => {
  it('assunto primeiro, depois rótulo; início antes de fim; sim/não e códigos no fim', () => {
    const names = [
      'SEQUENCIA-FORMACAO',
      'NIVEL',
      'CODIGO-INSTITUICAO',
      'NOME-INSTITUICAO',
      'CODIGO-CURSO',
      'NOME-CURSO',
      'CODIGO-AREA-CURSO',
      'STATUS-DO-CURSO',
      'ANO-DE-INICIO',
      'ANO-DE-CONCLUSAO',
      'FLAG-BOLSA',
      'NOME-COMPLETO-DO-ORIENTADOR',
      'TIPO-MESTRADO',
      'CODIGO-CURSO-CAPES',
      'NOME-CURSO-INGLES',
    ];
    const entries = names.map((attr) => ({ attr, element: 'MESTRADO', key: attr }));
    const groups = groupFields(entries, attributeLabel, (e) => e.attr === 'FLAG-BOLSA');
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.attr)])).toEqual([
      ['Principal', ['NOME-CURSO', 'NOME-CURSO-INGLES', 'STATUS-DO-CURSO', 'TIPO-MESTRADO']],
      ['Instituição', ['NOME-INSTITUICAO']],
      ['Período', ['ANO-DE-INICIO', 'ANO-DE-CONCLUSAO']],
      ['Pessoas', ['NOME-COMPLETO-DO-ORIENTADOR']],
      ['Marcações', ['FLAG-BOLSA']],
      [
        'Códigos do Lattes',
        [
          'CODIGO-AREA-CURSO',
          'CODIGO-CURSO',
          'CODIGO-CURSO-CAPES',
          'CODIGO-INSTITUICAO',
          'NIVEL',
          'SEQUENCIA-FORMACAO',
        ],
      ],
    ]);
    expect(groups.at(-1)!.system).toBe(true);
    expect(attributeLabel('FLAG-BOLSA')).toBe('Bolsa');
  });
});

describe('acentos por sufixo', () => {
  it('corrige terminações regulares fora do dicionário', () => {
    expect(enumLabel('ORGANIZACAO_DE_EVENTO')).toBe('Organização de evento');
    expect(enumLabel('ELABORACAO_DE_PROJETO')).toBe('Elaboração de projeto');
    expect(attributeLabel('FREQUENCIA-DE-SESSOES')).toBe('Frequência de sessões');
    expect(elementLabel('MANUTENCAO-DE-OBRA-ARTISTICA')).toBe('Manutenção de obra artística');
    expect(attributeLabel('CASA')).toBe('Casa');
  });
});
