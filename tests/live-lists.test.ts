import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import type { AreaNode, Course } from '../src/bridge/lattes-lists.ts';
import { getAttr, parseXml, type XElement } from '../src/model/xml.ts';
import {
  applyAgency,
  applyCourse,
  applyInstitution,
  applyOrgan,
  applyUnit,
  areaOptions,
  bigAreaValue,
  EMPTY_AREA,
  findAgency,
  findArea,
  findCourse,
  findOrgan,
  formationLevel,
  institutionOf,
  isAreaElement,
  itemNature,
  LISTS_MAX_AGE_MS,
  type LiveAvailability,
  liveKind,
  livePairs,
  needsRefresh,
  readArea,
  sameCode,
  splitCourse,
  withoutLetter,
  writeArea,
} from '../src/ui/live-lists.ts';

const TREE: AreaNode[] = [
  {
    b: [
      {
        b: [{ b: [{ c: '10101055', l: 'Álgebra Comutativa' }], c: '10101004', l: 'Álgebra' }],
        c: '10100008',
        l: 'Matemática',
      },
    ],
    c: '10000003',
    l: 'Ciências Exatas e da Terra',
  },
  { b: [{ c: '80300006', l: 'Artes' }], c: '80000002', l: 'Lingüística, Letras e Artes' },
  { b: [{ c: '90100000', l: 'Bioética' }], c: '90000005', l: 'Outra' },
  // Grande área que o XSD não conhece: fica de fora da lista.
  { b: [{ c: '99100000', l: 'Nova' }], c: '99000000', l: 'Grande Área Nova' },
];

const el = (xml: string): XElement => parseXml(xml).root;

const NONE: LiveAvailability = { courses: false, search: false };
const ALL: LiveAvailability = {
  agencies: [{ code: '000000000001', name: 'CNPq' }],
  areas: TREE,
  courses: true,
  search: true,
};

describe('cópia das listas', () => {
  it('pede de novo sem cópia, com cópia de mais de um dia ou do futuro', () => {
    expect(needsRefresh(undefined, 1000)).toBe(true);
    expect(needsRefresh(1000, 1000 + LISTS_MAX_AGE_MS)).toBe(false);
    expect(needsRefresh(1000, 1001 + LISTS_MAX_AGE_MS)).toBe(true);
    expect(needsRefresh(2000, 1000)).toBe(true);
  });
});

describe('áreas do conhecimento', () => {
  it('grande área pelo nome, no valor do XSD; "Outra" é OUTROS', () => {
    expect(bigAreaValue('Ciências Exatas e da Terra')).toBe('CIENCIAS_EXATAS_E_DA_TERRA');
    expect(bigAreaValue('Lingüística, Letras e Artes')).toBe('LINGUISTICA_LETRAS_E_ARTES');
    expect(bigAreaValue('Outra')).toBe('OUTROS');
    expect(bigAreaValue('Grande Área Nova')).toBeUndefined();
  });

  it('as opções vão da área para baixo, sem grande área sozinha', () => {
    const options = areaOptions(TREE);
    expect(options.map((o) => [o.value, o.label])).toEqual([
      ['10100008', 'Matemática'],
      ['10101004', 'Matemática › Álgebra'],
      ['10101055', 'Matemática › Álgebra › Álgebra Comutativa'],
      ['80300006', 'Artes'],
      ['90100000', 'Bioética'],
    ]);
    expect(options[2]!.area).toEqual({
      area: 'Matemática',
      bigArea: 'CIENCIAS_EXATAS_E_DA_TERRA',
      specialty: 'Álgebra Comutativa',
      subArea: 'Álgebra',
    });
    expect(areaOptions(TREE)).toBe(options);
  });

  it('acha a opção pelos nomes guardados, sem acento e caixa', () => {
    const area = {
      area: 'MATEMATICA',
      bigArea: 'CIENCIAS_EXATAS_E_DA_TERRA',
      specialty: '',
      subArea: 'algebra',
    };
    expect(findArea(TREE, area)?.value).toBe('10101004');
    expect(findArea(TREE, { ...area, bigArea: 'ENGENHARIAS' })).toBeUndefined();
    expect(findArea(TREE, EMPTY_AREA)).toBeUndefined();
  });

  it('lê e grava os quatro nomes juntos', () => {
    const area = el(
      '<AREA-DO-CONHECIMENTO-1 NOME-GRANDE-AREA-DO-CONHECIMENTO="" NOME-DA-AREA-DO-CONHECIMENTO="Velha" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE=""/>',
    );
    expect(isAreaElement(area.name)).toBe(true);
    expect(isAreaElement('AREA-DE-ATUACAO')).toBe(true);
    expect(isAreaElement('INFORMACAO-ADICIONAL-CURSO')).toBe(false);
    expect(writeArea(area, areaOptions(TREE)[2]!.area)).toBe(true);
    expect(readArea(area)).toEqual(areaOptions(TREE)[2]!.area);
    expect(writeArea(area, areaOptions(TREE)[2]!.area)).toBe(false);
  });
});

describe('formação: instituição, curso e agência', () => {
  it('nível da formação como no combo do Lattes', () => {
    expect(formationLevel('DOUTORADO')).toBe('4');
    expect(formationLevel('APERFEICOAMENTO')).toBe('X');
    expect(formationLevel('ARTIGO-PUBLICADO')).toBeUndefined();
  });

  it('o código do XML não tem a letra da busca', () => {
    expect(withoutLetter('V007900000004')).toBe('007900000004');
    expect(withoutLetter(' A33003025 ')).toBe('33003025');
    expect(withoutLetter('001000000998')).toBe('001000000998');
    expect(sameCode('D001000000998', '001000000998')).toBe(true);
    expect(sameCode('001000000998', '001000000998')).toBe(true);
    expect(sameCode('D001000000998', '')).toBe(false);
  });

  it('instituição grava código e nome; trocar de instituição limpa o curso', () => {
    const doc = el(
      '<DOUTORADO CODIGO-INSTITUICAO="001" NOME-INSTITUICAO="Antiga" CODIGO-CURSO="1" NOME-CURSO="Curso" CODIGO-CURSO-CAPES="X"/>',
    );
    const unicamp = {
      code: 'V007900000004',
      label: 'UNICAMP (SP)',
      name: 'Universidade Estadual de Campinas',
    };
    expect(applyInstitution(doc, unicamp)).toBe(true);
    expect(getAttr(doc, 'CODIGO-INSTITUICAO')).toBe('007900000004');
    expect(getAttr(doc, 'NOME-INSTITUICAO')).toBe('Universidade Estadual de Campinas');
    expect(getAttr(doc, 'NOME-CURSO')).toBe('');
    expect(getAttr(doc, 'CODIGO-CURSO-CAPES')).toBe('');
    // Instituição sem código antes (texto livre): o curso fica.
    const free = el('<MESTRADO CODIGO-INSTITUICAO="" NOME-INSTITUICAO="Unicamp" NOME-CURSO="C"/>');
    applyInstitution(free, unicamp);
    expect(getAttr(free, 'NOME-CURSO')).toBe('C');
  });

  it('curso: nome sem o código CAPES, código sem a letra, e o CAPES', () => {
    expect(splitCourse('Administração(33003025005P3)')).toEqual({
      capes: '33003025005P3',
      name: 'Administração',
    });
    expect(splitCourse(' Sem CAPES ')).toEqual({ capes: '', name: 'Sem CAPES' });
    expect(splitCourse('(só código)')).toEqual({ capes: '', name: '(só código)' });
    const courses: Course[] = [
      { label: 'Administração(33003025005P3)', value: 'V33003025' },
      { label: 'Computação (33003017001P0)', value: 'V33003017' },
    ];
    const doc = el(
      '<DOUTORADO CODIGO-INSTITUICAO="007900000004" CODIGO-CURSO="" NOME-CURSO="computacao"/>',
    );
    expect(findCourse(courses, doc)?.value).toBe('V33003017');
    expect(applyCourse(doc, courses[0])).toBe(true);
    expect(getAttr(doc, 'CODIGO-CURSO')).toBe('33003025');
    expect(getAttr(doc, 'NOME-CURSO')).toBe('Administração');
    // CODIGO-CURSO-CAPES existe no DOUTORADO do esquema, mesmo ausente do elemento.
    expect(getAttr(doc, 'CODIGO-CURSO-CAPES')).toBe('33003025005P3');
    expect(findCourse(courses, doc)?.value).toBe('V33003025');
    expect(findCourse(courses, el('<DOUTORADO NOME-CURSO=""/>'))).toBeUndefined();
    expect(applyCourse(doc, undefined)).toBe(true);
    expect(getAttr(doc, 'NOME-CURSO')).toBe('');
  });

  it('agência: código e nome juntos, e marca a bolsa', () => {
    const agencies = [{ code: '000000000001', name: 'Conselho Nacional (CNPq)' }];
    const doc = el(
      '<MESTRADO FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="conselho nacional (cnpq)"/>',
    );
    expect(findAgency(agencies, doc)).toBe(agencies[0]);
    expect(applyAgency(doc, agencies[0])).toBe(true);
    expect(getAttr(doc, 'CODIGO-AGENCIA-FINANCIADORA')).toBe('000000000001');
    expect(getAttr(doc, 'FLAG-BOLSA')).toBe('SIM');
    expect(findAgency(agencies, doc)).toBe(agencies[0]);
    expect(findAgency([], doc)).toBeUndefined();
    expect(findAgency(agencies, el('<MESTRADO NOME-AGENCIA=""/>'))).toBeUndefined();
    expect(applyAgency(doc, undefined)).toBe(true);
    expect(getAttr(doc, 'NOME-AGENCIA')).toBe('');
  });
});

describe('que campo vira qual lista', () => {
  const area = (attrs: string) => el(`<AREA-DE-ATUACAO ${attrs}/>`);

  it('sem cópia e sem conector, nenhum campo muda', () => {
    const doc = el('<DOUTORADO CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="X" NOME-AGENCIA=""/>');
    for (const attr of ['NOME-INSTITUICAO', 'NOME-CURSO', 'NOME-AGENCIA']) {
      expect(liveKind(doc, attr, NONE)).toBeUndefined();
    }
    expect(liveKind(area(''), 'NOME-DA-AREA-DO-CONHECIMENTO', NONE)).toBeUndefined();
  });

  it('área: o nome da área escolhe; os outros três seguem quando a combinação está na árvore', () => {
    expect(liveKind(area(''), 'NOME-DA-AREA-DO-CONHECIMENTO', ALL)).toBe('area');
    expect(liveKind(area(''), 'NOME-DA-ESPECIALIDADE', ALL)).toBe('area-derivada');
    const known = area(
      'NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_EXATAS_E_DA_TERRA" NOME-DA-AREA-DO-CONHECIMENTO="Matemática"',
    );
    expect(liveKind(known, 'NOME-GRANDE-AREA-DO-CONHECIMENTO', ALL)).toBe('area-derivada');
    const odd = area('NOME-DA-AREA-DO-CONHECIMENTO="Fora da tabela"');
    expect(liveKind(odd, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO', ALL)).toBeUndefined();
    expect(liveKind(known, 'SEQUENCIA-AREA-DE-ATUACAO', ALL)).toBeUndefined();
  });

  it('instituição e curso só na formação; curso depois da instituição e com curso no nível', () => {
    const doc = el('<DOUTORADO CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="X" NOME-CURSO=""/>');
    expect(liveKind(doc, 'NOME-INSTITUICAO', ALL)).toBe('instituicao');
    expect(liveKind(doc, 'NOME-CURSO', ALL)).toBe('curso');
    expect(liveKind(doc, 'NOME-AGENCIA', ALL)).toBe('agencia');
    expect(liveKind(doc, 'NOME-AGENCIA', { ...ALL, agencies: [] })).toBeUndefined();
    // O sanduíche e a cotutela também se escolhem na busca (Fase 2).
    expect(liveKind(doc, 'NOME-INSTITUICAO-DOUT', ALL)).toBe('instituicao');
    const noInst = el('<DOUTORADO CODIGO-INSTITUICAO="" NOME-CURSO=""/>');
    expect(liveKind(noInst, 'NOME-CURSO', ALL)).toBeUndefined();
    const residency = el('<RESIDENCIA-MEDICA CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="X"/>');
    expect(liveKind(residency, 'NOME-CURSO', ALL)).toBeUndefined();
    expect(liveKind(residency, 'NOME-INSTITUICAO', ALL)).toBe('instituicao');
    const work = el('<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="X"/>');
    expect(liveKind(work, 'NOME-INSTITUICAO', ALL)).toBeUndefined();
    expect(liveKind(doc, 'NOME-INSTITUICAO', { ...ALL, search: false })).toBeUndefined();
  });
});

describe('cópia guardada no banco', () => {
  it('sem chave não guarda; com chave guarda cifrado e lê de volta', async () => {
    const { loadCachedList, saveCachedList } = await import('../src/model/list-cache.ts');
    const store = await import('../src/model/store.ts');
    const { importStorageKey, randomKeyBytes } = await import('../src/model/seal.ts');
    await saveCachedList('areas', TREE, 1);
    expect(await loadCachedList('areas')).toBeUndefined();
    await store.openStorage(await importStorageKey(randomKeyBytes()));
    await saveCachedList('areas', TREE, 5);
    expect(await loadCachedList<AreaNode[]>('areas')).toEqual({ items: TREE, readAt: 5 });
    const [row] = await store.db.lists.toArray();
    expect(JSON.stringify(row)).not.toContain('Matemática');
    expect(await loadCachedList('agencias')).toBeUndefined();
    await store.db.lists.update('areas', { sealed: { ...row!.sealed, data: new ArrayBuffer(8) } });
    expect(await loadCachedList('areas')).toBeUndefined();
  });
});

describe('escolhas pela lista em orientações, bancas e no sanduíche (Fase 2)', () => {
  const LIVE_ALL: LiveAvailability = {
    agencies: [{ code: '000000000001', name: 'CNPq' }],
    courses: true,
    production: true,
    search: true,
  };
  const orientation = () =>
    parseXml(
      '<DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO NOME-DA-INSTITUICAO="Antiga" CODIGO-INSTITUICAO="000000000009" NOME-DO-CURSO="Curso antigo" CODIGO-CURSO="00000009" FLAG-BOLSA="NAO" NOME-DA-AGENCIA="" CODIGO-AGENCIA-FINANCIADORA=""/>',
    ).root;

  it('a orientação usa os seus atributos e a lista de cursos TESE', () => {
    const pairs = livePairs('DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO');
    expect(pairs).toMatchObject({
      agency: { flag: 'FLAG-BOLSA', name: 'NOME-DA-AGENCIA' },
      course: { level: '3', name: 'NOME-DO-CURSO', program: 'TESE', staArea: '' },
      institution: { name: 'NOME-DA-INSTITUICAO' },
      production: true,
    });
    // Pós-doutorado não tem curso.
    expect(
      livePairs('DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO')?.course,
    ).toBeUndefined();
  });

  it('num tipo com várias naturezas, o nível do curso vem da natureza do item', () => {
    expect(livePairs('DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS')?.course).toMatchObject({
      byNature: {
        iniciacao_cientifica: { level: '1', staArea: '' },
        monografia_de_conclusao_de_curso_aperfeicoamento_e_especializacao: {
          level: '2',
          staArea: 'N',
        },
        'orientacao-de-outra-natureza': { level: '1', staArea: '' },
        trabalho_de_conclusao_de_curso_graduacao: { level: '1', staArea: 'N' },
      },
      program: 'TESE',
    });
    expect(
      livePairs('DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO')?.course?.byNature,
    ).toEqual({
      'exame de qualificacao de doutorado': { level: '4', staArea: 'N' },
      'exame de qualificacao de mestrado': { level: '3', staArea: '' },
    });
    const root = parseXml(
      '<OUTRAS-ORIENTACOES-CONCLUIDAS><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NATUREZA="INICIACAO_CIENTIFICA"/><DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS CODIGO-INSTITUICAO="000000000001" CODIGO-CURSO="" NOME-DO-CURSO=""/></OUTRAS-ORIENTACOES-CONCLUIDAS>',
    ).root;
    const detail = root.children.find(
      (c): c is XElement => c.kind === 'element' && c.name.startsWith('DETALHAMENTO'),
    )!;
    expect(itemNature(root, detail)).toBe('INICIACAO_CIENTIFICA');
    expect(liveKind(detail, 'NOME-DO-CURSO', LIVE_ALL)).toBe('curso');
  });

  it('sem a capacidade buscas-producao, a orientação fica como era', () => {
    const el = orientation();
    expect(liveKind(el, 'NOME-DA-INSTITUICAO', LIVE_ALL)).toBe('instituicao');
    expect(liveKind(el, 'NOME-DO-CURSO', LIVE_ALL)).toBe('curso');
    expect(liveKind(el, 'NOME-DA-AGENCIA', LIVE_ALL)).toBe('agencia');
    expect(liveKind(el, 'NOME-DA-INSTITUICAO', { ...LIVE_ALL, production: false })).toBeUndefined();
  });

  it('instituição nova limpa o curso; curso e agência gravam nos atributos da orientação', () => {
    const el = orientation();
    applyInstitution(el, { code: 'V000000000001', label: 'UFRGS', name: 'UFRGS' });
    expect(getAttr(el, 'CODIGO-INSTITUICAO')).toBe('000000000001');
    expect(getAttr(el, 'NOME-DO-CURSO')).toBe('');
    applyCourse(el, { label: 'Botânica(42001013004P0)', value: 'V00000002 ' });
    expect(getAttr(el, 'NOME-DO-CURSO')).toBe('Botânica');
    expect(getAttr(el, 'CODIGO-CURSO')).toBe('00000002');
    applyAgency(el, { code: '000000000001', name: 'CNPq' });
    expect(getAttr(el, 'NOME-DA-AGENCIA')).toBe('CNPq');
    expect(getAttr(el, 'FLAG-BOLSA')).toBe('SIM');
  });

  it('a instituição do sanduíche se escolhe na busca e não mexe no curso', () => {
    const el = parseXml(
      '<DOUTORADO CODIGO-INSTITUICAO="000000000001" NOME-INSTITUICAO="UFRGS" CODIGO-CURSO="00000001" NOME-CURSO="Botânica" CODIGO-INSTITUICAO-DOUT="" NOME-INSTITUICAO-DOUT=""/>',
    ).root;
    expect(liveKind(el, 'NOME-INSTITUICAO-DOUT', LIVE_ALL)).toBe('instituicao');
    applyInstitution(
      el,
      { code: 'V000000000002', label: 'USP', name: 'USP' },
      'NOME-INSTITUICAO-DOUT',
    );
    expect(getAttr(el, 'CODIGO-INSTITUICAO-DOUT')).toBe('000000000002');
    expect(getAttr(el, 'NOME-INSTITUICAO-DOUT')).toBe('USP');
    expect(getAttr(el, 'NOME-CURSO')).toBe('Botânica');
  });
});

describe('órgão e unidade do projeto (Fase 2)', () => {
  const ORGANS: LiveAvailability = { courses: true, organs: true, search: true };
  const cv = () =>
    parseXml(
      '<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="000000000001"><ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO><PARTICIPACAO-EM-PROJETO CODIGO-ORGAO="" NOME-ORGAO="" CODIGO-UNIDADE="" NOME-UNIDADE=""/></ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO></ATUACAO-PROFISSIONAL>',
    ).root;
  const participationOf = (root: XElement) =>
    (root.children[0] as XElement).children[0] as XElement;

  it('o órgão se escolhe com o conector; a unidade, depois do órgão', () => {
    const root = cv();
    const p = participationOf(root);
    expect(liveKind(p, 'NOME-ORGAO', ORGANS)).toBe('orgao');
    expect(liveKind(p, 'NOME-UNIDADE', ORGANS)).toBeUndefined();
    expect(liveKind(p, 'NOME-ORGAO', { ...ORGANS, organs: false })).toBeUndefined();
    expect(institutionOf(root, p)).toBe('000000000001');
    expect(institutionOf(undefined, p)).toBe('');

    expect(applyOrgan(p, { code: '000001000008', kind: '0', name: 'Instituto' })).toBe(true);
    expect(liveKind(p, 'NOME-UNIDADE', ORGANS)).toBe('unidade');
    applyUnit(p, {
      code: '000001001004',
      kind: '0',
      name: 'Departamento',
      parent: 'Instituto',
    });
    expect(getAttr(p, 'CODIGO-UNIDADE')).toBe('000001001004');
    // Outro órgão leva a unidade embora.
    applyOrgan(p, { code: '000002000004', kind: '0', name: 'Outro' });
    expect([getAttr(p, 'CODIGO-ORGAO'), getAttr(p, 'CODIGO-UNIDADE')]).toEqual([
      '000002000004',
      '',
    ]);
  });

  it('acha o órgão salvo pelo código, ou pelo nome sem código', () => {
    const organs = [
      { code: '000001000008', kind: '0', name: 'Instituto de Biociências' },
      { code: '000002000004', kind: '0', name: 'Instituto de Informática' },
    ];
    expect(findOrgan(organs, '000002000004', '')?.name).toBe('Instituto de Informática');
    expect(findOrgan(organs, '', 'instituto de biociencias')?.code).toBe('000001000008');
    expect(findOrgan(organs, '', '')).toBeUndefined();
  });
});
