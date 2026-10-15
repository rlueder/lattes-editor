import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { parseXml } from '../src/model/xml.ts';
import {
  authorship,
  careerBands,
  committeesByYear,
  countRows,
  countsTsv,
  currentRole,
  inWindow,
  productionsByYear,
  summaryTiles,
  supervisionRows,
  windows,
} from '../src/panorama/aggregate.ts';
import { chartById, CHARTS, DEFAULT_CHART } from '../src/panorama/catalog.ts';
import { plural, rightRound, SERIES, topRound } from '../src/panorama/charts/geometry.ts';
import {
  itemTarget,
  listTarget,
  locate,
  personTarget,
  searchTerms,
  spansSections,
} from '../src/panorama/drill.ts';
import {
  defaultFilters,
  isWhole,
  periodPresets,
  presetOf,
  setBound,
  yearOptions,
} from '../src/panorama/filters.ts';
import { levelOf, personKey, readCv, yearOf } from '../src/panorama/model.ts';
import { chartOfAction, panoramaPaletteEntries } from '../src/panorama/palette.ts';
import {
  coauthorEdges,
  collaboration,
  hasTie,
  people,
  personItems,
  shortName,
} from '../src/panorama/people.ts';
import { PANORAMA_ROUTE, panoramaHash, parsePanoramaHash } from '../src/panorama/route.ts';
import { pack, timelineEntries } from '../src/panorama/timeline.ts';
import { eventSeries, healthChecks, profileFlags, topics, venues } from '../src/panorama/topics.ts';
import { buildSections } from '../src/ui/sections.ts';

const NOW = 2026;
const ALL = { from: 1900, to: NOW };

const load = async (name: string) => {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return (await loadCv(bytes, name)).doc.root;
};

const demo = async () => {
  const root = await load('demo.xml');
  return { cv: readCv(root, NOW), root, sections: buildSections(root) };
};

describe('readCv', () => {
  it('lê as listas do currículo de demonstração', async () => {
    const { cv } = await demo();
    expect(cv.name).toBe('Ana Beatriz Souza Lima');
    expect(cv.productions).toHaveLength(10);
    expect(cv.productions.filter((p) => p.group === 'artigos')).toHaveLength(6);
    expect(cv.productions.filter((p) => p.group === 'livros')).toHaveLength(1);
    expect(cv.productions.filter((p) => p.group === 'eventos')).toHaveLength(3);
    expect(cv.supervisions.map((s) => [s.level, s.ongoing, s.student])).toEqual([
      ['Mestrado', false, 'Luísa Martins Ferreira'],
      ['Mestrado', false, 'João Pedro Nascimento'],
      ['Doutorado', true, 'Tiago Silveira Oliveira'],
    ]);
    expect(cv.committees).toHaveLength(2);
    expect(cv.events).toHaveLength(3);
    expect(cv.degrees.map((d) => [d.level, d.start, d.end])).toEqual([
      ['GRADUACAO', 2004, 2008],
      ['MESTRADO', 2009, 2011],
      ['DOUTORADO', 2011, 2015],
      ['POS-DOUTORADO', 2016, 2018],
    ]);
    expect(cv.positions.map((p) => [p.title, p.start, p.end])).toEqual([
      ['Professora Adjunta', 2019, undefined],
      ['Pesquisadora de pós-doutorado', 2016, 2018],
    ]);
    expect(cv.projects[0]).toMatchObject({ lead: true, start: 2020, sectionId: 'projetos' });
    expect(cv.awards.map((a) => a.year)).toEqual([2022, 2015]);
    expect(cv.careerStart).toBe(2009);
    expect(cv.lastYear).toBe(NOW);
    expect(cv.updated).toBe('06102026');
    expect(cv.areas[0]).toEqual({ area: 'Genética', sub: 'Genética Vegetal' });
  });

  it('reconhece a própria pessoa entre os autores', async () => {
    const { cv } = await demo();
    const art = cv.productions.find((p) => p.year === 2022 && p.group === 'artigos')!;
    expect(art.authors.map((a) => a.self)).toEqual([false, true, false]);
    expect(art.keywords).toEqual(['Euterpe edulis', 'fragmentação', 'fluxo gênico']);
    expect(art.venue).toBe('Conservation Genetics');
  });

  it('lê produção técnica e currículo sem dados gerais', async () => {
    const cv = readCv(
      parseXml(
        '<CURRICULO-VITAE><PRODUCAO-TECNICA><SOFTWARE><DADOS-BASICOS-DO-SOFTWARE TITULO-DO-SOFTWARE="Prog" ANO="2020"/></SOFTWARE>' +
          '<DEMAIS-TIPOS-DE-PRODUCAO-TECNICA><APRESENTACAO-DE-TRABALHO><DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO TITULO="Fala" ANO="2021"/></APRESENTACAO-DE-TRABALHO></DEMAIS-TIPOS-DE-PRODUCAO-TECNICA></PRODUCAO-TECNICA></CURRICULO-VITAE>',
      ).root,
      NOW,
    );
    expect(cv.productions.map((p) => [p.title, p.year, p.group])).toEqual([
      ['Prog', 2020, 'outros'],
      ['Fala', 2021, 'outros'],
    ]);
    expect(cv.name).toBe('');
    expect(cv.careerStart).toBe(2020);
  });

  it('lê todas as seções do exemplo completo sem quebrar', async () => {
    const cv = readCv(await load('synthetic_full.xml'), NOW);
    expect(cv.productions.length).toBeGreaterThan(10);
    expect(cv.supervisions.length).toBeGreaterThan(0);
    expect(cv.committees.length).toBeGreaterThan(0);
  });

  it('acha ano, nível e chave de pessoa', () => {
    expect(yearOf(undefined)).toBeUndefined();
    expect(yearOf(parseXml('<X ANO-DO-ARTIGO="20" ANO="2019"/>').root)).toBe(2019);
    expect(levelOf('ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO')).toBe('Pós-doutorado');
    expect(levelOf('OUTRAS-ORIENTACOES-CONCLUIDAS', 'INICIACAO_CIENTIFICA')).toBe(
      'Iniciação científica',
    );
    expect(levelOf('ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO')).toBe(
      'Especialização',
    );
    expect(levelOf('ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO')).toBe('Graduação (TCC)');
    expect(levelOf('OUTRAS-ORIENTACOES-CONCLUIDAS', 'ORIENTACAO-DE-OUTRA-NATUREZA')).toBe(
      'Outra natureza',
    );
    expect(personKey(' Lima,  A. B. S. ')).toBe('lima a b s');
  });
});

describe('contagens', () => {
  it('monta o resumo do período', async () => {
    const { cv } = await demo();
    const tiles = summaryTiles(cv, { from: 2021, to: 2024 });
    const n = Object.fromEntries(tiles.map((t) => [t.key, t.items.length]));
    expect(n).toMatchObject({
      artigos: 4,
      bancas: 2,
      eventos: 3,
      livros: 0,
      'orientacoes-andamento': 1,
      'orientacoes-concluidas': 2,
      projetos: 1,
    });
    expect(currentRole(cv)).toMatchObject({
      doctorate: 2015,
      position: { title: 'Professora Adjunta' },
    });
  });

  it('acha os anos sem produção, menos o ano corrente', async () => {
    const { cv } = await demo();
    const res = productionsByYear(cv, ALL, NOW);
    expect(res.bars[0]!.year).toBe(2009);
    expect(res.max).toBe(2);
    expect(res.gaps).toEqual([2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2018, 2025]);
    const only = productionsByYear(cv, ALL, NOW, ['livros']);
    expect(only.bars.filter((b) => b.total > 0).map((b) => b.year)).toEqual([2020]);
  });

  it('empilha as faixas da carreira sem cruzar', async () => {
    const { cv } = await demo();
    const { bands, rows } = careerBands(cv, ALL);
    expect(rows).toBe(3);
    const row = (label: string) => bands.find((b) => b.label === label)!.row;
    expect(row('Mestrado')).not.toBe(row('Doutorado'));
    expect(row('Professora Adjunta')).toBe(2);
  });

  it('conta por quadriênio e exporta a tabela', async () => {
    const { cv } = await demo();
    const cols = windows(cv, NOW, 5);
    expect(cols.map((c) => c.label)).toEqual([
      '2013–2016',
      '2017–2020',
      '2021–2024',
      '2025–2028',
      '2022–2026',
      'Total',
    ]);
    expect(cols[3]!.note).toBe('em curso');
    const rows = countRows(cv);
    const articles = rows.find((r) => r.label === 'Artigos em periódicos')!;
    expect(cols.map((c) => inWindow(articles.items, c).length)).toEqual([0, 2, 4, 0, 3, 6]);
    expect(rows.some((r) => r.sub && r.label === 'Mestrado')).toBe(true);
    expect(countsTsv(rows, cols).split('\n')[1]).toBe('Artigos em periódicos\t0\t2\t4\t0\t3\t6');
  });

  it('classifica a posição de autoria', async () => {
    const { cv } = await demo();
    const pts = authorship(cv, ALL);
    const count = (i: number) => pts.filter((p) => p.position === i).length;
    expect([count(0), count(1), count(2), count(3)]).toEqual([1, 7, 1, 1]);
    expect(authorship(cv, ALL, ['eventos'])).toHaveLength(3);
  });

  it('separa orientações por nível e bancas por ano', async () => {
    const { cv } = await demo();
    const rows = supervisionRows(cv, ALL);
    expect(rows.map((r) => [r.level, r.done.length, r.ongoing.length])).toEqual([
      ['Mestrado', 2, 0],
      ['Doutorado', 0, 1],
    ]);
    expect(supervisionRows(cv, ALL, 'Doutorado')).toHaveLength(1);
    expect(committeesByYear(cv, [2022, 2023]).map((x) => x.items.length)).toEqual([1, 0]);
  });
});

describe('pessoas', () => {
  it('junta coautoria, orientação, banca e projeto da mesma pessoa', async () => {
    const { cv } = await demo();
    const list = people(cv, ALL);
    const by = (name: string) => list.find((p) => p.name === name)!;
    expect(list[0]!.name).toBe('Helena Castro Vieira');
    expect(by('Helena Castro Vieira').degrees).toHaveLength(1);
    expect(by('Paulo Roberto Mendes').committees).toHaveLength(2);
    expect(by('Luísa Martins Ferreira')).toMatchObject({ productions: expect.any(Array) });
    expect(hasTie(by('Luísa Martins Ferreira'), 'orientacao')).toBe(true);
    expect(hasTie(by('Luísa Martins Ferreira'), 'projeto')).toBe(true);
    expect(hasTie(by('Gabriela Alves Rocha'), 'banca')).toBe(false);
    expect(hasTie(by('Gabriela Alves Rocha'), 'coautoria')).toBe(true);
    expect(personItems(by('Tiago Silveira Oliveira')).length).toBe(5);
    expect(list.some((p) => p.name === cv.name)).toBe(false);

    const stats = collaboration(cv, ALL, list);
    expect(stats).toMatchObject({ solo: 1, students: 3, studentsCoauthoring: 3, withAuthors: 10 });
    expect(stats.avgAuthors).toBeCloseTo(2.5);

    const keys = new Set(list.map((p) => p.key));
    const edges = coauthorEdges(cv, ALL, keys);
    const pair = edges.find((e) => e.a.startsWith('helena') && e.b.startsWith('tiago'));
    expect(pair?.items).toHaveLength(2);
  });

  it('encurta nomes', () => {
    expect(shortName('Ana Beatriz Souza Lima')).toBe('Ana Lima');
    expect(shortName('Ana Lima')).toBe('Ana Lima');
    expect(shortName('LIMA, A. B.')).toBe('LIMA, A. B.');
  });
});

describe('veículos, temas e saúde', () => {
  it('agrupa periódicos, idiomas e edições de eventos', async () => {
    const { cv } = await demo();
    const v = venues(cv, ALL);
    expect(v.journals).toHaveLength(6);
    expect(v.journals[0]!.note).toMatch(/^ISSN /);
    expect(v.languages.map((l) => [l.label, l.items.length])).toEqual([
      ['Português', 6],
      ['Inglês', 4],
    ]);
    expect(v.countries[0]!.label).toBe('Brasil');
    const cbg = v.events.find((e) => e.label === 'Congresso Brasileiro de Genética')!;
    expect(cbg.items).toHaveLength(3);
    expect(cbg.note).toBe('2023, 2024 · Águas de Lindóia');
    expect([v.national, v.international]).toEqual([3, 0]);
    expect(eventSeries('4º Simpósio Sul-Brasileiro 2021')).toBe('Simpósio Sul-Brasileiro');
  });

  it('lista os temas com os repetidos primeiro', async () => {
    const { cv } = await demo();
    const t = topics(cv, ALL);
    expect(t.withKeywords).toBe(6);
    expect(t.total).toBe(10);
    expect(t.topics[0]).toMatchObject({ label: 'fluxo gênico', repeated: true });
    expect(topics(cv, ALL, true).topics).toHaveLength(1);
  });

  it('conta o que falta preencher', async () => {
    const { cv } = await demo();
    const checks = Object.fromEntries(
      healthChecks(cv, ALL).map((c) => [c.id, [c.total.length - c.missing.length, c.total.length]]),
    );
    expect(checks).toMatchObject({
      doi: [6, 6],
      'doi-eventos': [0, 3],
      isbn: [0, 1],
      'palavras-chave': [6, 10],
      'titulo-ingles': [0, 10],
    });
    expect(healthChecks(cv, ALL, 'livros').map((c) => c.id)).toEqual([
      'isbn',
      'palavras-chave',
      'titulo-ingles',
      'agencia',
      'id-cnpq',
    ]);
    expect(profileFlags(cv).map((f) => f.ok)).toEqual([true, true]);
  });
});

describe('rota e catálogo', () => {
  it('lê e escreve o hash do Panorama', () => {
    expect(parsePanoramaHash('#panorama/temas')).toBe('temas');
    expect(parsePanoramaHash('#panorama')).toBe(DEFAULT_CHART);
    expect(parsePanoramaHash('#panorama/nada')).toBe(DEFAULT_CHART);
    expect(parsePanoramaHash('#producoes')).toBeUndefined();
    expect(parsePanoramaHash('#%E0%A4%A')).toBeUndefined();
    expect(panoramaHash('pessoas')).toBe(`#${PANORAMA_ROUTE}/pessoas`);
    expect(chartById('nada').id).toBe(CHARTS[0]!.id);
    expect(new Set(CHARTS.map((c) => c.id)).size).toBe(10);
  });
});

describe('clique: que lista abre no editor', () => {
  it('leva um item à seção e ao grupo dele, filtrado pelo título', async () => {
    const { cv, sections } = await demo();
    const art = cv.productions.find((p) => p.year === 2019)!;
    const t = itemTarget(sections, art);
    expect(t.sectionId).toBe('producoes');
    expect(t.anchor).toMatch(/^producoes\//);
    expect(t.filter?.query).toBe('the complete chloroplast genome of butia eriospatha and');
    const project = itemTarget(sections, cv.projects[0]!);
    expect(project.sectionId).toBe('projetos');
    const award = locate(sections, cv.awards[0]!);
    expect(award.sectionId).toBe('dados-gerais');
  });

  it('leva vários itens do mesmo tipo ao filtro de tipo', async () => {
    const { cv, sections } = await demo();
    const arts = cv.productions.filter((p) => p.group === 'artigos');
    expect(listTarget(sections, arts)).toMatchObject({
      filter: { selected: { tipo: 'ARTIGO-PUBLICADO' } },
      sectionId: 'producoes',
    });
    const mixed = listTarget(sections, cv.productions);
    expect(mixed?.filter).toBeUndefined();
    expect(mixed?.anchor).toBeUndefined();
    expect(listTarget(sections, [])).toBeUndefined();
    expect(spansSections(sections, [...arts, ...cv.committees])).toBe(true);
    expect(spansSections(sections, arts)).toBe(false);
  });

  it('leva uma pessoa à seção onde ela mais aparece, pelo nome', async () => {
    const { cv, sections } = await demo();
    const paulo = people(cv, ALL).find((p) => p.name.startsWith('Paulo'))!;
    expect(personTarget(sections, paulo.name, personItems(paulo))).toEqual({
      filter: { query: 'paulo roberto mendes', selected: {} },
      sectionId: 'producoes',
    });
    expect(personTarget(sections, 'X', [])).toBeUndefined();
    expect(searchTerms('Ação: um, dois!', 2)).toBe('acao um');
  });
});

describe('filtros, linha do tempo, ⌘K e geometria', () => {
  it('monta os filtros e os atalhos de período', async () => {
    const { cv } = await demo();
    const f = defaultFilters(cv);
    expect([f.from, f.to, f.view]).toEqual([2009, NOW, 'lista']);
    const presets = periodPresets(cv, NOW);
    expect(presets.map((p) => p.label)).toEqual([
      'Toda a carreira',
      'Últimos 5 anos',
      'Quadriênio 2021–2024',
      'Quadriênio 2017–2020',
    ]);
    expect(periodPresets(cv, 2024).at(-1)!.label).toBe('Quadriênio 2013–2016');
    expect(presetOf(presets, { from: 2021, to: 2024 })).toBe('q2021');
    expect(presetOf(presets, { from: 2010, to: 2011 })).toBe('');
    expect(yearOptions(cv)[0]).toBe(2009);
    expect(isWhole(cv, { from: 2009, to: NOW })).toBe(true);
    expect(isWhole(cv, { from: 2020, to: NOW })).toBe(false);
    expect(setBound(f, 'from', 2030)).toMatchObject({ from: 2030, to: 2030 });
    expect(setBound(f, 'to', 2000)).toMatchObject({ from: 2000, to: 2000 });
  });

  it('põe cada item da carreira na sua faixa', async () => {
    const { cv } = await demo();
    const entries = timelineEntries(cv);
    const lanes = new Set(entries.map((e) => e.lane));
    expect([...lanes].sort()).toEqual([
      'Atuação',
      'Formação',
      'Orientações',
      'Projetos',
      'Prêmios',
    ]);
    expect(entries[0]!.start).toBe(2004);
    const ongoing = entries.find((e) => e.label.startsWith('Doutorado: Tiago'))!;
    expect([ongoing.point, ongoing.end]).toEqual([false, undefined]);
    expect(entries.filter((e) => e.point)).toHaveLength(4);
    expect(
      pack(
        [0, 5, 20, 2],
        (x) => x,
        (x) => x + 10,
      ),
    ).toEqual([0, 1, 0, 2]);
  });

  it('oferece os gráficos no ⌘K', () => {
    const entries = panoramaPaletteEntries();
    expect(entries).toHaveLength(CHARTS.length);
    expect(entries[0]).toMatchObject({ context: 'Panorama', label: 'Em resumo' });
    expect(chartOfAction(entries[3]!.action)).toBe('quadrienios');
    expect(chartOfAction('novo')).toBeUndefined();
    expect(chartOfAction(undefined)).toBeUndefined();
  });

  it('desenha barras e plurais', () => {
    expect(topRound(0, 0, 10, 20)).toBe('M0,20V4Q0,0 4,0H6Q10,0 10,4V20Z');
    expect(topRound(0, 0, 10, 0)).toBe('');
    expect(rightRound(0, 0, 20, 10, 5)).toBe('M0,0H15Q20,0 20,5V5Q20,10 15,10H0Z');
    expect(rightRound(0, 0, 0, 10)).toBe('');
    expect(SERIES).toHaveLength(4);
    expect(plural(1, 'banca', 'bancas')).toBe('1 banca');
    expect(plural(2, 'banca', 'bancas')).toBe('2 bancas');
  });

  it('a entrada única expõe o que o editor usa', async () => {
    const entry = await import('../src/panorama/index.ts');
    expect(Object.keys(entry).sort()).toEqual([
      'ModeSwitch',
      'PanoramaNav',
      'PanoramaView',
      'chartOfAction',
      'panoramaPaletteEntries',
      'usePanorama',
    ]);
  });
});
