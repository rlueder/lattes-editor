// Composição do modo de leitura: a ordem dos campos é a de leitura, todo campo
// preenchido aparece na leitura, os vazios ficam no fim (obrigatórios
// primeiro), a referência acompanha o que se digita e o campo clicado é o que
// recebe o foco.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { childElements, firstChild, parseXml, walk, type XElement } from '../src/model/xml.ts';
import { referenceText } from '../src/print/abnt.ts';
import { hasReference } from '../src/print/references.ts';
import { referenceFor } from '../src/print/references.ts';
import {
  addressLayout,
  fieldsLayout,
  isFilled,
  isUsable,
  lineText,
  partText,
  resumoLayout,
  rowRank,
  type Section,
  shownKeys,
} from '../src/ui/reading-layout.ts';
import { addDraft, withDrafts } from '../src/ui/reading-preview.ts';
import { recordLayout } from '../src/ui/reading-records.ts';
import {
  appearsIn,
  citationFields,
  citationRank,
  outsideReference,
  referenceHighlights,
} from '../src/ui/reading-reference.ts';

const el = (xml: string) => parseXml(xml).root;
const opts = { hideSensitive: false, showCodes: false };

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

describe('modo de leitura: todo campo preenchido aparece na leitura', () => {
  it('prêmio mostra a entidade promotora na linha de apoio', () => {
    const premio = el(
      '<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Menção honrosa" NOME-DA-ENTIDADE-PROMOTORA="UFRGS" ANO-DA-PREMIACAO="2015" NOME-DO-PREMIO-OU-TITULO-INGLES=""/>',
    );
    const s = recordLayout(premio, false, opts);
    expect(lineText(s.when!)).toBe('2015');
    expect(s.lines.map(lineText)).toEqual(['Menção honrosa', 'UFRGS']);
    expect(s.rows).toEqual([]);
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
      const text = referenceText(referenceFor(item));
      const outside = new Set(outsideReference(item, opts).map((p) => p.key));
      for (const p of citationFields(item, opts)) {
        // O valor como a leitura o mostra (o rótulo de um enumerado: "Prefácio", não PREFACIO).
        const shown = outside.has(p.key) || appearsIn(text, partText(p));
        expect(shown, `${item.name} ${p.key}`).toBe(true);
      }
    }
  });

  it('palavra-chave que também está no título segue na leitura', () => {
    const item = el(`<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="1">
<DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="OUTRA" TITULO-DO-TRABALHO-TECNICO="Design de interface" ANO="2005"/>
<PALAVRAS-CHAVE PALAVRA-CHAVE-1="Design" PALAVRA-CHAVE-2="Web"/>
</TRABALHO-TECNICO>`);
    const words = outsideReference(item, opts)
      .filter((p) => p.el.name === 'PALAVRAS-CHAVE')
      .map((p) => p.attr);
    expect(words).toEqual(['PALAVRA-CHAVE-1', 'PALAVRA-CHAVE-2']);
  });

  it('a privacidade esconde os sensíveis na leitura, contando quantos', () => {
    const dg = el(
      '<DADOS-GERAIS NOME-COMPLETO="Ana" NOME-DA-MAE="Marta" DATA-NASCIMENTO="03051986" NOME-DO-PAI=""/>',
    );
    const [s] = fieldsLayout(dg, { ...opts, hideSensitive: true });
    expect(s!.rows.map((p) => p.attr)).toEqual(['NOME-COMPLETO']);
    expect(s!.masked).toBe(2);
  });
});

describe('modo de leitura: composição dos registros', () => {
  it('formação: grau, instituição, trabalho, orientação e bolsa; o resto em rótulos', () => {
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
    expect(s.rows.map((p) => p.attr)).toEqual([
      'STATUS-DO-CURSO',
      'ANO-DE-OBTENCAO-DO-TITULO',
      'FLAG-BOLSA',
    ]);
  });

  it('a ordem dos rótulos não é a do XSD', () => {
    expect(rowRank('NOME-COMPLETO')).toBeLessThan(rowRank('NOME-DA-MAE'));
    expect(rowRank('NOME-DA-ENTIDADE')).toBeLessThan(rowRank('PAIS-DE-PUBLICACAO'));
    expect(rowRank('ANO-X')).toBeLessThan(rowRank('FLAG-X'));
    expect(rowRank('FLAG-X')).toBeLessThan(rowRank('ISSN'));
  });

  it('produção: título, onde saiu, lugar, ano, volume, páginas, DOI', async () => {
    const root = await demo();
    let artigo: XElement | undefined;
    walk(root, (e) => {
      if (!artigo && e.name === 'ARTIGO-PUBLICADO') artigo = e;
    });
    const f = citationFields(artigo!, opts);
    expect(f.map((p) => p.attr)).not.toContain('ORDEM-DE-AUTORIA');
    const ranks = f.map((p) => citationRank(p.attr));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(f[0]!.attr).toBe('TITULO-DO-ARTIGO');
    expect(f.every(isFilled)).toBe(true);
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

describe('modo de leitura: referência viva', () => {
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

  it('o valor aparece como palavra inteira', () => {
    expect(appearsIn('In: CONGRESSO, 2023.', 'congresso')).toBe(true);
    expect(appearsIn('p. 116', '16')).toBe(false);
    expect(appearsIn('x', ' ')).toBe(false);
  });
});

describe('modo de leitura: a prévia acompanha o que se digita', () => {
  it('registro: a prévia mostra o rascunho, e o item não muda', () => {
    const premio = el(
      '<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Menção honrosa" NOME-DA-ENTIDADE-PROMOTORA="UFRGS" ANO-DA-PREMIACAO="2015"/>',
    );
    expect(withDrafts(premio, new Map())).toBe(premio);
    let drafts = addDraft(new Map(), premio, 'NOME-DA-ENTIDADE-PROMOTORA', 'USP');
    drafts = addDraft(drafts, premio, 'ANO-DA-PREMIACAO', '2016');
    const shown = withDrafts(premio, drafts);
    const s = recordLayout(shown, false, opts);
    expect(s.lines.map(lineText)).toEqual(['Menção honrosa', 'USP']);
    expect(lineText(s.when!)).toBe('2016');
    expect(recordLayout(premio, false, opts).lines.map(lineText)).toEqual([
      'Menção honrosa',
      'UFRGS',
    ]);
    // Rascunho igual ao gravado não copia nada.
    expect(withDrafts(premio, addDraft(new Map(), premio, 'ANO-DA-PREMIACAO', '2015'))).toBe(
      premio,
    );
  });

  it('produção: a referência da prévia acompanha o título digitado', async () => {
    const root = await demo();
    let artigo: XElement | undefined;
    walk(root, (e) => {
      if (!artigo && e.name === 'ARTIGO-PUBLICADO') artigo = e;
    });
    const basics = childElements(artigo!).find((c) => c.name.startsWith('DADOS-BASICOS'))!;
    const before = referenceText(referenceFor(artigo!));
    const shown = withDrafts(
      artigo!,
      addDraft(new Map(), basics, 'TITULO-DO-ARTIGO', 'Outro título'),
    );
    expect(referenceText(referenceFor(shown))).toContain('Outro título');
    expect(referenceText(referenceFor(artigo!))).toBe(before);
  });
});
