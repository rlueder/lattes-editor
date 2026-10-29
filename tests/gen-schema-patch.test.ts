// O patch do XSD (scripts/gen-schema.ts): os valores de enumerado entram na
// restrição do próprio atributo, e um atributo sem restrição própria para a
// geração em vez de pôr os valores na de outro.

import { describe, expect, it } from 'vitest';

import { patchXsdText } from '../scripts/gen-schema.ts';

const XSD = `<xs:element name="LICENCA">
  <xs:complexType>
    <xs:attribute name="TIPO-LICENCA">
      <xs:simpleType>
        <xs:restriction base="xs:string">
          <xs:enumeration value="MATERNIDADE"/>
        </xs:restriction>
      </xs:simpleType>
    </xs:attribute>
    <xs:attribute name="SEM-RESTRICAO" type="xs:string"/>
  </xs:complexType>
</xs:element>
<xs:element name="OUTRO">
  <xs:complexType>
    <xs:attribute name="X">
      <xs:simpleType>
        <xs:restriction base="xs:string">
          <xs:enumeration value="A"/>
        </xs:restriction>
      </xs:simpleType>
    </xs:attribute>
  </xs:complexType>
</xs:element>
`;

const patch = (attribute: string) => ({
  attributes: [],
  enumValues: [{ attribute, element: 'LICENCA', values: ['ADOCAO'] }],
});

describe('o patch de enumerados do XSD', () => {
  it('põe o valor na restrição do próprio atributo', () => {
    const out = patchXsdText(XSD, patch('TIPO-LICENCA'));
    const licenca = out.slice(0, out.indexOf('<xs:element name="OUTRO">'));
    expect(licenca).toContain('<xs:enumeration value="ADOCAO"/>');
    expect(licenca.indexOf('ADOCAO')).toBeLessThan(licenca.indexOf('</xs:restriction>'));
  });

  it('atributo sem restrição própria para, sem tocar outro elemento', () => {
    expect(() =>
      patchXsdText(
        XSD.replace(
          'name="SEM-RESTRICAO" type="xs:string"/>',
          'name="SEM-RESTRICAO">\n    </xs:attribute>',
        ),
        patch('SEM-RESTRICAO'),
      ),
    ).toThrow(/sem xs:restriction própria/);
  });
});
