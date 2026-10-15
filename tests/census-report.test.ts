import { describe, expect, it } from 'vitest';

import type { CensusField, CensusForm } from '../src/census/census-page.ts';
import { guessByName, KNOWN_LINKS, knownLinks } from '../src/census/known-links.ts';
import type { FieldLink } from '../src/census/link.ts';
import {
  compareWithAccepted,
  coverage,
  type FieldInfo,
  observedChoice,
  optionsOf,
  subtrees,
} from '../src/census/report.ts';
import { renderReport } from '../src/census/report-render.ts';
import type { CensusFile } from '../src/census/run.ts';
import type { CensusTarget } from '../src/census/targets.ts';
import { CENSUS_TARGETS } from '../src/census/targets-production.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

const target = (id: string, elements: string[]): CensusTarget => ({
  elements,
  elementsProvenance: 'inferido',
  id,
  itemKey: 'f_seq',
  label: id,
  locate: { kind: 'fixed', params: {}, proc: `${id}.form` },
  provenance: 'observado',
  source: 'teste',
});

const form = (fields: CensusField[], hidden: string[] = []): CensusForm => ({
  action: 'X.FORM',
  fields,
  hidden,
  identity: {},
  method: 'post',
  name: 'GN_X',
  unnamed: 0,
});

function file(at: string, entries: [string, CensusForm][], links: FieldLink[] = []): CensusFile {
  return {
    capturedAt: at,
    collector: 'teste',
    entries: entries.map(([id, f]) => ({
      elements: [],
      elementsProvenance: 'inferido',
      id,
      label: id,
      page: { forms: [f], title: '' },
      provenance: 'observado',
      source: 'teste',
      status: 'ok',
    })),
    format: 1,
    links,
    lists: {
      f_pais: [
        { label: 'Brasil', value: 'BRA' },
        { label: 'Atlântida', value: 'ATL' },
      ],
    },
    origin: 'teste',
  };
}

const text = (name: string): CensusField => ({ label: name, name, type: 'text' });
const radio = (name: string, options: CensusField['options'] = []): CensusField => ({
  label: name,
  name,
  options,
  type: 'radio',
});

const link = (
  field: string,
  element: string,
  attribute: string,
  extra: Partial<FieldLink> = {},
): FieldLink => ({
  attribute,
  by: 'valor',
  conflicts: 0,
  element,
  field,
  matches: 2,
  target: 't',
  ...extra,
});

describe('censo: palpite pelo nome do campo', () => {
  const attrs = ['ANO-DA-PREMIACAO', 'NOME-DO-PREMIO-OU-TITULO', 'NOME-DO-PREMIO-OU-TITULO-INGLES'];
  it('liga pelo nome quando só um atributo serve', () => {
    expect(guessByName('f_ano', attrs)).toBe('ANO-DA-PREMIACAO');
    expect(guessByName('f_ano', ['ANO', 'ANO-INICIO'])).toBe('ANO');
    expect(guessByName('f_titulo_en', ['TITULO', 'TITULO-INGLES'])).toBe('TITULO-INGLES');
    expect(guessByName('f_titulo', ['TITULO', 'TITULO-INGLES'])).toBe('TITULO');
    expect(guessByName('F_TEXTO_EN', ['TEXTO-RESUMO-CV-RH', 'TEXTO-RESUMO-CV-RH-EN'])).toBe(
      'TEXTO-RESUMO-CV-RH-EN',
    );
    expect(guessByName('f_nme_agencia', ['NOME-AGENCIA', 'CODIGO-AGENCIA'])).toBe('NOME-AGENCIA');
    expect(guessByName('f_munic_r', ['CIDADE'])).toBeUndefined();
  });

  it('não liga controle, empate nem campo sem nome', () => {
    expect(guessByName('f_cod', ['CODIGO'])).toBeUndefined();
    expect(guessByName('f_seq', ['SEQUENCIA-PRODUCAO'])).toBeUndefined();
    expect(guessByName('f_ano', ['ANO-INICIO', 'ANO-FIM'])).toBeUndefined();
    expect(guessByName('f_', ['ANO'])).toBeUndefined();
    expect(guessByName('f_xyz', attrs)).toBeUndefined();
  });

  it('as ligações conhecidas apontam para atributos do schema', () => {
    const all = new Set(
      Object.values(lattesSchema.elements).flatMap((e) => e.attributes.map((a) => a.name)),
    );
    for (const links of Object.values(KNOWN_LINKS)) {
      for (const l of links) expect(all.has(l.attribute.split('@').pop()!)).toBe(true);
    }
    expect(knownLinks('formacao-FA-3').some((l) => l.field === 'F_STATUS')).toBe(true);
    expect(knownLinks('formacao-complementar').some((l) => l.field === 'F_STATUS')).toBe(false);
    expect(knownLinks('projeto-P').length).toBeGreaterThan(5);
  });
});

describe('censo: ligação observada', () => {
  const info = (name: string, hidden = false): [string, FieldInfo] => [
    name.toLowerCase(),
    { hidden, index: 0, name },
  ];
  const fields = new Map([
    info('f_inst'),
    info('f_inst_old', true),
    info('f_ano_fim'),
    info('f_ano_obten'),
    info('F_X'),
    info('F_Y'),
  ]);

  it('ambíguo não liga, e o visível ganha do oculto', () => {
    const seen = observedChoice(
      [
        link('f_inst', 'M', 'NOME-INSTITUICAO'),
        link('f_inst_old', 'M', 'NOME-INSTITUICAO'),
        link('f_ano_fim', 'M', 'ANO-DE-CONCLUSAO'),
        link('f_ano_fim', 'M', 'ANO-DE-OBTENCAO-DO-TITULO'),
        link('f_ano_obten', 'M', 'ANO-DE-OBTENCAO-DO-TITULO', { matches: 3 }),
        link('F_X', 'M', 'A', { by: 'enumeracao', valueMap: { N: 'NAO', S: 'SIM' } }),
        link('F_Y', 'M', 'B', { by: 'enumeracao', valueMap: { N: 'NAO', S: 'NAO' } }),
        link('fora', 'M', 'C'),
        link('f_inst', 'M', 'D', { conflicts: 2, matches: 1 }),
      ],
      fields,
    );
    expect(Object.fromEntries(seen)).toEqual({
      'M@A': 'F_X',
      'M@ANO-DE-OBTENCAO-DO-TITULO': 'f_ano_obten',
      'M@NOME-INSTITUICAO': 'f_inst',
    });
  });
});

describe('censo: cobertura e divergências', () => {
  const targets = [
    target('premio', ['PREMIO-TITULO']),
    target('idioma', ['IDIOMA']),
    target('licenca', ['LICENCA']),
  ];

  it('sem captura, tudo é lacuna e nada diverge', () => {
    const cov = coverage({ files: [], targets });
    expect(cov.rows.every((r) => r.group === 'sem-captura')).toBe(true);
    expect(cov.disagreements).toEqual([]);
    expect(cov.uncovered).toContain('DADOS-GERAIS');
    const md = renderReport(targets, cov);
    expect(md).toContain('Formulários no censo: 3, com captura: 0, sem captura: 3.');
    expect(md).toContain('Nenhuma.');
    expect(md).not.toContain('<details>');
  });

  it('agrupa pelo campo ligado e aponta lista não ligada, lista diferente e ordem', () => {
    const old = file('2026-10-01T00:00:00Z', [['premio', form([text('velho')])]]);
    const premio = form(
      [text('f_ano'), text('f_titulo'), radio('f_agencia', [{ label: 'X', value: 'X' }])],
      ['f_cod'],
    );
    const idioma = form([
      radio('F_LE', [{ label: 'pouco', value: 'P' }]),
      { label: 'Idioma', name: 'F_COD_IDIOMA', options: 'f_pais', type: 'select-one' },
    ]);
    const now = file(
      '2026-10-15T00:00:00Z',
      [
        ['premio', premio],
        ['idioma', idioma],
      ],
      [
        { ...link('f_titulo', 'PREMIO-TITULO', 'NOME-DO-PREMIO-OU-TITULO'), target: 'premio' },
        { ...link('f_agencia', 'PREMIO-TITULO', 'NOME-DA-ENTIDADE-PROMOTORA'), target: 'premio' },
        { ...link('f_ano', 'PREMIO-TITULO', 'ANO-DA-PREMIACAO'), target: 'premio' },
      ],
    );
    const slot = (el: string, attr: string) =>
      el === 'PREMIO-TITULO'
        ? {
            rank: [
              'NOME-DO-PREMIO-OU-TITULO',
              'NOME-DA-ENTIDADE-PROMOTORA',
              'ANO-DA-PREMIACAO',
            ].indexOf(attr),
          }
        : undefined;
    const cov = coverage({ files: [now, old], formSlot: slot, targets });
    const row = (attr: string) => cov.rows.find((r) => r.attribute === attr)!;
    expect(row('ANO-DA-PREMIACAO')).toMatchObject({
      field: 'f_ano',
      group: 'texto',
      link: 'observado',
    });
    expect(row('NOME-DA-ENTIDADE-PROMOTORA')).toMatchObject({ group: 'opcoes', link: 'observado' });
    expect(row('NOME-DO-PREMIO-OU-TITULO-INGLES').group).toBe('fora');
    expect(row('PROFICIENCIA-DE-LEITURA')).toMatchObject({ field: 'F_LE', link: 'documentado' });
    expect(row('TIPO-LICENCA').group).toBe('sem-captura');
    expect(cov.captured.get('premio')!.at).toBe('2026-10-15T00:00:00Z');
    expect(cov.disagreements.map((d) => d.key)).toEqual([
      // IDIOMA@IDIOMA é código do Lattes no editor (só leitura): não conta.
      'lista-nao-ligada:premio:PREMIO-TITULO@NOME-DA-ENTIDADE-PROMOTORA:f_agencia',
      'ordem:premio:PREMIO-TITULO',
    ]);
    const md = renderReport(targets, cov, [{ key: 'ordem:premio:PREMIO-TITULO', reason: 'teste' }]);
    expect(md).toContain('(aceita: teste)');
    expect(md).toContain('<details><summary>premio (premio)</summary>');
    expect(md).toContain('`PREMIO-TITULO@ANO-DA-PREMIACAO` ← `f_ano` (observado)');

    // Lista ligada a typed-choices com opções diferentes: país.
    const evento = target('evento', ['PARTICIPACAO-EM-CONGRESSO']);
    const ev = file('2026-10-16T00:00:00Z', [
      [
        'evento',
        form([
          { label: 'País', name: 'f_pais', options: 'f_pais', type: 'select-one' },
          text('f_ano'),
        ]),
      ],
    ]);
    const evCov = coverage({ files: [ev], targets: [evento] });
    const diff = evCov.disagreements.find((d) => d.key.startsWith('lista-diferente'))!;
    expect(diff.key).toBe('lista-diferente:evento:DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@PAIS');
    expect(diff.detail).toMatch(/novas no Lattes: Atlântida; só no editor: .* e mais \d+/);
  });

  it('opções por referência e pendências aceitas', () => {
    expect(optionsOf({ label: '', name: 'x', options: 'nada', type: 'radio' }, {})).toEqual([]);
    expect(optionsOf({ label: '', name: 'x', type: 'text' }, {})).toEqual([]);
    const found = [
      { detail: 'a', key: 'a' },
      { detail: 'b', key: 'b' },
    ];
    expect(compareWithAccepted(found, ['b', 'c'])).toEqual({ fresh: [found[0]], resolved: ['c'] });
  });

  it('cada entrada cobre o item e as partes, sem entrar no de outra', () => {
    const trees = subtrees(CENSUS_TARGETS);
    expect(trees.get('identificacao')).toEqual(['DADOS-GERAIS']);
    expect(trees.get('trabalho-tecnico')).toEqual(
      expect.arrayContaining(['DADOS-BASICOS-DO-TRABALHO-TECNICO', 'AUTORES', 'PALAVRAS-CHAVE']),
    );
    expect(trees.get('atuacao')).not.toContain('VINCULOS');
  });
});
