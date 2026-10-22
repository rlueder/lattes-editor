// Ordem "como na prévia" dos campos em edição e o ⚙ que escolhe entre ela e
// a ordem do Lattes.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { attributeLabel } from '../src/labels/labels.ts';
import { loadCv } from '../src/model/document.ts';
import { childElements, parseXml, setAttr, walk, type XElement } from '../src/model/xml.ts';
import { groupFields } from '../src/ui/field-kind.ts';
import { FIELD_ORDERS, parseFieldOrder } from '../src/ui/field-order.ts';
import {
  fillEmpty,
  PREVIEW_DETAILS,
  PREVIEW_MAIN,
  PREVIEW_REFERENCE,
  previewSlots,
} from '../src/ui/preview-order.ts';
import { cellSpan } from '../src/ui/reading.ts';
import { lineText } from '../src/ui/reading-layout.ts';
import { recordWhen } from '../src/ui/reading-records.ts';

const el = (xml: string) => parseXml(xml).root;
const opts = { hideSensitive: false, showCodes: false };

const DOUTORADO = `<DOUTORADO SEQUENCIA-FORMACAO="3" NIVEL="4" CODIGO-INSTITUICAO="" NOME-INSTITUICAO="UFRGS"
  NOME-CURSO="Genética" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2011" ANO-DE-CONCLUSAO="2015"
  FLAG-BOLSA="SIM" NOME-AGENCIA="CNPq" ANO-DE-OBTENCAO-DO-TITULO="2015" TITULO-DA-DISSERTACAO-TESE="Tese"
  NOME-COMPLETO-DO-ORIENTADOR="Helena" NOME-DO-CO-ORIENTADOR="" TIPO-DOUTORADO="" NOME-CURSO-INGLES=""/>`;

/** Os grupos e campos do bloco na ordem da prévia, sem os códigos. */
function previewGroups(item: XElement, kind: Parameters<typeof previewSlots>[1]) {
  const slot = previewSlots(item, kind);
  const entries = item.attrs.map((a) => ({ attr: a.name, element: item.name, key: a.name }));
  return groupFields(
    entries,
    attributeLabel,
    () => false,
    undefined,
    (e) => slot(item, e.attr),
  )
    .filter((g) => !g.system)
    .map((g) => [g.label, g.entries.map((e) => e.attr)] as const);
}

describe('ordem dos campos: ⚙', () => {
  it('como na prévia é o padrão; "lattes" guardado volta como Lattes', () => {
    expect(parseFieldOrder(null)).toBe('previa');
    expect(parseFieldOrder('qualquer')).toBe('previa');
    expect(parseFieldOrder('lattes')).toBe('lattes');
    expect(FIELD_ORDERS.map((o) => o.label)).toEqual(['Padrão LattesEditor', 'Como no Lattes']);
  });
});

describe('ordem dos campos: como na prévia', () => {
  it('formação: período, grau e curso, instituição, trabalho, orientação, bolsa, depois os detalhes', () => {
    const groups = previewGroups(el(DOUTORADO), 'academic');
    expect(groups[0]).toEqual([
      PREVIEW_MAIN,
      [
        'ANO-DE-INICIO',
        'ANO-DE-CONCLUSAO',
        'NOME-CURSO',
        'NOME-INSTITUICAO',
        // O código do Lattes vai ao lado do nome que acompanha.
        'CODIGO-INSTITUICAO',
        'TITULO-DA-DISSERTACAO-TESE',
        'NOME-COMPLETO-DO-ORIENTADOR',
        'NOME-DO-CO-ORIENTADOR',
        'NOME-AGENCIA',
      ],
    ]);
    expect(groups[1]![0]).toBe(PREVIEW_DETAILS);
    expect(groups[1]![1]).toContain('STATUS-DO-CURSO');
    expect(groups[1]![1]).toContain('NOME-CURSO-INGLES');
  });

  it('um campo vazio já está onde vai aparecer: preencher não o muda de lugar', () => {
    const empty = el(DOUTORADO);
    const filled = el(DOUTORADO);
    setAttr(filled, 'NOME-DO-CO-ORIENTADOR', 'Paulo');
    setAttr(filled, 'TIPO-DOUTORADO', 'S');
    expect(previewGroups(filled, 'academic')).toEqual(previewGroups(empty, 'academic'));
  });

  it('a cópia preenchida não mexe no original', () => {
    const item = el(DOUTORADO);
    const copy = fillEmpty(item);
    expect(copy).not.toBe(item);
    expect(item.attrs.find((a) => a.name === 'NOME-DO-CO-ORIENTADOR')!.value).toBe('');
    expect(copy.attrs.every((a) => a.value !== '')).toBe(true);
  });

  it('prêmio: ano, título e entidade no texto; o título em inglês nos detalhes', () => {
    const premio = el(
      '<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Menção" NOME-DA-ENTIDADE-PROMOTORA="UFRGS" ANO-DA-PREMIACAO="2015" NOME-DO-PREMIO-OU-TITULO-INGLES=""/>',
    );
    expect(previewGroups(premio, 'record')).toEqual([
      [
        PREVIEW_MAIN,
        ['ANO-DA-PREMIACAO', 'NOME-DO-PREMIO-OU-TITULO', 'NOME-DA-ENTIDADE-PROMOTORA'],
      ],
      [PREVIEW_DETAILS, ['NOME-DO-PREMIO-OU-TITULO-INGLES']],
    ]);
  });

  it('identificação: um bloco só, na ordem dos rótulos da prévia', () => {
    const dg = el(
      '<DADOS-GERAIS NOME-DO-PAI="" NOME-COMPLETO="Ana" SEXO="FEMININO" NOME-EM-CITACOES-BIBLIOGRAFICAS=""/>',
    );
    expect(previewGroups(dg, 'fields')).toEqual([
      [PREVIEW_MAIN, ['NOME-COMPLETO', 'NOME-EM-CITACOES-BIBLIOGRAFICAS', 'SEXO', 'NOME-DO-PAI']],
    ]);
  });

  it('produção: os campos da referência na ordem da citação, o resto nos detalhes', async () => {
    const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures/demo.xml')));
    const root = (await loadCv(bytes, 'demo.xml')).doc.root;
    let artigo: XElement | undefined;
    walk(root, (e) => {
      if (!artigo && e.name === 'ARTIGO-PUBLICADO') artigo = e;
    });
    const slot = previewSlots(artigo!, 'citation');
    const [basics, details] = ['DADOS-BASICOS', 'DETALHAMENTO'].map((p) =>
      childElements(artigo!).find((c) => c.name.startsWith(p))!,
    );
    expect(slot(basics!, 'TITULO-DO-ARTIGO')).toEqual({ label: PREVIEW_REFERENCE, rank: 0 });
    expect(slot(details!, 'TITULO-DO-PERIODICO-OU-REVISTA')!.label).toBe(PREVIEW_REFERENCE);
    expect(slot(basics!, 'TITULO-DO-ARTIGO')!.rank).toBeLessThan(
      slot(details!, 'PAGINA-INICIAL')!.rank,
    );
    expect(slot(details!, 'ISSN')!.label).toBe(PREVIEW_DETAILS);
    // Os autores ficam no quadro deles, fora da ordem da prévia.
    const autor = childElements(artigo!).find((c) => c.name === 'AUTORES')!;
    expect(slot(autor, 'NOME-COMPLETO-DO-AUTOR')).toBeUndefined();
    // O ano da coluna da esquerda leva a chave do campo nos dados básicos.
    const when = recordWhen(artigo!, false, opts)!;
    expect(lineText(when)).toBe('2024');
    expect(when.parts[0]!.key).toBe('1:ANO-DO-ARTIGO');
  });
});

describe('grade de rótulos', () => {
  it('valor curto numa coluna, médio em duas, longo na linha inteira', () => {
    expect(cellSpan('2015')).toBe(1);
    expect(cellSpan('x'.repeat(24))).toBe(1);
    expect(cellSpan('x'.repeat(25))).toBe(2);
    expect(cellSpan('x'.repeat(48))).toBe(2);
    expect(cellSpan('x'.repeat(49))).toBe(3);
  });
});
