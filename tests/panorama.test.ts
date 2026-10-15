import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { parseXml } from '../src/model/xml.ts';
import {
  authorship,
  careerBands,
  committeeKind,
  committeesByYear,
  countRows,
  countsCsv,
  csvField,
  csvFileName,
  currentRole,
  inWindow,
  levelBadge,
  productionsByYear,
  summaryTiles,
  supervisionFacts,
  windows,
  yearRanges,
} from '../src/panorama/aggregate.ts';
import { chartById, CHARTS, DEFAULT_CHART, filterOrder } from '../src/panorama/catalog.ts';
import { plural, rightRound, SERIES, topRound } from '../src/panorama/charts/geometry.ts';
import { itemTarget, locate, searchTerms, selectionGroups } from '../src/panorama/drill.ts';
import { changedCount, defaultFilters, isWhole, periodPresets } from '../src/panorama/filters.ts';
import { levelOf, personKey, readCv, yearOf } from '../src/panorama/model.ts';
import { chartOfAction, panoramaPaletteEntries } from '../src/panorama/palette.ts';
import {
  byRole,
  coauthorEdges,
  collaboration,
  hasTie,
  people,
  personItems,
  roleOf,
  shortName,
  TIES,
} from '../src/panorama/people.ts';
import { PANORAMA_ROUTE, panoramaHash, parsePanoramaHash } from '../src/panorama/route.ts';
import {
  MAX_SCALE,
  pack,
  scaleFor,
  tickStep,
  timelineEntries,
  zoomAt,
} from '../src/panorama/timeline.ts';
import { eventSeries, healthChecks, profileFlags, topics, venues } from '../src/panorama/topics.ts';
import { buildSections } from '../src/ui/sections.ts';
import {
  cellState,
  formatRange,
  orderedRange,
  pickYear,
  shownRange,
} from '../src/ui/year-range.ts';

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

  it('escreve listas de anos com intervalos', () => {
    expect(yearRanges([2009, 2010, 2011, 2012, 2018, 2025])).toBe('2009 a 2012, 2018 e 2025');
    expect(yearRanges([2018, 2017])).toBe('2017, 2018');
    expect(yearRanges([2018])).toBe('2018');
    expect(yearRanges([])).toBe('');
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
    const csv = countsCsv(rows, cols);
    expect(
      csv.startsWith(
        '﻿Tipo;2013–2016;2017–2020;2021–2024;2025–2028 (em curso);2022–2026;Total (com e sem ano)\r\n',
      ),
    ).toBe(true);
    expect(csv.split('\r\n')[1]).toBe('Artigos em periódicos;0;2;4;0;3;6');
    expect(csv).toContain('\r\nOrientações concluídas: Mestrado;0;0;2;0;1;2\r\n');
    expect(csv.endsWith('\r\n')).toBe(true);
    // O Total conta também o item sem ano, que nenhum quadriênio pega.
    const total = cols.at(-1)!;
    const undated = { ...articles.items[0]!, year: undefined };
    expect(inWindow([...articles.items, undated], total)).toHaveLength(7);
    expect(cols.slice(0, -1).every((c) => !inWindow([undated], c).length)).toBe(true);
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('a"b')).toBe('"a""b"');
    expect(csvField('linha\nnova')).toBe('"linha\nnova"');
    expect(csvField(3)).toBe('3');
    const day = new Date('2026-10-15T12:00:00Z');
    expect(csvFileName(cv, false, day)).toBe('quadrienios-ana-lima-2026-10-15.csv');
    expect(csvFileName(cv, true, day)).toBe('quadrienios-3871592046158372-2026-10-15.csv');
    expect(csvFileName({ ...cv, lattesId: '', name: '' }, false, day)).toBe(
      'quadrienios-curriculo-2026-10-15.csv',
    );
  });

  it('classifica a posição de autoria', async () => {
    const { cv } = await demo();
    const pts = authorship(cv, ALL);
    const count = (i: number) => pts.filter((p) => p.position === i).length;
    expect([count(0), count(1), count(2), count(3)]).toEqual([1, 7, 1, 1]);
    expect(authorship(cv, ALL, ['eventos'])).toHaveLength(3);
  });

  it('resume orientações por nível e bancas por ano', async () => {
    const { cv } = await demo();
    expect(supervisionFacts(cv, ALL)).toEqual([
      '2 mestrados concluídos',
      '1 doutorado em andamento',
    ]);
    expect(supervisionFacts(cv, ALL, 'Doutorado')).toEqual(['1 doutorado em andamento']);
    expect(supervisionFacts(cv, { from: 2023, to: 2023 })).toEqual([
      '1 mestrado concluído',
      '1 doutorado em andamento',
    ]);
    const ic = { ...cv.supervisions[0]!, level: 'Iniciação científica' as const, ongoing: false };
    expect(supervisionFacts({ ...cv, supervisions: [ic, ic] }, ALL)).toEqual([
      '2 iniciações científicas concluídas',
    ]);
    expect(levelBadge('Iniciação científica')).toBe('IC');
    expect(committeesByYear(cv, ALL).map((x) => [x.year, x.items.length])).toEqual([
      [2022, 1],
      [2023, 0],
      [2024, 1],
    ]);
    expect(committeesByYear(cv, { from: 2000, to: 2001 })).toEqual([]);
    expect(
      [
        'PARTICIPACAO-EM-BANCA-DE-MESTRADO',
        'PARTICIPACAO-EM-BANCA-DE-DOUTORADO',
        'PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO',
        'PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO',
        'PARTICIPACAO-EM-BANCA-DE-GRADUACAO',
        'OUTRAS-PARTICIPACOES-EM-BANCA',
        'BANCA-JULGADORA-PARA-CONCURSO-PUBLICO',
        'OUTRAS-BANCAS-JULGADORAS',
      ].map(committeeKind),
    ).toEqual([
      'mestrado',
      'doutorado',
      'qualificação',
      'especialização',
      'graduação',
      'outra',
      'julgadora',
      'julgadora',
    ]);
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

  it('separa as pessoas por papel, o mais específico primeiro', async () => {
    const { cv } = await demo();
    const groups = byRole(people(cv, ALL));
    expect(groups.map((g) => [g.role, g.people.map((p) => p.name.split(' ')[0])])).toEqual([
      ['Orientadores', ['Helena', 'Paulo']],
      ['Orientandos', ['Luísa', 'Tiago', 'João']],
      ['Coautores', ['Gabriela']],
    ]);
    const onlyBanca = people(cv, ALL).find((p) => p.name.startsWith('Paulo'))!;
    const bare = { ...onlyBanca, degrees: [], productions: [], supervisions: [] };
    expect(roleOf(bare)).toBe('Bancas');
    expect(roleOf({ ...bare, projects: cv.projects })).toBe('Projetos');
    expect(TIES.map((t) => t.key)).toEqual(['coautoria', 'banca', 'projeto']);
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
      'id-cnpq',
      'agencia',
    ]);
    expect(new Set(healthChecks(cv, ALL).map((c) => c.group))).toEqual(
      new Set(['Produções', 'Eventos', 'Pessoas', 'Orientações']),
    );
    expect(healthChecks(cv, ALL).every((c) => c.hint !== '')).toBe(true);
    expect(profileFlags(cv).map((f) => f.ok)).toEqual([true, true]);
  });
});

describe('rota e catálogo', () => {
  it('lê e escreve o hash do Panorama', () => {
    expect(parsePanoramaHash('#panorama/temas')).toBe('temas');
    expect(parsePanoramaHash('#panorama')).toBe(DEFAULT_CHART);
    expect(parsePanoramaHash('#panorama/nada')).toBe(DEFAULT_CHART);
    expect(parsePanoramaHash('#panorama/orientacoes-e-bancas')).toBe('pessoas');
    expect(parsePanoramaHash('#producoes')).toBeUndefined();
    expect(parsePanoramaHash('#%E0%A4%A')).toBeUndefined();
    expect(panoramaHash('pessoas')).toBe(`#${PANORAMA_ROUTE}/pessoas`);
    expect(chartById('nada').id).toBe(CHARTS[0]!.id);
    expect(new Set(CHARTS.map((c) => c.id)).size).toBe(9);
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

  it('agrupa a seleção por seção e diz se o filtro a reproduz', async () => {
    const { cv, sections } = await demo();
    const arts = cv.productions.filter((p) => p.group === 'artigos');
    const [g] = selectionGroups(sections, { items: arts, label: 'Artigos' }, NOW);
    expect(g).toMatchObject({
      exact: true,
      label: 'Produções',
      target: { filter: { selected: { tipo: 'ARTIGO-PUBLICADO' } }, sectionId: 'producoes' },
    });
    const mixed = selectionGroups(
      sections,
      { items: [...arts, ...cv.committees], label: 'Misto' },
      NOW,
    );
    expect(mixed.map((x) => [x.sectionId, x.items.length])).toEqual([
      ['producoes', 6],
      ['bancas', 2],
    ]);
    expect(selectionGroups(sections, { items: [], label: 'Nada' }, NOW)).toEqual([]);
    expect(searchTerms('Ação: um, dois!', 2)).toBe('acao um');
  });

  it('mostra uma pessoa em cada seção onde ela aparece, filtrada pelo nome', async () => {
    const { cv, sections } = await demo();
    const paulo = people(cv, ALL).find((p) => p.name.startsWith('Paulo'))!;
    const groups = selectionGroups(
      sections,
      { items: personItems(paulo), label: paulo.name, person: paulo.name },
      NOW,
    );
    expect(groups.map((x) => [x.label, x.items.length])).toEqual([
      ['Produções', 3],
      ['Bancas', 2],
      ['Formação', 2],
    ]);
    for (const x of groups)
      expect(x.target.filter).toEqual({ query: 'paulo roberto mendes', selected: {} });
    // O nome acha nas bancas exatamente as duas em que ele esteve.
    expect(groups.find((x) => x.sectionId === 'bancas')!.exact).toBe(true);
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
      '2025–2028',
      '2021–2024',
      '2017–2020',
      '2013–2016',
    ]);
    expect(periodPresets(cv, 2016).map((p) => p.id)).toEqual(['tudo', 'ultimos-5', 'q2013']);
    expect(isWhole(cv, { from: 2009, to: NOW })).toBe(true);
    expect(isWhole(cv, { from: 2020, to: NOW })).toBe(false);
    const g = { ...f, from: 2015, group: 'artigos' as const, view: 'rede' as const };
    expect(changedCount(g, f, ['periodo', 'grupo'])).toBe(2);
    expect(changedCount({ ...g, level: 'Mestrado' }, f, ['periodo', 'grupo', 'nivel'])).toBe(3);
    expect(changedCount(f, f, ['periodo', 'grupo', 'janela', 'nivel', 'laco', 'repetidos'])).toBe(
      0,
    );
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

  it('calcula o zoom e a rolagem da linha do tempo', () => {
    expect(scaleFor(700, 23)).toBeCloseTo(700 / 23);
    expect(scaleFor(700, 10)).toBe(70);
    expect(scaleFor(7000, 5)).toBe(MAX_SCALE);
    expect(scaleFor(700, 0)).toBe(MAX_SCALE);
    // O ano sob o cursor fica no lugar: (100 + 50) * 2 - 50.
    expect(zoomAt(10, 100, 50, 2, 5)).toEqual({ scale: 20, scrollLeft: 250 });
    expect(zoomAt(10, 0, 0, 0.1, 5).scale).toBe(5);
    expect(zoomAt(300, 0, 0, 10, 5).scale).toBe(MAX_SCALE);
    expect(zoomAt(10, 0, 50, 0.5, 1).scrollLeft).toBe(0);
    expect([tickStep(60), tickStep(30), tickStep(10), tickStep(5), tickStep(1)]).toEqual([
      1, 2, 5, 10, 10,
    ]);
  });

  it('põe o período por último no painel de todo gráfico', () => {
    for (const c of CHARTS) {
      const order = filterOrder(c.filters);
      expect(order.toSorted(), c.id).toEqual([...c.filters].sort());
      if (c.filters.includes('periodo')) expect(order.at(-1), c.id).toBe('periodo');
    }
    expect(filterOrder(['periodo', 'laco', 'grupo', 'nivel'])).toEqual([
      'grupo',
      'laco',
      'nivel',
      'periodo',
    ]);
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

describe('intervalo de anos', () => {
  it('marca início e fim em dois cliques, em qualquer ordem', () => {
    expect(pickYear(undefined, 2015)).toEqual({ pending: 2015 });
    expect(pickYear(2015, 2010)).toEqual({ done: { from: 2010, to: 2015 } });
    expect(pickYear(2015, 2020)).toEqual({ done: { from: 2015, to: 2020 } });
    expect(orderedRange(3, 3)).toEqual({ from: 3, to: 3 });
  });

  it('mostra a prévia e o estado de cada ano', () => {
    const value = { from: 2009, to: 2026 };
    expect(shownRange(value, undefined, 2012)).toBe(value);
    expect(shownRange(value, 2015, 2012)).toEqual({ from: 2012, to: 2015 });
    expect(shownRange(value, 2015, undefined)).toEqual({ from: 2015, to: 2015 });
    expect([2008, 2009, 2010, 2026].map((y) => cellState(y, value))).toEqual([
      'out',
      'end',
      'in',
      'end',
    ]);
    expect(formatRange(value)).toBe('2009 – 2026');
    expect(formatRange({ from: 2020, to: 2020 })).toBe('2020');
  });
});
