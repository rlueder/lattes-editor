import { afterEach, describe, expect, it } from 'vitest';

import {
  AGENCIES as SIMULATED_AGENCIES,
  AREAS as SIMULATED_AREAS,
} from '../scripts/lattes-simulado/buscas.ts';
import {
  agenciesPath,
  countAreas,
  coursesPath,
  institutionSearchPath,
  latin1Param,
  type ListsPort,
  parseAgencies,
  parseAreaTree,
  parseCourses,
  parseInstitutions,
  parseJsLiteral,
  readCourses,
  readLists,
  searchInstitutions,
  selectEntries,
} from '../src/bridge/lattes-lists.ts';
import { checkSources, listText, unreadSources } from '../src/bridge/list-watch.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

// Fixtures feitas à mão, no formato descrito em docs/lattes_internals.md
// (seção 18): poucos nós do areaDP num menu falso, uma resposta da busca de
// instituição, a lista de agências e o combo de cursos.

const AREAS = `[
  {"l":"Ciências Exatas e da Terra","n":"1","c":"10000003","b":[
    {"l":"Matemática","n":"2","c":"10100008","b":[
      {"l":"Álgebra","n":"3","c":"10101004","b":[
        {"l":"Álgebra Comutativa","n":"4","c":"10101055"}
      ]}
    ]}
  ]},
  {"l":"Lingüística, Letras e Artes","n":"1","c":"80000002","b":[
    {"l":"Artes","n":"2","c":"80300006"}
  ]},
  {"l":"Outra","n":"1","c":"90000005"}
]`;

const MENU = `<html><head><script type="text/javascript">
  var autorDP = [{l: 'Fulano', c: '1', t: 'A', deletable: true}];
  var areaDP = ${AREAS};
  var setorDP = [];
</script></head><body>
<a onclick="modalCV1.setarUrl(&quot;pkg_idioma.lista?f_cod=K000000000&quot;, true)">Idiomas</a>
</body></html>`;

const AGENCIES = `<table>
<tr><td><a href="javascript:atribuir('000000000001','Conselho Nacional de Desenvolvimento Cient&iacute;fico e Tecnol&oacute;gico')">CNPq</a></td></tr>
<tr><td><a href="javascript:atribuir('000000000002', 'Funda&ccedil;&atilde;o d\\'Amparo')">FX</a></td></tr>
<tr><td><a href="javascript:atribuir('000000000001','Repetida')">CNPq</a></td></tr>
<tr><td><a href="javascript:atribuir(codigo,'Variável')">?</a></td></tr>
</table>`;

const INSTITUTIONS = `<form name="instituicaoForm">
<a href="javascript:seleciona('M007900000004','Universidade Estadual de Campinas')"><font color="green">UNIVERSIDADE ESTADUAL DE CAMPINAS (SP)</font></a><br>
<a href="javascript:seleciona('V007900000099','Instituto de Computa&ccedil;&atilde;o')">INSTITUTO DE COMPUTAÇÃO (SP)</a><br>
Foram encontrados 2 registros.</form>`;

const COURSES = `<form name="GN_CURSO_FORM"><select name="f_curso">
<option value="">Selecione</option>
<option value="V33003025 ">Administração(33003025005P3)</option>
<option value='V33003017'>Ciência da Computação (33003017001P0)</option>
<option value=V33003099>Curso sem CAPES</option>
<option value="V33003099">Repetido</option>
</select></form>`;

describe('literal JavaScript sem eval', () => {
  it('lê arrays, objetos, textos com escape, números e constantes', () => {
    const src = `[{a: 'x\\'y', "b": "\\u00e9\\x41", c: -1.5, d: true, e: null, f: false, 1: [],}, /* c */ // l
    ]`;
    expect(parseJsLiteral(src).value).toEqual([
      { 1: [], a: "x'y", b: 'éA', c: -1.5, d: true, e: null, f: false },
    ]);
    expect(parseJsLiteral(`'a\\nb\\tc\\rd'`).value).toBe('a\nb\tc\rd');
  });

  it('recusa o que não é literal: chamada, variável, texto sem fim', () => {
    for (const bad of [
      '[alert(1)]',
      '[x]',
      "['sem fim",
      "['quebra\nde linha']",
      '{a 1}',
      '[1 2]',
      '{a: 1 b: 2}',
      '{-: 1}',
      "'\\x4'",
      "'\\",
      '/* sem fim',
    ]) {
      expect(() => parseJsLiteral(bad), bad).toThrow();
    }
    expect(() => parseJsLiteral('['.repeat(40) + ']'.repeat(40))).toThrow(/aninhamento/);
  });

  it('não cria propriedade especial com a chave __proto__', () => {
    const { value } = parseJsLiteral('{"__proto__": {"x": 1}}');
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect((value as Record<string, unknown>).__proto__).toEqual({ x: 1 });
  });
});

describe('áreas do conhecimento (areaDP do menu)', () => {
  it('lê a árvore compacta, com o nível pela profundidade', () => {
    const tree = parseAreaTree(MENU)!;
    expect(tree.map((n) => n.l)).toEqual([
      'Ciências Exatas e da Terra',
      'Lingüística, Letras e Artes',
      'Outra',
    ]);
    expect(tree[0]!.b![0]!.b![0]!.b![0]).toEqual({ c: '10101055', l: 'Álgebra Comutativa' });
    expect(countAreas(tree)).toBe(7);
  });

  it('aceita chaves sem aspas, aspas simples, código numérico e entidades', () => {
    const tree = parseAreaTree(`areaDP=[{l:'Ci&ecirc;ncias  Humanas',n:1,c:70000000}]`);
    expect(tree).toEqual([{ c: '70000000', l: 'Ciências Humanas' }]);
  });

  it('recusa a árvore fora do formato em vez de oferecer uma lista torta', () => {
    for (const bad of [
      '<p>sem tabela</p>',
      'areaDP = [];',
      'areaDP = new Array();',
      'areaDP = [{"l":"Sem código","n":"1"}];',
      'areaDP = [{"l":"Código curto","n":"1","c":"123"}];',
      'areaDP = [{"l":"Nível trocado","n":"2","c":"10000003"}];',
      'areaDP = [{"l":"Filhos","n":"1","c":"10000003","b":{}}];',
      'areaDP = [{"l":"Filho ruim","n":"1","c":"10000003","b":[1]}];',
      'areaDP = ["texto"];',
      'areaDP = [[]];',
      'areaDP = {};',
    ]) {
      expect(parseAreaTree(bad), bad).toBeUndefined();
    }
    const deep = (level: number): string =>
      `{"l":"N${level}","c":"1000000${level}"${level < 5 ? `,"b":[${deep(level + 1)}]` : ''}}`;
    expect(parseAreaTree(`areaDP = [${deep(1)}]`)).toBeUndefined();
    expect(parseAreaTree('areaDP = [{"l":"Sem filhos","c":"10000003","b":[]}]')).toEqual([
      { c: '10000003', l: 'Sem filhos' },
    ]);
  });
});

describe('agências, instituições e cursos', () => {
  it('lê as agências de atribuir(), sem repetidas nem chamada que não é só texto', () => {
    expect(parseAgencies(AGENCIES)).toEqual([
      {
        code: '000000000001',
        name: 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
      },
      { code: '000000000002', name: "Fundação d'Amparo" },
    ]);
    expect(parseAgencies(`atribuir('1','Nome &estranho;') atribuir('2', 'ok'`)).toEqual([]);
  });

  it('lê a busca de instituição com o texto do link, que traz a UF', () => {
    expect(parseInstitutions(INSTITUTIONS)).toEqual([
      {
        code: 'M007900000004',
        label: 'UNIVERSIDADE ESTADUAL DE CAMPINAS (SP)',
        name: 'Universidade Estadual de Campinas',
      },
      {
        code: 'V007900000099',
        label: 'INSTITUTO DE COMPUTAÇÃO (SP)',
        name: 'Instituto de Computação',
      },
    ]);
    expect(parseInstitutions("seleciona('V1','Sem link')")).toEqual([
      { code: 'V1', label: 'Sem link', name: 'Sem link' },
    ]);
  });

  it('lê os cursos do combo com o valor sem o espaço do fim', () => {
    expect(parseCourses(COURSES)).toEqual([
      { label: 'Administração(33003025005P3)', value: 'V33003025' },
      { label: 'Ciência da Computação (33003017001P0)', value: 'V33003017' },
      { label: 'Curso sem CAPES', value: 'V33003099' },
    ]);
    expect(parseCourses('<p>sem combo</p>')).toBeUndefined();
    expect(selectEntries('<select name="x"><option>sem valor</option></select>', 'x')).toEqual([]);
  });

  it('monta os endereços só de leitura, com o texto em Latin-1', () => {
    expect(latin1Param('São Paulo 100% & cia/ü€')).toBe('S%E3o%20Paulo%20100%20%26%20cia/%FC');
    expect(institutionSearchPath('K000000000', 'Unicamp')).toBe(
      'PRC_INST_FORM?F_CTR=C&F_COD=K000000000&F_NIVEL=4&F_STA_OUTRA=N&f_nome=Unicamp',
    );
    expect(institutionSearchPath('K000000000', 'X', '1')).toContain('F_NIVEL=1');
    // Orientação e banca: a lista TESE, com o f_sta_area da página.
    expect(coursesPath('K000000000', 'V007900000004', '2', 'TESE', 'N')).toBe(
      'prc_curso_form?f_pgm=TESE&f_cod=K000000000&f_inst=V007900000004&f_nivel=2&f_sta_area=N',
    );
    expect(coursesPath('K000000000', 'V007900000004', '4')).toBe(
      'prc_curso_form?f_cod=K000000000&f_pgm=FORM&f_nivel=4&f_inst=V007900000004',
    );
    expect(agenciesPath('K000000000')).toBe('prc_agencia?f_cod=K000000000');
  });
});

// As leituras pelo conector correm contra o Lattes simulado
// (scripts/lattes-simulado/), com a tabela de áreas no menu, a lista de
// agências e as buscas de instituição e de curso. As páginas trocadas por
// prefixo simulam o que o simulado não tem (lista vazia, rede caída, login).
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesPort(pages: Record<string, string | Error> = {}, menu?: string) {
  open ??= await withLattesSimulado();
  const lattes = open;
  const gets: string[] = [];
  const port: ListsPort = {
    async get(path) {
      gets.push(path);
      const hit = Object.entries(pages).find(([prefix]) => path.startsWith(prefix))?.[1];
      if (hit instanceof Error) throw hit;
      return hit ?? lattes.port.get(path);
    },
    menuHtml: () => menu ?? lattes.port.menuHtml(),
  };
  return { code: lattes.state.code, gets, menu: await lattes.port.menuHtml(), port };
}

const LOGON = '<form action="pkg_sec.logon">';

describe('leituras pelo conector', () => {
  it('lê áreas do menu da aba e agências num GET', async () => {
    const { code, gets, port } = await lattesPort();
    const r = await readLists(port);
    expect(r.error).toBeUndefined();
    expect(r.areas?.map((a) => a.c)).toEqual(SIMULATED_AREAS.map(([c]) => c));
    expect(r.agencies).toEqual(SIMULATED_AGENCIES.map(([c, name]) => ({ code: c, name })));
    expect(gets).toEqual([`prc_agencia?f_cod=${code}`]);
  });

  it('sem a tabela na aba, lê o menu de novo; uma lista que falha não leva a outra', async () => {
    const full = await lattesPort();
    const tabMenu = full.menu.replace(/var areaDP[^;]*\];/s, '');
    const { code, gets, port } = await lattesPort({ prc_agencia: new Error('rede') }, tabMenu);
    const r = await readLists(port);
    expect(gets).toEqual(['PKG_MENU.menu', `prc_agencia?f_cod=${code}`]);
    expect(r.areas).toHaveLength(SIMULATED_AREAS.length);
    expect(r.agencies).toBeUndefined();
    expect(r.error).toBe('A aba do Lattes não respondeu');
  });

  it('diz por que não veio: menu sem tabela, sem código, lista vazia, sessão caída', async () => {
    const bare = '<p>menu</p>';
    expect(await readLists((await lattesPort({ PKG_MENU: bare }, bare)).port)).toEqual({
      agencies: undefined,
      areas: undefined,
      error: 'A tabela de áreas não está no menu do Lattes; O código do currículo não está no menu',
    });
    expect((await readLists((await lattesPort({ prc_agencia: '<p></p>' })).port)).error).toBe(
      'A lista de agências veio vazia',
    );
    expect((await readLists((await lattesPort({}, LOGON)).port)).error).toMatch(/sessão/);
    const gone = await readLists((await lattesPort({ PKG_MENU: LOGON }, bare)).port);
    expect(gone.error).toMatch(/sessão do Lattes caiu/);
    const broken: ListsPort = {
      get: async () => '',
      menuHtml: () => Promise.reject(new Error('aba fechada')),
    };
    expect(await readLists(broken)).toEqual({ error: 'A aba do Lattes não respondeu' });
  });

  it('busca instituição só com 3 letras ou mais, e só com GET', async () => {
    const { gets, port } = await lattesPort();
    expect(await searchInstitutions(port, ' %Un ')).toEqual({ results: [] });
    expect(gets).toEqual([]);
    const r = await searchInstitutions(port, 'Campinas', '3');
    expect(r.results).toEqual([
      {
        code: 'V000000000003',
        label: 'UNIVERSIDADE ESTADUAL DE CAMPINAS (SP)',
        name: 'Universidade Estadual de Campinas',
      },
    ]);
    expect(gets[0]).toContain('F_NIVEL=3');
    // Instituição "macro" (letra M), que vai em f_cod_inst2.
    const macro = await searchInstitutions(port, 'Agropecuária');
    expect(macro.results?.map((i) => i.code)).toEqual(['M000000000004']);
    expect(await searchInstitutions((await lattesPort({}, '<p></p>')).port, 'Campinas')).toEqual({
      error: 'O código do currículo não está no menu',
    });
    expect(
      (await searchInstitutions((await lattesPort({ PRC_INST_FORM: LOGON })).port, 'Campinas'))
        .error,
    ).toMatch(/sessão/);
  });

  it('lê os cursos da instituição no nível', async () => {
    const { code, gets, port } = await lattesPort();
    const r = await readCourses(port, 'V000000000001', '4');
    expect(r.courses).toEqual([
      { label: 'Genética e Biologia Molecular', value: 'V00000001' },
      { label: 'Botânica', value: 'V00000002' },
    ]);
    expect(gets).toEqual([coursesPath(code, 'V000000000001', '4')]);
    expect(
      await readCourses((await lattesPort({ prc_curso_form: '<p></p>' })).port, 'V1', '4'),
    ).toEqual({
      error: 'A lista de cursos não veio na página do Lattes',
    });
    expect(await readCourses((await lattesPort({}, '<p></p>')).port, 'V1', '4')).toEqual({
      error: 'O código do currículo não está no menu',
    });
    expect(
      (await readCourses((await lattesPort({ prc_curso_form: new Error('x') })).port, 'V1', '4'))
        .error,
    ).toBe('A aba do Lattes não respondeu');
  });
});

describe('vigia das fontes das listas ao vivo', () => {
  const listPort = async (pages: Record<string, string | Error>) => {
    const l = await lattesPort(pages);
    return {
      code: l.code,
      menu: l.menu,
      port: {
        ...l.port,
        isFatal: (err: unknown) => err instanceof Error && err.message === 'fatal',
      },
    };
  };

  it('confere a tabela de áreas no menu e a lista de agências', async () => {
    const { code, menu, port } = await listPort({});
    const ok = await checkSources(port, code, menu);
    expect(ok.map((c) => c.status)).toEqual(['ok', 'ok']);
    const empty = await listPort({ prc_agencia: '<p></p>' });
    const gone = await checkSources(empty.port, code, '<p></p>');
    expect(gone.map((c) => c.status)).toEqual(['nao-encontrado', 'nao-encontrado']);
    expect(listText(gone[1]!)).toBe('Agências de fomento: a lista de prc_agencia sumiu');
  });

  it('falha de leitura vira erro sem o código do currículo; sessão caída para tudo', async () => {
    const first = await listPort({});
    const code = first.code;
    const err = new Error(`GET prc_agencia?f_cod=${code} falhou`);
    const failing = await listPort({ prc_agencia: err });
    const [, agencies] = await checkSources(failing.port, code, failing.menu);
    expect(agencies).toMatchObject({
      detail: 'GET prc_agencia?f_cod=[código] falhou',
      status: 'erro',
    });
    const odd = await checkSources(
      { get: () => Promise.reject('texto'), isFatal: () => false },
      code,
      first.menu,
    );
    expect(odd[1]).toMatchObject({ detail: 'Falha inesperada', status: 'erro' });
    const fatal = await listPort({ prc_agencia: new Error('fatal') });
    await expect(checkSources(fatal.port, code, fatal.menu)).rejects.toThrow('fatal');
    expect(unreadSources('sem código').map((c) => c.status)).toEqual(['erro', 'erro']);
  });
});
