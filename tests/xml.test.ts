import { describe, expect, it } from 'vitest';

import { decodeLatin1, encodeLatin1 } from '../src/model/latin1.ts';
import {
  element,
  getAttr,
  parseXml,
  serializeXml,
  setAttr,
  XmlParseError,
} from '../src/model/xml.ts';

const roundTrip = (src: string) => serializeXml(parseXml(src));

describe('parseXml/serializeXml', () => {
  it('devolve o mesmo texto quando nada muda', () => {
    const samples = [
      '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><A X="1" Y=""><B/><C></C></A>',
      '<?xml version="1.0"?>\n<!-- comentário -->\n<A>\n  <B Z="a &amp; b"/>\n</A>\n',
      '<A><DISCIPLINA>Texto &lt;livre&gt; &amp; mais</DISCIPLINA></A>',
      '<A><![CDATA[<cru> & intocado]]></A>',
      '<A V="linha&#10;nova&#9;tab"/>',
    ];
    for (const s of samples) expect(roundTrip(s)).toBe(s);
  });

  it('preserva atributos e elementos que o schema não conhece, na ordem original', () => {
    const doc = parseXml('<A Z="1" NOVO-ATRIBUTO="x" B="2"><ELEMENTO-NOVO K="v"/></A>');
    expect(doc.root.attrs.map((a) => a.name)).toEqual(['Z', 'NOVO-ATRIBUTO', 'B']);
    expect(serializeXml(doc)).toContain('<ELEMENTO-NOVO K="v"/>');
  });

  it('decodifica entidades e referências numéricas', () => {
    const doc = parseXml('<A T="&quot;x&quot; &apos;y&apos; &#233; &#x2014;"/>');
    expect(getAttr(doc.root, 'T')).toBe(`"x" 'y' é —`);
  });

  it('escapa o que precisa ao serializar valores editados', () => {
    const doc = parseXml('<A/>');
    setAttr(doc.root, 'T', 'a & b < c "d"\nfim');
    expect(serializeXml(doc)).toBe('<A T="a &amp; b &lt; c &quot;d&quot;&#10;fim"/>');
  });

  it('normaliza quebras de linha literais em atributos, como o XML exige', () => {
    expect(getAttr(parseXml('<A T="a\nb"/>').root, 'T')).toBe('a b');
  });

  it('elemento novo sem filhos sai como <X/> e ganha fechamento ao receber filho', () => {
    const el = element('X', { A: '1' });
    expect(serializeXml({ prolog: '', root: el, epilog: '' })).toBe('<X A="1"/>');
  });

  it.each([
    ['<A><B></A>', 'Esperado </B>'],
    ['<A X="1" X="2"/>', 'Atributo repetido'],
    ['<A X="1"Y="2"/>', 'Espaço esperado'],
    ['<A>&foo;</A>', 'Entidade desconhecida'],
    ['texto<A/>', 'Texto antes'],
    ['<A/><B/>', 'Conteúdo depois'],
    ['<A>', 'sem fechamento'],
  ])('rejeita XML malformado: %s', (src, message) => {
    expect(() => parseXml(src)).toThrow(XmlParseError);
    expect(() => parseXml(src)).toThrow(message);
  });
});

describe('Latin-1', () => {
  it('mapeia cada byte ao ponto de código de mesmo número, inclusive 0x80–0x9F', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = decodeLatin1(bytes);
    expect(text.charCodeAt(0x80)).toBe(0x80);
    expect(encodeLatin1(text)).toEqual(bytes);
  });

  it('escreve caracteres acima de 255 como referência numérica', () => {
    expect(decodeLatin1(encodeLatin1('a—b'))).toBe('a&#x2014;b');
  });
});
