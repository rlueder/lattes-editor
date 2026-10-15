import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  addIncoming,
  diffSummary,
  incomingItems,
  initialChoice,
} from '../src/import-export/incoming.ts';
import { loadCv } from '../src/model/document.ts';
import { findBySequencia, pendingItems } from '../src/model/production.ts';
import { getAttr, parseXml, type XElement } from '../src/model/xml.ts';
import { productionItems } from '../src/review/consistency.ts';
import {
  authorKey,
  candidateLine,
  candidatesFor,
  closestInCv,
  DUPLICATE_AT,
  normalizeDoi,
  preDiff,
  reasons,
  SIMILAR_AT,
  titleSimilarity,
  WEIGHTS,
} from '../src/review/dedup.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

const autor = (citacao: string, nome = citacao) =>
  `<AUTORES NOME-COMPLETO-DO-AUTOR="${nome}" NOME-PARA-CITACAO="${citacao}" ORDEM-DE-AUTORIA="1"/>`;

function artigo(
  seq: number,
  {
    ano = '2020',
    autores = [autor('LIMA, A. B.'), autor('SOUZA, C.')],
    doi = '',
    periodico = 'Revista de Genética',
    titulo,
  }: { ano?: string; autores?: string[]; doi?: string; periodico?: string; titulo: string },
) {
  return `<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="${seq}">
    <DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="${titulo}" ANO-DO-ARTIGO="${ano}" DOI="${doi}"/>
    <DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="${periodico}"/>
    ${autores.join('')}
  </ARTIGO-PUBLICADO>`;
}

function cv(artigos: string, extra = '') {
  return parseXml(`<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001">
    <DADOS-GERAIS NOME-COMPLETO="Pessoa"/>
    <PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>${artigos}</ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA>
    ${extra}
  </CURRICULO-VITAE>`).root;
}

const one = (xml: string): XElement => productionItems(cv(xml))[0]!;

describe('pré-diff e deduplicação explicável (LAT-45)', () => {
  it('os pesos somam 100, com título 45, identificador 15 e autores 10', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect([WEIGHTS.titulo, WEIGHTS.identificador, WEIGHTS.autores]).toEqual([45, 15, 10]);
    expect(SIMILAR_AT).toBeLessThan(DUPLICATE_AT);
  });

  it('o mesmo artigo sem DOI parece duplicata, com o motivo de cada parte', () => {
    const existing = productionItems(cv(artigo(1, { titulo: 'Genômica de palmeiras' })));
    const incoming = one(artigo(99, { titulo: 'Genômica de Palmeiras.' }));
    const [best] = candidatesFor(incoming, existing);
    expect(best?.level).toBe('duplicata');
    expect(best?.score).toBe(85);
    expect(best?.sameDoi).toBe(false);
    expect(reasons(best!)).toEqual([
      'título igual',
      'mesmo ano',
      'mesmo tipo',
      '2 de 2 autores em comum',
      'mesmo veículo',
    ]);
    expect(best?.parts.identificador.reason).toBe('sem DOI ou ISBN nos dois para comparar');
    expect(candidateLine(best!)).toBe('Parece duplicata de um item com o mesmo título (85%)');
  });

  it('o mesmo DOI decide, mesmo com o título escrito de outro jeito', () => {
    const existing = productionItems(
      cv(artigo(1, { doi: '10.5555/ABC', titulo: 'Um título qualquer em português' })),
    );
    const incoming = one(
      artigo(9, {
        ano: '2022',
        autores: [],
        doi: 'https://doi.org/10.5555/abc',
        periodico: 'Outra',
        titulo: 'An English title',
      }),
    );
    const [best] = candidatesFor(incoming, existing);
    expect(best).toMatchObject({ level: 'duplicata', sameDoi: true });
    expect(best!.score).toBeLessThan(SIMILAR_AT);
    expect(candidateLine(best!)).toBe(
      'Parece duplicata de "Um título qualquer em português" (mesmo DOI)',
    );
  });

  it('parecido, mas não igual: título parecido, um ano de diferença', () => {
    const existing = productionItems(
      cv(artigo(1, { titulo: 'Diversidade genética de palmeiras do Cerrado' })),
    );
    const incoming = one(
      artigo(9, {
        ano: '2021',
        autores: [autor('LIMA, A. B.'), autor('PEREIRA, D.')],
        titulo: 'Diversidade genética de palmeiras nativas do Cerrado',
      }),
    );
    const [best] = candidatesFor(incoming, existing);
    expect(best?.level).toBe('parecido');
    expect(best!.score).toBeGreaterThanOrEqual(SIMILAR_AT);
    expect(best!.score).toBeLessThan(DUPLICATE_AT);
    expect(reasons(best!)).toContain('anos 2020 e 2021');
    expect(reasons(best!)).toContain('1 de 3 autores em comum');
    expect(candidateLine(best!)).toMatch(/^Parecido com/);
  });

  it('itens diferentes não viram candidatos; DOIs diferentes pesam contra', () => {
    const existing = productionItems(cv(artigo(1, { doi: '10.1/a', titulo: 'Assunto A' })));
    expect(
      candidatesFor(one(artigo(2, { doi: '10.1/b', titulo: 'Outro assunto B' })), existing),
    ).toEqual([]);
    const sameTitle = candidatesFor(
      one(artigo(2, { doi: '10.1/b', titulo: 'Assunto A' })),
      existing,
    );
    // Dois DOIs diferentes: no máximo "parecido", mesmo com o título igual.
    expect(sameTitle[0]?.level).toBe('parecido');
    expect(sameTitle[0]?.parts.identificador).toMatchObject({
      points: 0,
      reason: 'DOIs diferentes',
    });
    // O próprio item nunca é candidato dele mesmo.
    expect(candidatesFor(existing[0]!, existing)).toEqual([]);
  });

  it('pré-diff de uma leva: novos, duplicatas e repetidos dentro da própria leva', () => {
    const root = cv(artigo(1, { titulo: 'Já está no currículo' }));
    const other = cv(
      artigo(5, { titulo: 'Já está no currículo' }) +
        artigo(6, { titulo: 'Trabalho novo de verdade' }) +
        artigo(7, { titulo: 'Trabalho novo de verdade' }),
    );
    const diff = preDiff(incomingItems(schema, other), root);
    expect(diff.map((d) => d.status)).toEqual(['duplicata', 'novo', 'duplicata']);
    expect(diff[2]?.best?.item).toBe(diff[1]?.item);
    expect(initialChoice(diff)).toEqual([false, true, false]);
    expect(diffSummary(diff)).toBe('3 itens: 1 novo, 2 parecem duplicatas');
    expect(diffSummary(diff.slice(1, 2))).toBe('1 item: 1 novo');
  });

  it('resumo com parecidos', () => {
    const existing = cv(artigo(1, { titulo: 'Diversidade genética de palmeiras do Cerrado' }));
    const incoming = cv(
      artigo(9, {
        ano: '2021',
        autores: [autor('LIMA, A. B.'), autor('PEREIRA, D.')],
        titulo: 'Diversidade genética de palmeiras nativas do Cerrado',
      }),
    );
    expect(diffSummary(preDiff(incomingItems(schema, incoming), existing))).toBe(
      '1 item: 0 novos, 1 parecido com outro',
    );
  });

  it('os escolhidos entram como itens novos, com número acima do maior', () => {
    const root = cv(artigo(10, { titulo: 'Existente' }));
    const doc = { epilog: '', prolog: '', root };
    const other = cv(
      artigo(3, { titulo: 'Vem de fora A' }) + artigo(4, { titulo: 'Vem de fora B' }),
    );
    const items = incomingItems(schema, other);
    const next = addIncoming(schema, doc, items, 5);
    expect(next).toBe(13);
    expect(getAttr(findBySequencia(doc, 11)!.children[1] as XElement, 'TITULO-DO-ARTIGO')).toBe(
      'Vem de fora A',
    );
    expect(pendingItems(doc, 10).map((el) => getAttr(el, 'SEQUENCIA-PRODUCAO'))).toEqual([
      '11',
      '12',
    ]);
    // O original da outra leva não muda.
    expect(getAttr(items[0]!, 'SEQUENCIA-PRODUCAO')).toBe('3');
    // Item que o Importar não lê (patente) não vem.
    const patente = cv(
      '',
      '<PRODUCAO-TECNICA><PATENTE SEQUENCIA-PRODUCAO="2"><DADOS-BASICOS-DA-PATENTE TITULO="P"/></PATENTE></PRODUCAO-TECNICA>',
    );
    expect(incomingItems(schema, patente)).toEqual([]);
    expect(addIncoming(schema, doc, productionItems(patente), 1)).toBe(13);
  });

  it('a demonstração aberta duas vezes: tudo parece duplicata', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('../fixtures/demo.xml', import.meta.url)));
    const demo = await loadCv(bytes, 'demo.xml');
    const again = await loadCv(bytes, 'demo.xml');
    const diff = preDiff(incomingItems(schema, again.doc.root), demo.doc.root);
    expect(diff.length).toBeGreaterThan(10);
    expect(diff.every((d) => d.status === 'duplicata')).toBe(true);
  });

  it('partes da comparação', () => {
    expect(normalizeDoi(' DOI: 10.1/AbC ')).toBe('10.1/abc');
    expect(normalizeDoi('http://dx.doi.org/10.1/x')).toBe('10.1/x');
    expect(normalizeDoi('')).toBeUndefined();
    expect(titleSimilarity(['a', 'b'], ['a', 'c'])).toBe(0.5);
    expect(titleSimilarity([], ['a'])).toBe(0);
    const el = (attrs: string) => parseXml(`<AUTORES ${attrs}/>`).root;
    expect(authorKey(el('NOME-PARA-CITACAO="SOUZA LIMA, A. B.;LIMA, A."'))).toBe('souza lima');
    expect(authorKey(el('NOME-COMPLETO-DO-AUTOR="Ana Beatriz Lima"'))).toBe('lima');
    expect(authorKey(el(''))).toBeUndefined();
  });

  it('livros comparam pelo ISBN; eventos sem autores e sem ano dizem por quê', () => {
    const livro = (
      seq: number,
      isbn: string,
      titulo: string,
    ) => `<PRODUCAO-BIBLIOGRAFICA><LIVROS-E-CAPITULOS><LIVROS-PUBLICADOS-OU-ORGANIZADOS>
      <LIVRO-PUBLICADO-OU-ORGANIZADO SEQUENCIA-PRODUCAO="${seq}"><DADOS-BASICOS-DO-LIVRO TITULO-DO-LIVRO="${titulo}" ANO="2019"/>
      <DETALHAMENTO-DO-LIVRO ISBN="${isbn}" NOME-DA-EDITORA="Editora"/></LIVRO-PUBLICADO-OU-ORGANIZADO>
      </LIVROS-PUBLICADOS-OU-ORGANIZADOS></LIVROS-E-CAPITULOS></PRODUCAO-BIBLIOGRAFICA>`;
    const root = parseXml(
      `<CURRICULO-VITAE>${livro(1, '978-85-1', 'Livro')}</CURRICULO-VITAE>`,
    ).root;
    const same = productionItems(
      parseXml(`<CURRICULO-VITAE>${livro(2, '978851', 'Livro')}</CURRICULO-VITAE>`).root,
    )[0]!;
    expect(candidatesFor(same, productionItems(root))[0]?.parts.identificador.reason).toBe(
      'mesmo ISBN',
    );
    const other = productionItems(
      parseXml(`<CURRICULO-VITAE>${livro(3, '978852', 'Livro')}</CURRICULO-VITAE>`).root,
    )[0]!;
    expect(candidatesFor(other, productionItems(root))[0]?.parts.identificador.reason).toBe(
      'ISBNs diferentes',
    );

    const evento = (
      seq: number,
      nome: string,
    ) => `<DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS>
      <PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="${seq}"><DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO TITULO="" ANO=""/>
      <DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO NOME-DO-EVENTO="${nome}"/></PARTICIPACAO-EM-CONGRESSO>
      </PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES>`;
    const events = parseXml(`<CURRICULO-VITAE>${evento(1, 'Congresso X')}</CURRICULO-VITAE>`).root;
    const incoming = productionItems(
      parseXml(`<CURRICULO-VITAE>${evento(2, 'Congresso X')}</CURRICULO-VITAE>`).root,
    )[0]!;
    const [best] = candidatesFor(incoming, productionItems(events));
    expect(best?.parts.autores.reason).toBe('sem autores nos dois para comparar');
    expect(best?.parts.ano.reason).toBe('sem ano nos dois para comparar');
    expect(best?.parts.veiculo.reason).toBe('sem veículo nos dois para comparar');
    expect(best?.level).toBe('parecido');
  });

  it('tipos diferentes e nenhum autor em comum', () => {
    const root = cv(artigo(1, { titulo: 'Mesmo título', autores: [autor('A, B.')] }));
    const trabalho = parseXml(`<CURRICULO-VITAE><PRODUCAO-BIBLIOGRAFICA><TRABALHOS-EM-EVENTOS>
      <TRABALHO-EM-EVENTOS SEQUENCIA-PRODUCAO="2"><DADOS-BASICOS-DO-TRABALHO TITULO-DO-TRABALHO="Mesmo título" ANO-DO-TRABALHO="2020"/>
      ${autor('C, D.')}</TRABALHO-EM-EVENTOS></TRABALHOS-EM-EVENTOS></PRODUCAO-BIBLIOGRAFICA></CURRICULO-VITAE>`).root;
    const [best] = candidatesFor(productionItems(trabalho)[0]!, productionItems(root));
    expect(best?.parts.tipo.reason).toMatch(/^tipos diferentes/);
    expect(best?.parts.autores.reason).toBe('nenhum autor em comum');
    expect(best?.parts.ano.reason).toBe('mesmo ano');
  });

  it('o formulário de item novo: o mais parecido do currículo, sem contar o próprio item', () => {
    const root = cv(artigo(1, { titulo: 'Genômica de palmeiras' }));
    const draft = one(artigo(2, { titulo: 'Genômica de palmeiras' }));
    expect(closestInCv(draft, root)?.level).toBe('duplicata');
    const itself = productionItems(root)[0]!;
    expect(closestInCv(structuredClone(itself), root)).toBeUndefined();
    expect(closestInCv(one(artigo(3, { titulo: 'Outra coisa' })), root)).toBeUndefined();
  });
});
