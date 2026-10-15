import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { MISSING_CHECKS, missingCheck, ownerTest } from '../src/model/missing.ts';
import { parseXml, type XElement } from '../src/model/xml.ts';
import { summaryTiles } from '../src/panorama/aggregate.ts';
import { sectionResult, selectionGroups } from '../src/panorama/drill.ts';
import { chartPeriod, defaultFilters, resetKinds } from '../src/panorama/filters.ts';
import { readCv } from '../src/panorama/model.ts';
import { people, personItems, spans } from '../src/panorama/people.ts';
import { healthChecks, venues } from '../src/panorama/topics.ts';
import {
  applyFilter,
  buildFacets,
  isFiltering,
  missingFacet,
  NO_FILTER,
} from '../src/ui/facets.ts';
import { buildSections, groupItemList } from '../src/ui/sections.ts';
import { inYears, recordYears, yearBounds } from '../src/ui/year-filter.ts';
import { yearPresets } from '../src/ui/year-range.ts';

const NOW = 2026;
const ALL = { from: 1900, to: NOW };
const el = (xml: string): XElement => parseXml(xml).root;

const demo = async () => {
  const name = 'demo.xml';
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  const root = (await loadCv(bytes, name)).doc.root;
  return { cv: readCv(root, NOW), root, sections: buildSections(root) };
};

const sectionItems = (sections: ReturnType<typeof buildSections>, id: string) =>
  sections.find((s) => s.id === id)!.groups.flatMap((g) => groupItemList(g)?.items ?? []);

describe('filtro de período das seções', () => {
  it('lê os anos de cada registro como a coluna da esquerda', () => {
    const current = el(
      '<ATUACAO-PROFISSIONAL><VINCULOS ANO-INICIO="2019" MES-INICIO="3" ANO-FIM=""/></ATUACAO-PROFISSIONAL>',
    );
    expect(recordYears(current, NOW)).toEqual({ from: 2019, to: NOW });
    const closed = el('<VINCULOS ANO-INICIO="2016" ANO-FIM="2018"/>');
    expect(recordYears(closed, NOW)).toEqual({ from: 2016, to: 2018 });
    const point = el(
      '<ARTIGO-PUBLICADO><DADOS-BASICOS-DO-ARTIGO ANO-DO-ARTIGO="2021"/></ARTIGO-PUBLICADO>',
    );
    expect(recordYears(point, NOW)).toEqual({ from: 2021, to: 2021 });
    const endOnly = el('<GRADUACAO ANO-DE-CONCLUSAO="2008"/>');
    expect(recordYears(endOnly, NOW)).toEqual({ from: 2008, to: 2008 });
    expect(recordYears(el('<X/>'), NOW)).toBeUndefined();
  });

  it('conta a orientação em andamento do ano de início até hoje', () => {
    const ongoing = el(
      '<ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO><DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO ANO="2018"/></ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO>',
    );
    expect(recordYears(ongoing, NOW)).toEqual({ from: 2018, to: NOW });
    expect(inYears(ongoing, { from: NOW - 4, to: NOW }, NOW)).toBe(true);
    const other = el(
      '<OUTRAS-ORIENTACOES-EM-ANDAMENTO><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO ANO="2024"/></OUTRAS-ORIENTACOES-EM-ANDAMENTO>',
    );
    expect(recordYears(other, NOW)).toEqual({ from: 2024, to: NOW });
    const done = el(
      '<ORIENTACOES-CONCLUIDAS-PARA-MESTRADO><DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO ANO="2018"/></ORIENTACOES-CONCLUIDAS-PARA-MESTRADO>',
    );
    expect(recordYears(done, NOW)).toEqual({ from: 2018, to: 2018 });
  });

  it('deixa passar o que tem algum ano no período, e o em andamento até hoje', () => {
    const current = el(
      '<ATUACAO-PROFISSIONAL><VINCULOS ANO-INICIO="2019"/></ATUACAO-PROFISSIONAL>',
    );
    expect(inYears(current, { from: 2025, to: 2026 }, NOW)).toBe(true);
    expect(inYears(current, { from: 2010, to: 2018 }, NOW)).toBe(false);
    expect(inYears(el('<X/>'), ALL, NOW)).toBe(false);
    expect(yearBounds([current, el('<GRADUACAO ANO-DE-CONCLUSAO="2008"/>')], NOW)).toEqual({
      from: 2008,
      to: NOW,
    });
    expect(yearBounds([el('<X/>')], NOW)).toBeUndefined();
  });

  it('entra no estado do filtro e na contagem da seção', async () => {
    const { sections } = await demo();
    const items = sectionItems(sections, 'atuacao');
    const facets = buildFacets(items);
    const shown = (from: number, to: number) =>
      applyFilter(items, facets, { ...NO_FILTER, years: { from, to } }, () => '', NOW).length;
    expect([shown(2017, 2017), shown(2025, 2025), shown(2000, 2010)]).toEqual([1, 1, 0]);
    expect(isFiltering({ ...NO_FILTER, years: { from: 2017, to: 2017 } })).toBe(true);
    expect(isFiltering(NO_FILTER)).toBe(false);
  });

  it('oferece os atalhos de período', () => {
    expect(yearPresets({ from: 2014, to: 2026 }, NOW).map((p) => p.label)).toEqual([
      'Todos os anos',
      'Últimos 5 anos',
      '2025–2028',
      '2021–2024',
      '2017–2020',
      '2013–2016',
    ]);
    expect(yearPresets({ from: 2018, to: 2019 }, NOW, 'Toda a carreira').map((p) => p.id)).toEqual([
      'tudo',
      'ultimos-5',
      'q2017',
    ]);
  });
});

describe('filtro "Faltando", o mesmo da Saúde do currículo', () => {
  it('conta nas seções o mesmo que a Saúde', async () => {
    const { cv, root, sections } = await demo();
    const owner = ownerTest(root.children.find((c) => c.kind === 'element') as XElement);
    const facet = missingFacet(sectionItems(sections, 'producoes'), owner)!;
    const byId = Object.fromEntries(facet.options.map((o) => [o.value, o.count]));
    for (const c of healthChecks(cv, ALL).filter((x) => x.id !== 'agencia'))
      expect([c.id, byId[c.id]]).toEqual([c.id, c.missing.length]);
    const supervision = missingFacet(sectionItems(sections, 'orientacoes'), owner)!;
    expect(supervision.options.map((o) => [o.value, o.count])).toEqual([['agencia', 0]]);
  });

  it('conta também o que não tem ano quando o período é a carreira inteira', async () => {
    const xml =
      '<CURRICULO-VITAE><DADOS-GERAIS NOME-COMPLETO="Ana Lima"/><PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>' +
      '<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="1"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Com ano" ANO-DO-ARTIGO="2020" DOI=""/><DETALHAMENTO-DO-ARTIGO/></ARTIGO-PUBLICADO>' +
      '<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="2"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Sem ano" ANO-DO-ARTIGO="" DOI=""/><DETALHAMENTO-DO-ARTIGO/></ARTIGO-PUBLICADO>' +
      '</ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA></CURRICULO-VITAE>';
    const root = parseXml(xml).root;
    const cv = readCv(root, NOW);
    const sections = buildSections(root);
    const whole = chartPeriod(cv, { from: cv.careerStart, to: cv.lastYear });
    expect(whole.all).toBe(true);
    const doi = healthChecks(cv, whole).find((c) => c.id === 'doi')!;
    const facet = missingFacet(sectionItems(sections, 'producoes'), cv.isOwner)!;
    expect(doi.missing).toHaveLength(2);
    expect(facet.options.find((o) => o.value === 'doi')!.count).toBe(2);
    expect(summaryTiles(cv, whole).find((t) => t.key === 'artigos')!.items).toHaveLength(2);
    // Com um recorte de anos, o que não tem ano fica de fora, como na seção.
    const recent = chartPeriod(cv, { from: 2020, to: 2020 });
    expect(recent.all).toBe(false);
    expect(healthChecks(cv, recent).find((c) => c.id === 'doi')!.missing).toHaveLength(1);
    expect(summaryTiles(cv, recent).find((t) => t.key === 'artigos')!.items).toHaveLength(1);
  });

  it('mostra só os campos que a seção tem e filtra pelos que faltam', async () => {
    const { sections } = await demo();
    const items = sectionItems(sections, 'producoes');
    const facets = buildFacets(items, { owner: sections[0]!.owner });
    const facet = facets.find((f) => f.id === 'faltando')!;
    expect(facet.options.map((o) => o.label)).toEqual([
      'Sem DOI (artigos)',
      'Sem ISSN',
      'Sem volume ou páginas',
      'Sem ISBN',
      'Sem palavras-chave',
      'Sem título em inglês',
      'Sem DOI (eventos)',
      'Sem ID CNPq de coautor',
    ]);
    const missingKw = applyFilter(
      items,
      facets,
      { query: '', selected: { faltando: 'palavras-chave' } },
      () => '',
      NOW,
    );
    expect(missingKw.map((x) => x.name).sort()).toEqual([
      'CAPITULO-DE-LIVRO-PUBLICADO',
      'TRABALHO-EM-EVENTOS',
      'TRABALHO-EM-EVENTOS',
      'TRABALHO-EM-EVENTOS',
    ]);
    expect(facet.matches!(items[0]!, 'nada')).toBe(false);
    expect(missingFacet([el('<X/>')], () => false)).toBeUndefined();
    expect(buildFacets([el('<X/>')]).some((f) => f.id === 'faltando')).toBe(false);
  });

  it('verifica cada campo como a definição única diz', () => {
    const none = () => false;
    const art = el(
      '<ARTIGO-PUBLICADO><DADOS-BASICOS-DO-ARTIGO DOI="" TITULO-DO-ARTIGO-INGLES="X"/><DETALHAMENTO-DO-ARTIGO ISSN="1" VOLUME="" PAGINA-INICIAL="1"/>' +
        '<AUTORES NOME-COMPLETO-DO-AUTOR="Outra Pessoa" NRO-ID-CNPQ=""/></ARTIGO-PUBLICADO>',
    );
    const missing = MISSING_CHECKS.filter((c) => c.applies(art, none) && c.missing(art, none)).map(
      (c) => c.id,
    );
    expect(missing).toEqual(['doi', 'volume', 'palavras-chave', 'id-cnpq']);
    const orient = el(
      '<ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO><DETALHAMENTO-DA-ORIENTACAO NOME-DA-AGENCIA="CAPES"/></ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO>',
    );
    expect(missingCheck('agencia')!.applies(orient, none)).toBe(true);
    expect(missingCheck('agencia')!.missing(orient, none)).toBe(false);
    expect(missingCheck('nada')).toBeUndefined();
    const owner = ownerTest(
      el('<DADOS-GERAIS NOME-COMPLETO="Ana Lima" NOME-EM-CITACOES-BIBLIOGRAFICAS="LIMA, A."/>'),
    );
    expect([owner('Ana  Lima', ''), owner('', 'Lima, A.'), owner('Outra', 'X')]).toEqual([
      true,
      true,
      false,
    ]);
    expect(ownerTest(undefined)('', '')).toBe(false);
  });
});

describe('clique no Panorama: que lista abre e com que filtro', () => {
  it('abre direto quando o filtro da seção mostra exatamente os itens', async () => {
    const { cv, sections } = await demo();
    const only = (sel: Parameters<typeof selectionGroups>[1]) => {
      const groups = selectionGroups(sections, sel, NOW);
      expect(groups).toHaveLength(1);
      return groups[0]!;
    };
    // Em resumo, quadriênio: artigos de 2021 a 2024.
    const years = { from: 2021, to: 2024 };
    const arts = cv.productions.filter((p) => p.group === 'artigos' && p.year! >= 2021);
    expect(only({ items: arts, label: 'Artigos', years })).toMatchObject({
      exact: true,
      target: { filter: { selected: { tipo: 'ARTIGO-PUBLICADO' }, years } },
    });
    // Produções por ano: um item só abre pelo título.
    const one = only({ items: [arts[0]!], label: 'x', years: { from: 2024, to: 2024 } });
    expect(one.exact).toBe(true);
    // Saúde: produções sem palavras-chave, de tipos diferentes.
    const kw = healthChecks(cv, ALL).find((c) => c.id === 'palavras-chave')!;
    expect(only({ items: kw.missing, label: 'kw', missing: 'palavras-chave' })).toMatchObject({
      exact: true,
      target: { filter: { selected: { faltando: 'palavras-chave' } } },
    });
    // Onde publica: idioma, pela busca.
    const english = venues(cv, ALL).languages.find((l) => l.label === 'Inglês')!;
    expect(only({ items: english.items, label: 'Inglês', query: 'Inglês' }).exact).toBe(true);
    // Bancas por ano.
    const banca = cv.committees.filter((c) => c.year === 2022);
    expect(only({ items: banca, label: 'b', years: { from: 2022, to: 2022 } }).exact).toBe(true);
  });

  it('não marca um tipo que o painel da seção não oferece', async () => {
    const { cv, sections } = await demo();
    // Bancas do demo são todas de mestrado: a seção não tem o filtro de tipo.
    const [g] = selectionGroups(
      sections,
      { items: cv.committees, label: 'Bancas', years: { from: 2022, to: 2024 } },
      NOW,
    );
    expect(g!.target.filter).toEqual({
      query: '',
      selected: {},
      years: { from: 2022, to: 2024 },
    });
    expect(g!.exact).toBe(true);
  });

  it('separa por seção o que mora em mais de uma, como as edições de um evento', async () => {
    const { cv, sections } = await demo();
    const series = venues(cv, ALL).events.find(
      (e) => e.label === 'Congresso Brasileiro de Genética',
    )!;
    const groups = selectionGroups(
      sections,
      { items: series.items, label: 'CBG', query: series.label },
      NOW,
    );
    expect(groups.map((g) => [g.sectionId, g.items.length, g.exact])).toEqual([
      ['eventos', 2, true],
      ['producoes', 1, true],
    ]);
  });

  it('lista sem botão quando nenhum filtro reproduz a seleção', async () => {
    const { cv, sections } = await demo();
    // Dois artigos de anos e periódicos diferentes, escolhidos à mão.
    const picked = [cv.productions[3]!, cv.productions[5]!];
    const [g] = selectionGroups(sections, { items: picked, label: 'x' }, NOW);
    expect(g!.exact).toBe(false);
    expect(
      sectionResult(
        sections.find((s) => s.id === 'producoes')!,
        NO_FILTER,
        NOW,
      ),
    ).toHaveLength(10);
  });

  it('cada pessoa abre as seções onde aparece, pelo nome', async () => {
    const { cv, sections } = await demo();
    const tiago = people(cv, ALL).find((p) => p.name.startsWith('Tiago'))!;
    const groups = selectionGroups(
      sections,
      { items: personItems(tiago), label: tiago.name, person: tiago.name },
      NOW,
    );
    expect(groups.map((g) => g.sectionId)).toEqual(['producoes', 'projetos', 'orientacoes']);
    expect(groups.every((g) => g.target.filter?.query === 'tiago silveira oliveira')).toBe(true);
  });
});

describe('pessoas no período', () => {
  it('só conta projetos, orientações e formação que tocam o período', async () => {
    const { cv } = await demo();
    const recent = { from: 2023, to: 2024 };
    // João concluiu o mestrado em 2021: em 2023 a 2024 ele aparece só pela coautoria.
    const joao = people(cv, recent).find((p) => p.name.startsWith('João'))!;
    expect([joao.supervisions.length, joao.productions.length]).toEqual([0, 1]);
    // Tiago segue em andamento (desde 2022) e está no projeto (desde 2020).
    const tiago = people(cv, recent).find((p) => p.name.startsWith('Tiago'))!;
    expect([tiago.supervisions.length, tiago.projects.length]).toEqual([1, 1]);
    // A formação dela (2004 a 2018) fica fora: os orientadores só entram pela coautoria.
    expect(people(cv, recent).flatMap((p) => p.degrees)).toEqual([]);
    expect(spans(undefined, undefined, { from: 2000, to: 2001 })).toBe(false);
    expect(spans(undefined, undefined, { all: true, from: 2000, to: 2001 })).toBe(true);
  });

  it('reconhece a dona do currículo pelo nome em citações', async () => {
    const { cv } = await demo();
    const banca = {
      ...cv.committees[0]!,
      members: [{ cit: 'LIMA, A. B. S.', full: 'A. B. S. Lima' }],
    };
    const list = people({ ...cv, committees: [banca] }, ALL);
    expect(list.some((p) => p.name === 'A. B. S. Lima')).toBe(false);
  });
});

describe('limpar filtros de um gráfico', () => {
  it('volta ao padrão só o que o gráfico mostra', async () => {
    const { cv } = await demo();
    const d = defaultFilters(cv);
    const changed = {
      ...d,
      from: 2020,
      group: 'artigos' as const,
      tie: 'banca' as const,
      view: 'rede' as const,
    };
    expect(resetKinds(changed, d, ['periodo', 'laco'])).toEqual({
      ...d,
      group: 'artigos',
      view: 'rede',
    });
    expect(resetKinds(changed, d, ['grupo', 'janela', 'nivel', 'repetidos'])).toMatchObject({
      from: 2020,
      group: '',
      tie: 'banca',
    });
  });
});
