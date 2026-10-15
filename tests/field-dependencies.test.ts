// Campo que decide as opções de outros vem antes deles no formulário, na
// ordem da prévia e na do Lattes.

import { describe, expect, it } from 'vitest';

import { attributeLabel } from '../src/labels/labels.ts';
import { parseXml, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { controllersFirst, dependenciesOf } from '../src/ui/field-dependencies.ts';
import { codeAttrFor, type FieldEntry, groupFields } from '../src/ui/field-kind.ts';
import { previewSlots } from '../src/ui/preview-order.ts';

const el = (xml: string) => parseXml(xml).root;

/** A ordem dos campos (sem os códigos) na prévia ou no Lattes. */
function order(item: XElement, mode: 'previa' | 'lattes', kind: 'record' | 'academic' = 'record') {
  const entries: FieldEntry[] = lattesSchema.elements[item.name]!.attributes.map((a) => ({
    attr: a.name,
    element: item.name,
    key: a.name,
  }));
  const slot = mode === 'previa' ? previewSlots(item, kind) : undefined;
  return groupFields(
    entries,
    attributeLabel,
    () => false,
    undefined,
    slot ? (e) => slot(item, e.attr) : undefined,
  )
    .filter((g) => !g.system)
    .map((g) => [g.label, g.entries.map((e) => e.attr)] as const);
}

const AREA = `<AREA-DE-ATUACAO NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_BIOLOGICAS"
  NOME-DA-AREA-DO-CONHECIMENTO="Genética" NOME-DA-SUB-AREA-DO-CONHECIMENTO=""
  NOME-DA-ESPECIALIDADE="Genômica"/>`;

describe('quem decide vem antes', () => {
  it('área de atuação: grande área, área, subárea, especialidade, nas duas ordens', () => {
    const chain = [
      'NOME-GRANDE-AREA-DO-CONHECIMENTO',
      'NOME-DA-AREA-DO-CONHECIMENTO',
      'NOME-DA-SUB-AREA-DO-CONHECIMENTO',
      'NOME-DA-ESPECIALIDADE',
    ];
    for (const mode of ['previa', 'lattes'] as const) {
      const attrs = order(el(AREA), mode).flatMap(([, a]) => a);
      expect(
        attrs.filter((a) => chain.includes(a)),
        mode,
      ).toEqual(chain);
    }
    // Na prévia, a grande área entra no grupo da área, logo antes dela.
    expect(order(el(AREA), 'previa')[0]![1].slice(0, 2)).toEqual(chain.slice(0, 2));
  });

  it('evento: a forma de participação antes do tipo', () => {
    expect(dependenciesOf('DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO')).toContainEqual([
      'FORMA-PARTICIPACAO',
      ['TIPO-PARTICIPACAO'],
    ]);
    const groups = groupFields(
      ['TIPO-PARTICIPACAO', 'NOME-DO-EVENTO', 'FORMA-PARTICIPACAO'].map((attr) => ({
        attr,
        element: 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO',
        key: attr,
      })),
      attributeLabel,
      () => false,
      undefined,
      // Uma prévia que mostrasse o tipo antes da forma.
      (e) => ({
        label: 'Principal',
        rank: ['TIPO-PARTICIPACAO', 'NOME-DO-EVENTO', 'FORMA-PARTICIPACAO'].indexOf(e.attr),
      }),
    );
    expect(groups[0]!.entries.map((e) => e.attr)).toEqual([
      'FORMA-PARTICIPACAO',
      'TIPO-PARTICIPACAO',
      'NOME-DO-EVENTO',
    ]);
  });

  it('formação: o tipo de doutorado antes dos campos do sanduíche e da cotutela', () => {
    const doutorado = el(
      '<DOUTORADO NOME-CURSO="Genética" NOME-INSTITUICAO="UFRGS" ANO-DE-INICIO="2011" TIPO-DOUTORADO="" NOME-INSTITUICAO-DOUT="" NOME-ORIENTADOR-DOUT=""/>',
    );
    for (const mode of ['previa', 'lattes'] as const) {
      const attrs = order(doutorado, mode, 'academic').flatMap(([, a]) => a);
      expect(attrs.indexOf('TIPO-DOUTORADO'), mode).toBeLessThan(
        attrs.indexOf('NOME-INSTITUICAO-DOUT'),
      );
    }
    expect(dependenciesOf('ESPECIALIZACAO')[0]![0]).toBe('TIPO-GRADUACAO');
    expect(dependenciesOf('PREMIO-TITULO')).toEqual([]);
  });

  it('quem já vem antes fica onde está; o código acompanha o nome; grupo vazio some', () => {
    const entry = (attr: string): FieldEntry => ({ attr, element: 'AREA-DE-ATUACAO', key: attr });
    const groups = controllersFirst(
      [
        { entries: [entry('NOME-DA-AREA-DO-CONHECIMENTO')], label: 'A', system: false },
        { entries: [entry('NOME-GRANDE-AREA-DO-CONHECIMENTO')], label: 'B', system: false },
      ],
      codeAttrFor,
    );
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.attr)])).toEqual([
      ['A', ['NOME-GRANDE-AREA-DO-CONHECIMENTO', 'NOME-DA-AREA-DO-CONHECIMENTO']],
    ]);
    const formation = (attr: string): FieldEntry => ({ attr, element: 'MESTRADO', key: attr });
    const paired = controllersFirst(
      [
        { entries: [formation('NOME-INSTITUICAO-DOUT')], label: 'S', system: false },
        {
          entries: [formation('TIPO-MESTRADO'), formation('NOME-CURSO')],
          label: 'D',
          system: false,
        },
      ],
      codeAttrFor,
    );
    expect(paired[0]!.entries.map((e) => e.attr)).toEqual([
      'TIPO-MESTRADO',
      'NOME-INSTITUICAO-DOUT',
    ]);
  });
});
