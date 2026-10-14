// Composição do modo de leitura: a ordem dos campos é a de leitura, todo campo
// preenchido aparece na leitura, os vazios ficam no fim (obrigatórios
// primeiro), a referência acompanha o que se digita e o campo clicado é o que
// recebe o foco.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { childElements, firstChild, parseXml, walk, type XElement } from '../src/model/xml.ts';
import { hasReference } from '../src/print/references.ts';
import { focusTarget } from '../src/ui/reading.ts';
import { inlineKind, selectOptions } from '../src/ui/reading-field.ts';
import {
  addressLayout,
  editOrder,
  fieldsLayout,
  isFilled,
  isUsable,
  lineText,
  recordLayout,
  resumoLayout,
  rowRank,
  type Section,
  shownKeys,
} from '../src/ui/reading-layout.ts';
import {
  appearsIn,
  citationFields,
  citationRank,
  highlightMatches,
  liveReference,
  outsideReference,
  referenceHighlights,
  splitSegments,
  withDrafts,
} from '../src/ui/reading-reference.ts';
import { Sections } from '../src/ui/ReadingParts.tsx';

const el = (xml: string) => parseXml(xml).root;
const opts = { hideSensitive: false, showCodes: false };
const noLists = { courses: false, search: false };

const demo = async () => {
  const name = 'demo.xml';
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return (await loadCv(bytes, name)).doc.root;
};

/** Todo atributo preenchido e visível de um bloco, com a chave da composição. */
function filledKeys(root: XElement): string[] {
  const els: XElement[] = [];
  walk(root, (e) => {
    els.push(e);
  });
  return els.flatMap((e, i) =>
    e.attrs
      .filter((a) => a.value.trim() !== '' && isUsable(e, a.name, opts))
      .map((a) => `${i}:${a.name}`),
  );
}

const keysOf = (html: string, attr: string) =>
  [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((m) => m[1]!);

describe('modo de leitura: todo campo preenchido aparece na leitura', () => {
  it('prêmio mostra a entidade promotora na linha de apoio', () => {
    const premio = el(
      '<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Menção honrosa" NOME-DA-ENTIDADE-PROMOTORA="UFRGS" ANO-DA-PREMIACAO="2015" NOME-DO-PREMIO-OU-TITULO-INGLES=""/>',
    );
    const s = recordLayout(premio, false, opts);
    expect(lineText(s.when!)).toBe('2015');
    expect(s.lines.map(lineText)).toEqual(['Menção honrosa', 'UFRGS']);
    expect(s.rows).toEqual([]);
    expect(s.empty.map((p) => p.attr)).toEqual(['NOME-DO-PREMIO-OU-TITULO-INGLES']);
  });

  it('nos blocos de Dados gerais e Formação do currículo de demonstração', async () => {
    const root = await demo();
    const dg = firstChild(root, 'DADOS-GERAIS')!;
    const blocks: [XElement, Section[]][] = [
      [dg, fieldsLayout({ ...dg, children: [] }, opts)],
      [firstChild(dg, 'RESUMO-CV')!, resumoLayout(firstChild(dg, 'RESUMO-CV')!, opts)],
      [firstChild(dg, 'ENDERECO')!, addressLayout(firstChild(dg, 'ENDERECO')!, opts)],
    ];
    for (const list of ['IDIOMAS', 'PREMIOS-TITULOS', 'FORMACAO-ACADEMICA-TITULACAO']) {
      for (const item of childElements(firstChild(dg, list)!)) {
        blocks.push([item, [recordLayout(item, list === 'FORMACAO-ACADEMICA-TITULACAO', opts)]]);
      }
    }
    for (const [root, sections] of blocks) {
      const shown = shownKeys(sections);
      const elsewhere = new Set(['TEXTO-RESUMO-CV-RH', 'OUTRAS-INFORMACOES-RELEVANTES']);
      const expected = filledKeys(root.name === 'DADOS-GERAIS' ? { ...root, children: [] } : root)
        // Na identificação, o resumo é de outro grupo.
        .filter((k) => !(root.name === 'DADOS-GERAIS' && elsewhere.has(k.split(':')[1]!)));
      for (const key of expected) expect(shown, `${root.name} ${key}`).toContain(key);
    }
  });

  it('nas produções: na referência ou nas linhas de rótulo abaixo dela', async () => {
    const root = await demo();
    const items: XElement[] = [];
    walk(root, (e) => {
      if (e.attrs.some((a) => a.name === 'SEQUENCIA-PRODUCAO') && hasReference(e)) items.push(e);
    });
    expect(items.length).toBeGreaterThan(5);
    for (const item of items) {
      const ref = liveReference(item, new Map(), opts);
      const outside = new Set(outsideReference(item, opts).map((p) => p.key));
      const lit = new Set(ref.highlights.map((h) => h.key));
      for (const p of citationFields(item, opts).filled) {
        const shown =
          outside.has(p.key) ||
          lit.has(p.key) ||
          appearsIn(ref.text, p.el.attrs.find((a) => a.name === p.attr)!.value);
        expect(shown, `${item.name} ${p.key}`).toBe(true);
      }
    }
  });

  it('a privacidade esconde os sensíveis na leitura e na edição, contando quantos', () => {
    const dg = el(
      '<DADOS-GERAIS NOME-COMPLETO="Ana" NOME-DA-MAE="Marta" DATA-NASCIMENTO="03051986" NOME-DO-PAI=""/>',
    );
    const [s] = fieldsLayout(dg, { ...opts, hideSensitive: true });
    expect(s!.rows.map((p) => p.attr)).toEqual(['NOME-COMPLETO']);
    expect(s!.masked).toBe(2);
    expect(s!.empty.map((p) => p.attr)).not.toContain('NOME-DO-PAI');
  });
});

describe('modo de leitura: ordem dos campos na edição', () => {
  it('ordem de leitura, depois rótulos, e vazios por último', () => {
    const doutorado = el(
      '<DOUTORADO NOME-INSTITUICAO="UFRGS" NOME-CURSO="Genética" ANO-DE-INICIO="2011" ANO-DE-CONCLUSAO="2015" TITULO-DA-DISSERTACAO-TESE="Tese" NOME-COMPLETO-DO-ORIENTADOR="Helena" NOME-DO-CO-ORIENTADOR="" STATUS-DO-CURSO="CONCLUIDO" NOME-AGENCIA="CNPq" FLAG-BOLSA="SIM" ANO-DE-OBTENCAO-DO-TITULO="2015"/>',
    );
    const s = recordLayout(doutorado, true, opts);
    expect(lineText(s.when!)).toBe('2011 – 2015');
    expect(s.lines.map(lineText).filter(Boolean)).toEqual([
      'Doutorado em Genética',
      'UFRGS',
      'Tese',
      'Orientação: Helena',
      'Bolsa: CNPq',
    ]);
    expect(editOrder(s).map((p) => p.attr)).toEqual([
      'ANO-DE-INICIO',
      'ANO-DE-CONCLUSAO',
      'NOME-CURSO',
      'NOME-INSTITUICAO',
      'TITULO-DA-DISSERTACAO-TESE',
      'NOME-COMPLETO-DO-ORIENTADOR',
      'NOME-AGENCIA',
      'STATUS-DO-CURSO',
      'ANO-DE-OBTENCAO-DO-TITULO',
      'FLAG-BOLSA',
      'NOME-DO-CO-ORIENTADOR',
    ]);
  });

  it('os vazios obrigatórios (pelo schema) vêm primeiro no grupo dos vazios', () => {
    const dg = el(
      '<DADOS-GERAIS NUMERO-DO-PASSAPORTE="" NOME-COMPLETO="" NOME-DO-PAI="" NOME-EM-CITACOES-BIBLIOGRAFICAS="" PERMISSAO-DE-DIVULGACAO="" SEXO="FEMININO"/>',
    );
    const [s] = fieldsLayout(dg, opts);
    expect(s!.empty.map((p) => p.attr)).toEqual([
      'NOME-COMPLETO',
      'NOME-EM-CITACOES-BIBLIOGRAFICAS',
      'PERMISSAO-DE-DIVULGACAO',
      'NUMERO-DO-PASSAPORTE',
      'NOME-DO-PAI',
    ]);
  });

  it('a ordem dos rótulos não é a do XSD', () => {
    expect(rowRank('NOME-COMPLETO')).toBeLessThan(rowRank('NOME-DA-MAE'));
    expect(rowRank('NOME-DA-ENTIDADE')).toBeLessThan(rowRank('PAIS-DE-PUBLICACAO'));
    expect(rowRank('ANO-X')).toBeLessThan(rowRank('FLAG-X'));
    expect(rowRank('FLAG-X')).toBeLessThan(rowRank('ISSN'));
  });

  it('produção: autores, título, onde saiu, lugar, ano, volume, páginas, DOI, vazios no fim', async () => {
    const root = await demo();
    let artigo: XElement | undefined;
    walk(root, (e) => {
      if (!artigo && e.name === 'ARTIGO-PUBLICADO') artigo = e;
    });
    const f = citationFields(artigo!, opts);
    expect(f.authors.length).toBeGreaterThan(1);
    expect(f.authors[0]!.parts.map((p) => p.attr)).not.toContain('ORDEM-DE-AUTORIA');
    const ranks = f.filled.map((p) => citationRank(p.attr));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(f.filled[0]!.attr).toBe('TITULO-DO-ARTIGO');
    expect(f.empty.every((p) => !isFilled(p))).toBe(true);
    expect(citationRank('TITULO-DO-PERIODICO-OU-REVISTA')).toBeLessThan(
      citationRank('ANO-DO-ARTIGO'),
    );
    expect(citationRank('PAGINA-FINAL')).toBeLessThan(citationRank('DOI'));
  });

  it('idioma: a frase perde a vírgula do começo quando falta a compreensão', () => {
    const idioma = el(
      '<IDIOMA IDIOMA="ES" DESCRICAO-DO-IDIOMA="Espanhol" PROFICIENCIA-DE-COMPREENSAO="" PROFICIENCIA-DE-FALA="RAZOAVELMENTE" PROFICIENCIA-DE-LEITURA="BEM" PROFICIENCIA-DE-ESCRITA="POUCO"/>',
    );
    const s = recordLayout(idioma, false, opts);
    expect(lineText(s.when!)).toBe('Espanhol');
    expect(lineText(s.lines[0]!)).toBe('Fala razoavelmente, lê bem, escreve pouco.');
    expect(s.empty.map((p) => p.attr)).toEqual(['PROFICIENCIA-DE-COMPREENSAO']);
  });

  it('período em andamento termina em "atual"; sem início, vale o ano do item', () => {
    const curso = el(
      '<MESTRADO NOME-CURSO="X" ANO-DE-INICIO="2023" ANO-DE-CONCLUSAO="" STATUS-DO-CURSO="EM_ANDAMENTO"/>',
    );
    expect(lineText(recordLayout(curso, true, opts).when!)).toBe('2023 – atual');
    const area = el(
      '<AREA-DE-ATUACAO NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_BIOLOGICAS" NOME-DA-AREA-DO-CONHECIMENTO="Genética" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE="Genômica"/>',
    );
    const s = recordLayout(area, false, opts);
    expect(lineText(s.lines[0]!)).toBe('Genética › Genômica');
    expect(s.empty.map((p) => p.attr)).toEqual(['NOME-DA-SUB-AREA-DO-CONHECIMENTO']);
  });

  it('endereço residencial inteiro fica oculto no modo de privacidade', () => {
    const end = el(
      '<ENDERECO FLAG-DE-PREFERENCIA=""><ENDERECO-RESIDENCIAL LOGRADOURO="Rua A" CEP="91501970" CIDADE="Porto Alegre" UF="RS"/></ENDERECO>',
    );
    const [res] = addressLayout(end, { ...opts, hideSensitive: true });
    expect(res!.hidden).toBe(true);
    const [shown] = addressLayout(end, opts);
    expect(shown!.lines.map(lineText).filter(Boolean)).toEqual([
      'Rua A',
      'Porto Alegre – RS',
      '91501-970',
    ]);
  });
});

describe('modo de leitura: o campo clicado recebe o foco', () => {
  const fields = ['0:ANO', '0:TITULO', '3:NOME-COMPLETO-DO-AUTOR', '3:NOME-PARA-CITACAO'];

  it('o pedaço clicado, com o cursor no ponto do clique', () => {
    expect(focusTarget(fields, '0:TITULO', 7)).toEqual({ caret: 7, index: 1 });
  });

  it('um autor clicado na referência leva ao primeiro campo dele', () => {
    expect(focusTarget(fields, '3:*')).toEqual({ index: 2 });
  });

  it('sem pedaço (o botão Editar), o primeiro campo; sem campo, nada', () => {
    expect(focusTarget(fields)).toEqual({ index: 0 });
    expect(focusTarget(fields, '9:X')).toEqual({ index: 0 });
    expect(focusTarget([], '0:ANO')).toBeNull();
  });

  it('todo pedaço clicável da leitura tem um campo com a mesma chave na edição', async () => {
    const root = await demo();
    const dg = firstChild(root, 'DADOS-GERAIS')!;
    const layouts = [
      resumoLayout(firstChild(dg, 'RESUMO-CV')!, opts),
      addressLayout(firstChild(dg, 'ENDERECO')!, opts),
      fieldsLayout({ ...dg, children: [] }, opts),
      ...childElements(firstChild(dg, 'FORMACAO-ACADEMICA-TITULACAO')!).map((f) => [
        recordLayout(f, true, opts),
      ]),
    ];
    for (const sections of layouts) {
      const html = (editing: boolean) =>
        renderToStaticMarkup(
          createElement(Sections, { editing, hooks: { onEdit: () => {} }, sections }),
        );
      const parts = keysOf(html(false), 'data-part');
      const editable = new Set(keysOf(html(true), 'data-field'));
      expect(parts.length).toBeGreaterThan(0);
      for (const k of parts) expect(editable, k).toContain(k);
    }
  });
});

describe('modo de leitura: referência viva', () => {
  it('acompanha o rascunho do campo, sem mexer no item', async () => {
    const root = await demo();
    let artigo: XElement | undefined;
    walk(root, (e) => {
      if (!artigo && e.name === 'ARTIGO-PUBLICADO') artigo = e;
    });
    const title = citationFields(artigo!, opts).filled[0]!;
    const before = liveReference(artigo!, new Map(), opts);
    const after = liveReference(artigo!, new Map([[title.key, 'Outro título']]), opts);
    expect(after.text).toContain('Outro título');
    expect(after.text).not.toBe(before.text);
    expect(withDrafts(artigo!, new Map()) === artigo).toBe(true);
    expect(liveReference(artigo!, new Map(), opts).text).toBe(before.text);
    // O trecho do título leva a chave do campo do título.
    const lit = after.pieces
      .filter((p) => p.key === title.key)
      .map((p) => p.text)
      .join('');
    expect(lit).toBe('Outro título');
  });

  it('valores longos escolhem primeiro; ano marca todas as vezes', () => {
    const text = 'Volume 33, p. 1-16. Título 33 anos, 2024, 2024.';
    const h = referenceHighlights(text, [
      { key: 'v', text: '33' },
      { key: 't', text: 'Título 33 anos' },
      { key: 'a', text: '2024' },
      { key: 'p1', text: '1' },
      { key: 'p2', text: '16' },
      { key: 'x', text: '' },
    ]);
    const at = (k: string) => h.filter((x) => x.key === k).map((x) => text.slice(x.start, x.end));
    expect(at('t')).toEqual(['Título 33 anos']);
    expect(at('v')).toEqual(['33']);
    expect(text.indexOf('33')).toBe(h.find((x) => x.key === 'v')!.start);
    expect(at('a')).toEqual(['2024', '2024']);
    expect(at('p2')).toEqual(['16']);
    expect(at('p1')).toEqual(['1']);
  });

  it('sem palavra inteira, aceita o trecho dentro de outra', () => {
    const h = referenceHighlights('ANAIS DO CONGRESSO', [{ key: 'e', text: 'anais do' }]);
    expect(h).toEqual([{ end: 8, key: 'e', start: 0 }]);
    expect(referenceHighlights('abc', [{ key: 'z', text: 'zz' }])).toEqual([]);
  });

  it('corta os trechos nas bordas dos destaques e dos campos', () => {
    const pieces = splitSegments(
      [{ text: 'A. ' }, { strong: true, text: 'Revista X' }, { text: ', 2020.' }],
      [
        { end: 2, key: 'au', start: 0 },
        { end: 12, key: 'per', start: 3 },
        { end: 18, key: 'ano', start: 14 },
      ],
    );
    expect(pieces).toEqual([
      { key: 'au', strong: undefined, text: 'A.' },
      { key: undefined, strong: undefined, text: ' ' },
      { key: 'per', strong: true, text: 'Revista X' },
      { key: undefined, strong: undefined, text: ', ' },
      { key: 'ano', strong: undefined, text: '2020' },
      { key: undefined, strong: undefined, text: '.' },
    ]);
  });

  it('o campo do autor acende o autor inteiro', () => {
    expect(highlightMatches('3:*', '3:NOME-PARA-CITACAO')).toBe(true);
    expect(highlightMatches('3:*', '13:NOME-PARA-CITACAO')).toBe(false);
    expect(highlightMatches('0:TITULO', '0:TITULO')).toBe(true);
    expect(highlightMatches('0:TITULO', '0:ANO')).toBe(false);
  });

  it('o valor aparece como palavra inteira', () => {
    expect(appearsIn('In: CONGRESSO, 2023.', 'congresso')).toBe(true);
    expect(appearsIn('p. 116', '16')).toBe(false);
    expect(appearsIn('x', ' ')).toBe(false);
  });
});

describe('modo de leitura: controle de cada campo', () => {
  it('texto, texto longo, ano, data, lista e travado', () => {
    const premio = el('<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="X" ANO-DA-PREMIACAO="2015"/>');
    expect(inlineKind(premio, 'NOME-DO-PREMIO-OU-TITULO', noLists)).toBe('text');
    expect(inlineKind(premio, 'ANO-DA-PREMIACAO', noLists)).toBe('year');
    const resumo = el('<RESUMO-CV TEXTO-RESUMO-CV-RH="curto"/>');
    expect(inlineKind(resumo, 'TEXTO-RESUMO-CV-RH', noLists)).toBe('long');
    const dg = el(
      '<DADOS-GERAIS DATA-NASCIMENTO="03051986" FORMATO-DATA-DE-NASCIMENTO="DDMMAAAA" SEXO="FEMININO" PERMISSAO-DE-DIVULGACAO="NAO" NACIONALIDADE="B"/>',
    );
    expect(inlineKind(dg, 'DATA-NASCIMENTO', noLists)).toBe('date');
    expect(inlineKind(dg, 'SEXO', noLists)).toBe('select');
    expect(inlineKind(dg, 'PERMISSAO-DE-DIVULGACAO', noLists)).toBe('select');
    expect(inlineKind(dg, 'NACIONALIDADE', noLists)).toBe('locked');
    const curso = el('<MESTRADO CODIGO-CURSO="123" NOME-CURSO="Genética"/>');
    expect(inlineKind(curso, 'NOME-CURSO', noLists)).toBe('locked');
    const end = el('<ENDERECO ELETRONICO="I: a@b.br"/>');
    expect(inlineKind(end, 'ELETRONICO', noLists)).toBe('locked');
  });

  it('as opções guardam o valor fora da lista e seguem o formato', () => {
    const dg = el('<DADOS-GERAIS SEXO="OUTRO" PERMISSAO-DE-DIVULGACAO="SIM"/>');
    const sexo = selectOptions(dg, 'SEXO');
    expect(sexo[0]).toEqual({ label: '(vazio)', value: '' });
    expect(sexo[1]).toEqual({ label: 'OUTRO', value: 'OUTRO' });
    expect(selectOptions(dg, 'PERMISSAO-DE-DIVULGACAO').map((o) => o.label)).toEqual([
      '(vazio)',
      'Sim',
      'Não',
    ]);
    const idioma = el('<IDIOMA PROFICIENCIA-DE-FALA="BEM"/>');
    expect(selectOptions(idioma, 'PROFICIENCIA-DE-FALA', 'level').map((o) => o.label)).toContain(
      'bem',
    );
  });
});
