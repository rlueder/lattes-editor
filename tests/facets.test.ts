import { describe, expect, it } from 'vitest';

import { parseXml } from '../src/model/xml.ts';
import {
  applyFilter,
  buildFacets,
  elementMatchesText,
  isFiltering,
  matchesQuery,
  NO_FILTER,
} from '../src/ui/facets.ts';

const el = (xml: string) => parseXml(xml).root;

const EVENTS = [
  ['CONGRESSO', 'OUVINTE', 'Brasil'],
  ['CONGRESSO', 'APRESENTACAO_ORAL', 'Brasil'],
  ['CONGRESSO', 'OUVINTE', 'Espanha'],
  ['ENCONTRO', 'OUVINTE', 'Brasil'],
].map(([kind, forma, pais], i) =>
  el(
    `<PARTICIPACAO-EM-${kind}><DADOS-BASICOS-DA-PARTICIPACAO-EM-${kind} NATUREZA="" ANO="200${i}" PAIS="${pais}" FORMA-PARTICIPACAO="${forma}" FLAG-RELEVANCIA="NAO"/></PARTICIPACAO-EM-${kind}>`,
  ),
);

describe('buildFacets', () => {
  it('tipo quando a lista mistura; enumerados e país que dividem a lista; sem marcas sim/não', () => {
    const facets = buildFacets(EVENTS);
    expect(facets.map((f) => f.label)).toEqual(['Tipo', 'País', 'Forma de participação']);
    expect(facets[0]!.options).toEqual([
      { count: 3, label: 'Participação em congresso', value: 'PARTICIPACAO-EM-CONGRESSO' },
      { count: 1, label: 'Participação em encontro', value: 'PARTICIPACAO-EM-ENCONTRO' },
    ]);
    expect(facets[2]!.options.map((o) => o.label)).toEqual(['Ouvinte', 'Apresentação oral']);
  });

  it('campo com um valor só, ou presente em poucos itens, não vira filtro', () => {
    const items = [
      el('<A NATUREZA="COMPLETO" X="1"/>'),
      el('<A NATUREZA="COMPLETO"/>'),
      el('<A/>'),
      el('<A/>'),
      el('<A/>'),
    ];
    expect(buildFacets(items)).toEqual([]);
  });
});

describe('applyFilter', () => {
  const facets = buildFacets(EVENTS);
  const text = (e: ReturnType<typeof el>) =>
    e.children
      .map((c) => (c.kind === 'element' ? c.attrs.map((a) => a.value).join(' ') : ''))
      .join(' ');

  it('combina busca sem acento e facetas', () => {
    expect(applyFilter(EVENTS, facets, NO_FILTER, text)).toHaveLength(4);
    expect(applyFilter(EVENTS, facets, { query: 'espanha', selected: {} }, text)).toHaveLength(1);
    expect(
      applyFilter(
        EVENTS,
        facets,
        { query: '', selected: { 'FORMA-PARTICIPACAO': 'OUVINTE', PAIS: 'Brasil' } },
        text,
      ),
    ).toHaveLength(2);
    expect(
      applyFilter(EVENTS, facets, { query: '', selected: { 'NAO-EXISTE': 'x' } }, text),
    ).toHaveLength(4);
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ query: ' x ', selected: {} })).toBe(true);
  });
});

describe('situação', () => {
  it('aparece quando a lista mistura atuais e encerrados', () => {
    const items = [
      el(
        '<A NOME-INSTITUICAO="X"><VINCULOS ANO-INICIO="2020" ANO-FIM="" TIPO-DE-VINCULO="LIVRE"/></A>',
      ),
      el(
        '<A NOME-INSTITUICAO="Y"><VINCULOS ANO-INICIO="2010" ANO-FIM="2012" TIPO-DE-VINCULO="CELETISTA"/></A>',
      ),
      el('<A NOME-INSTITUICAO="Z"/>'),
    ];
    const facets = buildFacets(items);
    expect(facets.map((f) => f.label)).toEqual(['Situação', 'Vínculo']);
    expect(facets[0]!.options.map((o) => o.label)).toEqual(['Atual', 'Encerrado']);
    expect(facets[0]!.valueOf(items[2]!)).toBeUndefined();
  });
});

describe('matchesQuery', () => {
  it('casa no início das palavras, sem acento, em qualquer ordem', () => {
    expect(matchesQuery('Ag2 Agência de Inteligência Digital', 'Ag')).toBe(true);
    expect(matchesQuery('Adage Technologies', 'Ag')).toBe(false);
    expect(matchesQuery('Universidade do Vale · Design Estratégico', 'design uni')).toBe(true);
    expect(matchesQuery('Agência', 'agencia')).toBe(true);
    expect(matchesQuery('qualquer coisa', '   ')).toBe(true);
    expect(matchesQuery('Royal Drawing School', 'school x')).toBe(false);
  });

  it('grupo de campos: termos em campos diferentes', () => {
    const dg = el(
      '<DADOS-GERAIS NOME-COMPLETO="Pessoa Teste" CIDADE-NASCIMENTO="Pelotas"><RESUMO-CV>Designer gráfico</RESUMO-CV></DADOS-GERAIS>',
    );
    expect(elementMatchesText(dg, 'pel graf')).toBe(true);
    expect(elementMatchesText(dg, 'otas')).toBe(false);
    expect(elementMatchesText(dg, '')).toBe(true);
  });
});
