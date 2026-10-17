import { describe, expect, it, vi } from 'vitest';

import {
  attributeLabel,
  attributeLabelIn,
  elementLabel,
  enumLabel,
  fold,
  isOpaqueCode,
  slugify,
} from '../src/labels/labels.ts';
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
import { formatPhone, parseEmails, parseSocial, socialName } from '../src/ui/contacts.ts';
import { displayValue } from '../src/ui/display.ts';
import {
  codeAttrFor,
  codeChoices,
  codeValueLabel,
  flagAsShown,
  flagLabel,
  flagToXml,
  groupFields,
  isBooleanAttr,
  isInvertedFlag,
  isSystemAttr,
} from '../src/ui/field-kind.ts';
import { formatLattesDate } from '../src/ui/format.ts';
import { parseHash } from '../src/ui/hash-route.ts';
import { pendingMessage } from '../src/ui/pending.ts';
import { isSensitiveAttr, readHideSensitive, writeHideSensitive } from '../src/ui/privacy.ts';
import { initials, photoUrl, readCvCode, writeCvCode } from '../src/ui/profile.ts';
import { qrMatrix, qrPath, qrSvg } from '../src/ui/qr.ts';
import { displayValue as readingValue } from '../src/ui/reading.ts';
import { GO_KEYS, isTyping, sectionForKey } from '../src/ui/use-section-shortcuts.ts';

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
  it('códigos, sequências e níveis do Lattes são só leitura', () => {
    expect(isSystemAttr('MESTRADO', 'CODIGO-INSTITUICAO')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'SEQUENCIA-FORMACAO')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'CODIGO-CURSO-CAPES')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'NIVEL')).toBe(true);
    expect(isSystemAttr('OUTROS', 'NIVEL')).toBe(true);
    expect(isSystemAttr('FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO', 'NIVEL')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'TIPO-MESTRADO')).toBe(false);
    expect(isSystemAttr('INFORMACAO-ADICIONAL-CURSO', 'NIVEL-CURSO')).toBe(true);
    expect(isSystemAttr('MESTRADO', 'NOME-INSTITUICAO')).toBe(false);
    expect(isSystemAttr('DADOS-GERAIS', 'SIGLA-PAIS-NACIONALIDADE')).toBe(true);
    expect(isSystemAttr('INFORMACAO-ADICIONAL-INSTITUICAO', 'SIGLA-PAIS-INSTITUICAO')).toBe(true);
    expect(isSystemAttr('INFORMACAO-ADICIONAL-INSTITUICAO', 'SIGLA-INSTITUICAO')).toBe(true);
    expect(isSystemAttr('CURRICULO-VITAE', 'DATA-ATUALIZACAO')).toBe(true);
    expect(isSystemAttr('DADOS-GERAIS', 'ORCID-ID')).toBe(true);
    expect(isSystemAttr('DADOS-GERAIS', 'CPF')).toBe(true);
    expect(isSystemAttr('AUTORES', 'CPF')).toBe(false);
    expect(isSystemAttr('DADOS-GERAIS', 'UF-NASCIMENTO')).toBe(false);
  });

  it('nível e tipo de mestrado aparecem pelo nome, como no formulário do Lattes', () => {
    expect(codeValueLabel('OUTROS', 'NIVEL', 'Y')).toBe('Outros');
    expect(codeValueLabel('FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO', 'NIVEL', 'F')).toBe(
      'Curso de curta duração',
    );
    expect(codeValueLabel('MESTRADO', 'NIVEL', '3')).toBe(elementLabel('MESTRADO'));
    expect(codeValueLabel('MESTRADO', 'TIPO-MESTRADO', 'S')).toBe('Sanduíche');
    expect(codeValueLabel('X', 'NIVEL', 'Q')).toBe('Q');
    expect(codeChoices('MESTRADO', 'TIPO-MESTRADO')).toEqual([
      { label: 'Normal', value: 'N' },
      { label: 'Sanduíche', value: 'S' },
    ]);
    expect(codeChoices('DADOS-GERAIS', 'NACIONALIDADE')).toBeUndefined();
    expect(codeChoices('MESTRADO', 'NOME-CURSO')).toBeUndefined();
  });

  it('nenhuma lista mostra código sem rótulo num campo editável', () => {
    const leaks: string[] = [];
    for (const [element, spec] of Object.entries(lattesSchema.elements)) {
      for (const a of spec.attributes) {
        for (const v of a.enum ?? []) {
          if (isOpaqueCode(v) && !isSystemAttr(element, a.name)) {
            leaks.push(`${element} ${a.name}=${v}`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
    expect(isOpaqueCode('OT')).toBe(true);
    expect(isOpaqueCode('SIM')).toBe(false);
    expect(isOpaqueCode('OUTRO')).toBe(false);
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
  it('assunto primeiro, depois rótulo; código ao lado do nome; o resto dos códigos no fim', () => {
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
    // Elemento sem formulário conhecido no Lattes: vale a ordem por assunto.
    const entries = names.map((attr) => ({ attr, element: 'SEM-FORMULARIO', key: attr }));
    const groups = groupFields(entries, attributeLabel, (e) => e.attr === 'FLAG-BOLSA');
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.attr)])).toEqual([
      [
        'Principal',
        ['NOME-CURSO', 'CODIGO-CURSO', 'NOME-CURSO-INGLES', 'STATUS-DO-CURSO', 'TIPO-MESTRADO'],
      ],
      ['Instituição', ['NOME-INSTITUICAO', 'CODIGO-INSTITUICAO']],
      ['Período', ['ANO-DE-INICIO', 'ANO-DE-CONCLUSAO']],
      ['Pessoas', ['NOME-COMPLETO-DO-ORIENTADOR']],
      ['Marcações', ['FLAG-BOLSA']],
      [
        'Códigos do Lattes',
        ['CODIGO-AREA-CURSO', 'CODIGO-CURSO-CAPES', 'NIVEL', 'SEQUENCIA-FORMACAO'],
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

describe('displayValue', () => {
  it('código de enum vira rótulo; texto livre fica como está', () => {
    expect(displayValue('DADOS-BASICOS-DO-TRABALHO', 'MEIO-DE-DIVULGACAO', 'MEIO_DIGITAL')).toBe(
      'Meio digital',
    );
    expect(displayValue('DADOS-BASICOS-DO-TRABALHO', 'TITULO-DO-TRABALHO', 'A_B')).toBe('A_B');
    expect(displayValue('X', 'Y', '')).toBe('');
  });

  it('enum de outro elemento (STATUS-DO-CURSO no pós-doutorado) vira rótulo, como na leitura', () => {
    expect(displayValue('POS-DOUTORADO', 'STATUS-DO-CURSO', 'EM_ANDAMENTO')).toBe('Em andamento');
    const pos = parseXml('<POS-DOUTORADO STATUS-DO-CURSO="CONCLUIDO"/>').root;
    expect(displayValue('POS-DOUTORADO', 'STATUS-DO-CURSO', 'CONCLUIDO')).toBe(
      readingValue(pos, 'STATUS-DO-CURSO', 'CONCLUIDO'),
    );
  });

  it('marca sim/não sem enum no schema (FLAG-BOLSA) vira "Sim" e "Não", como na leitura', () => {
    expect(displayValue('MESTRADO-PROFISSIONALIZANTE', 'FLAG-BOLSA', 'NAO')).toBe('Não');
    expect(displayValue('MESTRADO-PROFISSIONALIZANTE', 'FLAG-BOLSA', 'SIM')).toBe('Sim');
    const mestrado = parseXml('<MESTRADO-PROFISSIONALIZANTE FLAG-BOLSA="NAO"/>').root;
    expect(readingValue(mestrado, 'FLAG-BOLSA', 'NAO')).toBe('Não');
    // FLAG-* com outros valores continua lista: vira o rótulo dela, não Sim/Não.
    expect(displayValue('X', 'FLAG-PERIODO', 'ATUAL')).toBe('Atual');
  });

  it('código escrito por extenso no Lattes, como na leitura', () => {
    expect(displayValue('MESTRADO', 'TIPO-MESTRADO', 'S')).toBe('Sanduíche');
  });
});

describe('flagLabel', () => {
  it('"Sim" e "Não" no sentido da tela; outro valor passa igual', () => {
    expect(flagLabel('X', 'FLAG-BOLSA', 'SIM')).toBe('Sim');
    expect(flagLabel('X', 'FLAG-BOLSA', 'NAO')).toBe('Não');
    expect(flagLabel('X', 'FLAG-BOLSA', '')).toBe('');
    expect(flagLabel('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', 'NAO')).toBe('Sim');
  });
});

describe('privacidade', () => {
  it('marca documentos, filiação e endereço residencial como sensíveis', () => {
    expect(isSensitiveAttr('DADOS-GERAIS', 'CPF')).toBe(true);
    expect(isSensitiveAttr('DADOS-GERAIS', 'NOME-DA-MAE')).toBe(true);
    expect(isSensitiveAttr('DADOS-GERAIS', 'RACA-OU-COR')).toBe(true);
    expect(isSensitiveAttr('ENDERECO-RESIDENCIAL', 'CEP')).toBe(true);
    expect(isSensitiveAttr('DADOS-GERAIS', 'NOME-COMPLETO')).toBe(false);
    expect(isSensitiveAttr('ENDERECO-PROFISSIONAL', 'CEP')).toBe(false);
    expect(isSensitiveAttr('AUTORES', 'CPF')).toBe(false);
  });

  it('lembra a escolha no navegador e começa escondendo', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(readHideSensitive()).toBe(true);
    expect(() => writeHideSensitive(true)).not.toThrow();
    vi.stubGlobal('localStorage', storage);
    writeHideSensitive(true);
    expect(readHideSensitive()).toBe(true);
    writeHideSensitive(false);
    expect(readHideSensitive()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('ordem do endereço', () => {
  it('agrupa instituição, endereço e contato uma vez cada, com DDD antes do telefone', () => {
    const attrs = ['TELEFONE', 'CEP', 'NOME-ORGAO', 'DDD', 'CIDADE', 'E-MAIL', 'CODIGO-ORGAO'];
    const groups = groupFields(
      attrs.map((attr) => ({ attr, element: 'ENDERECO-PROFISSIONAL', key: attr })),
      (a) => a,
      () => false,
    );
    expect(groups.map((g) => g.label)).toEqual(['Instituição', 'Localização', 'Contato']);
    expect(groups[0]!.entries.map((e) => e.attr)).toEqual(['NOME-ORGAO', 'CODIGO-ORGAO']);
    expect(groups[2]!.entries.map((e) => e.attr)).toEqual(['DDD', 'TELEFONE', 'E-MAIL']);
    expect(groups[1]!.entries.map((e) => e.attr)).toEqual(['CEP', 'CIDADE']);
  });
});

describe('contatos do endereço', () => {
  it('lê o e-mail com o código do endereço', () => {
    expect(parseEmails('I: nome@inst.br')).toEqual([
      { address: 'E-mail para contato', email: 'nome@inst.br' },
    ]);
    expect(parseEmails('R: outro@mail.br')[0]?.address).toBe('E-mail alternativo');
    expect(parseEmails('nome@inst.br')).toEqual([{ address: undefined, email: 'nome@inst.br' }]);
    expect(parseEmails('sem e-mail')).toEqual([]);
  });

  it('lê redes sociais, consertando o texto estragado', () => {
    expect(
      parseSocial('ID Rede Social: 7, Nome Rede Social: Linkedin, EndereÃ§o: https://x.org/a/'),
    ).toEqual([{ name: 'LinkedIn', url: 'https://x.org/a/' }]);
    expect(socialName('minha rede')).toBe('Minha rede');
    expect(parseSocial('qualquer coisa')).toEqual([]);
  });
});

describe('telefone', () => {
  it('junta DDD e número: 8 e 9 dígitos com hífen, sem DDD só o número', () => {
    expect(formatPhone('51', '33081234')).toBe('(51) 3308-1234');
    expect(formatPhone('51', '999991234')).toBe('(51) 99999-1234');
    expect(formatPhone('', '33081234')).toBe('3308-1234');
    expect(formatPhone('51', '1234')).toBe('(51) 1234');
  });
});

describe('perfil', () => {
  it('tira as iniciais do primeiro e do último nome', () => {
    expect(initials('Rafael Monteiro Lüder')).toBe('RL');
    expect(initials('Maria da Silva')).toBe('MS');
    expect(initials('Ana')).toBe('A');
  });
});

describe('foto do currículo', () => {
  it('monta o endereço da foto e lembra o código por currículo', () => {
    expect(photoUrl('K1234567A8')).toContain('servletrecuperafoto?tipo=1&id=K1234567A8');
    expect(readCvCode('1')).toBeUndefined();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => void store.delete(k),
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    writeCvCode('1', 'K1234567A8');
    expect(readCvCode('1')).toBe('K1234567A8');
    writeCvCode('1', undefined);
    expect(readCvCode('1')).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe('nome escolhido junto com o código', () => {
  it('liga o nome ao código da mesma lista do Lattes', () => {
    expect(codeAttrFor('IDIOMA', 'DESCRICAO-DO-IDIOMA')).toBe('IDIOMA');
    expect(codeAttrFor('MESTRADO', 'NOME-INSTITUICAO')).toBe('CODIGO-INSTITUICAO');
    expect(codeAttrFor('DOUTORADO', 'NOME-INSTITUICAO-OUTRA-DOUT')).toBe(
      'CODIGO-INSTITUICAO-OUTRA-DOUT',
    );
    expect(codeAttrFor('X', 'NOME-DA-INSTITUICAO')).toBe('CODIGO-INSTITUICAO');
    expect(codeAttrFor('MESTRADO', 'NOME-AGENCIA')).toBe('CODIGO-AGENCIA-FINANCIADORA');
    expect(codeAttrFor('DADOS-GERAIS', 'PAIS-DE-NACIONALIDADE')).toBe('SIGLA-PAIS-NACIONALIDADE');
    expect(codeAttrFor('MESTRADO', 'NOME-CURSO-INGLES')).toBeUndefined();
    expect(codeAttrFor('MESTRADO', 'TITULO-DA-DISSERTACAO-TESE')).toBeUndefined();
    expect(isSystemAttr('IDIOMA', 'IDIOMA')).toBe(true);
    expect(isSystemAttr('DADOS-BASICOS-DO-ARTIGO', 'IDIOMA')).toBe(false);
  });

  it('põe o idioma e o código lado a lado, com a proficiência depois', () => {
    const attrs = [
      'PROFICIENCIA-DE-FALA',
      'IDIOMA',
      'DESCRICAO-DO-IDIOMA',
      'PROFICIENCIA-DE-LEITURA',
    ];
    const groups = groupFields(
      attrs.map((attr) => ({ attr, element: 'IDIOMA', key: attr })),
      (a) => a,
      () => false,
    );
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.attr)])).toEqual([
      ['Idioma', ['DESCRICAO-DO-IDIOMA', 'IDIOMA']],
      ['Proficiência', ['PROFICIENCIA-DE-LEITURA', 'PROFICIENCIA-DE-FALA']],
    ]);
  });
});

describe('aviso de pendências', () => {
  it('conta alterações e itens novos no singular e no plural', () => {
    expect(pendingMessage(1, 0)).toBe('1 alteração ainda não está no Lattes.');
    expect(pendingMessage(3, 1)).toBe('3 alterações e 1 item novo ainda não estão no Lattes.');
    expect(pendingMessage(0, 2)).toBe('2 itens novos ainda não estão no Lattes.');
  });
});

describe('nacionalidade', () => {
  it('mostra o código por extenso, só leitura e privado', () => {
    expect(codeValueLabel('DADOS-GERAIS', 'NACIONALIDADE', 'B')).toBe('Brasileira');
    expect(codeValueLabel('DADOS-GERAIS', 'NACIONALIDADE', 'E')).toBe('Estrangeira');
    expect(codeValueLabel('DADOS-GERAIS', 'NACIONALIDADE', 'X')).toBe('X');
    expect(isSystemAttr('DADOS-GERAIS', 'NACIONALIDADE')).toBe(true);
    expect(isSensitiveAttr('DADOS-GERAIS', 'NACIONALIDADE')).toBe(true);
    expect(isSensitiveAttr('DADOS-GERAIS', 'PAIS-DE-NACIONALIDADE')).toBe(true);
  });
});

describe('atalhos G + letra', () => {
  it('acha a seção pela letra e ignora quem está digitando', () => {
    const ids = ['dados-gerais', 'producoes', 'bancas'];
    expect(sectionForKey('p', ids)).toBe('producoes');
    expect(sectionForKey('B', ids)).toBe('bancas');
    expect(sectionForKey('z', ids)).toBeUndefined();
    expect(new Set(Object.values(GO_KEYS)).size).toBe(Object.keys(GO_KEYS).length);
    expect(
      isTyping({ getAttribute: () => null, isContentEditable: false, tagName: 'INPUT' } as never),
    ).toBe(true);
    expect(
      isTyping({ getAttribute: () => null, isContentEditable: false, tagName: 'DIV' } as never),
    ).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe('código QR', () => {
  it('gera uma matriz quadrada e o SVG com margem', () => {
    const m = qrMatrix('https://lattes.cnpq.br/1234567890123456');
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    // Padrão de localização no canto: borda escura de 7 módulos.
    expect(m[0]!.slice(0, 7).every(Boolean)).toBe(true);
    expect(
      qrPath([
        [true, false],
        [false, true],
      ]),
    ).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
    expect(qrSvg('x')).toContain('<svg');
  });
});

describe('rótulos legíveis', () => {
  it('versão em inglês e nomes da formação', () => {
    expect(attributeLabel('TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO-INGLES')).toBe(
      'Título do trabalho de conclusão de curso em inglês',
    );
    expect(attributeLabel('NOME-CURSO-INGLES')).toBe('Nome do curso em inglês');
    expect(attributeLabel('TITULO-INGLES')).toBe('Título em inglês');
    expect(attributeLabel('NOME-DO-CO-ORIENTADOR')).toBe('Nome do coorientador');
    expect(attributeLabel('TIPO-GRADUACAO')).toBe('Tipo de graduação');
    expect(attributeLabel('NOME-DO-ORIENTADOR-SANDUICHE')).toBe('Nome do orientador sanduíche');
    // No doutorado, os campos -DOUT são os do sanduíche (exportação real com TIPO-DOUTORADO S).
    expect(attributeLabelIn('DOUTORADO', 'NOME-ORIENTADOR-DOUT')).toBe('Orientador no sanduíche');
    expect(attributeLabelIn('DOUTORADO', 'NOME-INSTITUICAO-DOUT')).toBe('Instituição do sanduíche');
    expect(attributeLabelIn('MESTRADO', 'NOME-ORIENTADOR-DOUT')).not.toBe(
      'Orientador no sanduíche',
    );
    expect(attributeLabel('NOME-DO-PREMIO-OU-TITULO')).toBe('Nome do prêmio ou título');
  });
});

describe('vínculo empregatício no sentido da tela do Lattes', () => {
  it('a exportação grava ao contrário: NAO no XML é "Sim" na tela, e a volta grava NAO', () => {
    expect(isInvertedFlag('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO')).toBe(true);
    expect(flagAsShown('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', 'NAO')).toBe('SIM');
    expect(flagAsShown('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', 'SIM')).toBe('NAO');
    expect(flagAsShown('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', '')).toBe('');
    expect(flagToXml('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', 'SIM')).toBe('NAO');
    // A dedicação exclusiva do mesmo vínculo não troca.
    expect(flagAsShown('VINCULOS', 'FLAG-DEDICACAO-EXCLUSIVA', 'SIM')).toBe('SIM');
  });

  it('a leitura e a grade mostram "Sim" onde o XML diz NAO', () => {
    const vinculo = parseXml(
      '<VINCULOS FLAG-VINCULO-EMPREGATICIO="NAO" FLAG-DEDICACAO-EXCLUSIVA="NAO"/>',
    ).root;
    expect(readingValue(vinculo, 'FLAG-VINCULO-EMPREGATICIO', 'NAO')).toBe('Sim');
    expect(readingValue(vinculo, 'FLAG-DEDICACAO-EXCLUSIVA', 'NAO')).toBe('Não');
  });
});

describe('vínculo empregatício na lista de alterações', () => {
  it('mostra o valor no sentido da tela do Lattes', () => {
    expect(displayValue('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', 'NAO')).toBe('Sim');
    expect(displayValue('VINCULOS', 'FLAG-VINCULO-EMPREGATICIO', 'SIM')).toBe('Não');
  });
});
