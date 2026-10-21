import { afterEach, describe, expect, it } from 'vitest';

import type { LattesState } from '../scripts/lattes-simulado/estado.ts';
import { LOGON_REDIRECT } from '../scripts/lattes-simulado/html.ts';
import type { Intercept } from '../scripts/lattes-simulado/servidor.ts';
import type { LattesPort } from '../src/bridge/apply.ts';
import {
  blocksKind,
  buildContract,
  checkContract,
  compareForm,
  type Contract,
  type ContractReport,
  type Drift,
  driftText,
  type FieldSpec,
  fingerprint,
  isBreaking,
  issueUrl,
  lacksSample,
  LATTES_CONTRACT,
  reportText,
} from '../src/bridge/contract.ts';
import {
  AUTO_VERIFY_EVERY_MS,
  AUTO_VERIFY_RETRY_MS,
  retryAutoVerify,
  reusableVerification,
  shouldAutoVerify,
} from '../src/bridge/contract-schedule.ts';
import { LIVE_SOURCES, WATCHED_LISTS } from '../src/bridge/list-watch.ts';
import { childElements, element, walk, type XElement } from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  withSmallLattes,
} from './helpers/lattes-simulado.ts';

/** As listas de combo e as fontes das listas lidas ao vivo, na ordem do relatório. */
const ALL_LISTS = [...WATCHED_LISTS, ...LIVE_SOURCES];

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com o currículo
// pequeno: idiomas, resumo e uma atuação com vínculos, e as listas dos
// formulários de inclusão como o Lattes as mostrou.
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withSmallLattes>[0] = {}) {
  await open?.close();
  open = await withSmallLattes(options);
  return open;
}

/** Os caminhos lidos por GET, sem o menu. */
const gets = (lattes: LattesSimuladoNoTeste) =>
  lattes.state.log
    .filter((l) => l.method === 'GET' && !/^pkg_menu\.menu$/i.test(l.proc))
    .map((l) => l.path);

/** A porta que falha (rede caída) nas leituras que começam por prefix. */
const failingAt = (port: LattesPort, prefix: string): LattesPort => ({
  ...port,
  get: (path) =>
    path.toLowerCase().startsWith(prefix.toLowerCase())
      ? Promise.reject(new Error('rede caiu'))
      : port.get(path),
});

/** A sessão cai nas páginas dos procedimentos que casam. */
const logonAt =
  (proc: RegExp): Intercept =>
  (req, _state, next) =>
    proc.test(req.proc) ? { html: LOGON_REDIRECT } : next();

const removeAll = (state: LattesState, name: string) => {
  const parents: XElement[] = [];
  walk(state.root, (el) => {
    if (childElements(el, name).length) parents.push(el);
  });
  for (const p of parents) for (const c of childElements(p, name)) state.remove(p, c);
};

describe('fingerprint', () => {
  it('guarda nome, tipo e limite, junta os rádios e ignora botões e valores', () => {
    const fp = fingerprint([
      { maxLength: 4, name: 'f_ano', type: 'text', value: '2020' },
      { checked: false, name: 'f_status', type: 'radio', value: 'S' },
      { checked: true, name: 'f_status', type: 'radio', value: 'N' },
      { name: '', type: 'text', value: 'sem nome' },
      { name: 'salvar', type: 'submit', value: 'Salvar' },
      { name: 'x', type: 'button', value: '' },
      { name: 'y', type: 'reset', value: '' },
    ]);
    expect(fp).toEqual({ f_ano: { maxLength: 4, type: 'text' }, f_status: { type: 'radio' } });
    expect(JSON.stringify(fp)).not.toContain('2020');
  });
});

describe('compareForm', () => {
  const expected: Record<string, FieldSpec> = {
    a: { maxLength: 10, type: 'text' },
    b: { type: 'hidden' },
    c: { type: 'checkbox' },
  };

  it('não reclama de nada quando bate', () => {
    expect(compareForm('F', expected, { ...expected })).toEqual([]);
  });

  it('aponta campo sumido, tipo, limite e campo novo', () => {
    const drifts = compareForm('F', expected, {
      a: { maxLength: 12, type: 'textarea' },
      c: { type: 'checkbox' },
      d: { type: 'text' },
    });
    expect(drifts.map((d) => d.kind)).toEqual([
      'tipo-mudou',
      'limite-mudou',
      'campo-sumiu',
      'campo-novo',
    ]);
    expect(drifts[0]).toMatchObject({ expected: 'text', field: 'a', observed: 'textarea' });
    expect(drifts[1]).toMatchObject({ expected: '10', observed: '12' });
  });

  it('não compara limite quando um dos lados não declara', () => {
    expect(compareForm('F', expected, { ...expected, a: { type: 'text' } })).toEqual([]);
  });
});

/**
 * O contrato com as chaves de inclusão, dados gerais e listas forçadas a
 * desligar: o que o Lattes falso destes testes tem (só a alteração de evento).
 */
const BASE = buildContract({ biographic: false, create: false, lists: new Set() });
const checkBase = (port: LattesPort, contract: Contract = BASE) => checkContract(port, contract);

describe('checkContract', () => {
  it('as chaves ligadas na montagem põem os formulários delas no contrato', () => {
    for (const kind of ['criar-formacao', 'criar-evento', 'formacao', 'premio'] as const) {
      expect(LATTES_CONTRACT.forms[kind]).toBeDefined();
      expect(BASE.forms[kind]).toBeUndefined();
    }
    expect(LATTES_CONTRACT.menu).toEqual(expect.arrayContaining(BASE.menu));
    expect(LATTES_CONTRACT.menu.length).toBeGreaterThan(BASE.menu.length);
  });

  it('lê o menu e um exemplar de cada formulário, sem gravar', async () => {
    const lattes = await lattesFor();
    const report = await checkBase(lattes.port);
    expect(report.status).toBe('ok');
    expect(report.menu).toEqual([
      { found: true, proc: 'pkg_ativ.lista' },
      { found: true, proc: 'pkg_idioma.lista' },
      { found: true, proc: 'pkg_resume.' },
      { found: true, proc: 'pkg_evento.lista' },
    ]);
    // O currículo deste teste não tem evento: o formulário de eventos fica sem amostra.
    expect(report.forms.map((f) => [f.kind, f.status])).toEqual([
      ['evento', 'sem-amostra'],
      ['idioma', 'ok'],
      ['resumo', 'ok'],
      ['vinculo', 'ok'],
    ]);
    expect(gets(lattes).some((p) => p.startsWith('PKG_ATIV.vinculos?'))).toBe(true);
    expect(lattes.state.log.some((l) => l.method === 'POST')).toBe(false);
    expect(report.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('aponta o campo que sumiu e o que apareceu', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^pkg_idioma\.form$/i, (html) =>
        html
          .replace(/<input type="radio" name="F_COMPR"[^>]*>/g, '')
          .replace('</form>', '<input type="text" name="F_NOVO" value=""></form>'),
      ),
    });
    const report = await checkBase(lattes.port);
    expect(report.status).toBe('mudou');
    const form = report.forms.find((f) => f.kind === 'idioma')!;
    expect(form.status).toBe('mudou');
    expect(form.drifts).toEqual([
      { field: 'F_COMPR', form: 'GN_IDIOMA', kind: 'campo-sumiu' },
      { field: 'F_NOVO', form: 'GN_IDIOMA', kind: 'campo-novo' },
    ]);
    expect(blocksKind(report, 'idioma')).toHaveLength(1);
    expect(blocksKind(report, 'resumo')).toEqual([]);
  });

  it('aponta o modo do formulário fora de alteração', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^pkg_resume\./i, (html) =>
        html.replace('name="f_ctr" value="U"', 'name="f_ctr" value="I"'),
      ),
    });
    const report = await checkBase(lattes.port);
    expect(report.forms.find((f) => f.kind === 'resumo')!.drifts).toEqual([
      { expected: 'U', field: 'f_ctr', form: 'RES', kind: 'modo-mudou', observed: 'I' },
    ]);
  });

  it('aponta o formulário que não está mais na página', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^PKG_ATIV\.vinculos$/i, (html) =>
        html.replace('name="GN_ATIV_VINC"', 'name="OUTRO"'),
      ),
    });
    const report = await checkBase(lattes.port);
    const form = report.forms.find((f) => f.kind === 'vinculo')!;
    expect(form.status).toBe('mudou');
    expect(form.drifts[0]!.kind).toBe('formulario-sumiu');
  });

  it('aponta os links que sumiram do menu', async () => {
    const lattes = await lattesFor();
    const port = {
      ...lattes.port,
      menuHtml: () => `<a href="pkg_resume.prc_resume?f_cod=${lattes.state.code}">R</a>`,
    };
    const report = await checkBase(port);
    expect(report.status).toBe('mudou');
    expect(report.menu.filter((m) => !m.found).map((m) => m.proc)).toEqual([
      'pkg_ativ.lista',
      'pkg_idioma.lista',
      'pkg_evento.lista',
    ]);
    expect(report.forms.filter((f) => f.status === 'nao-encontrado').map((f) => f.kind)).toEqual([
      'evento',
      'idioma',
      'vinculo',
    ]);
    expect(blocksKind(report, 'vinculo')[0]!.kind).toBe('link-sumiu');
  });

  it('sem idioma, atuação ou vínculo no currículo, fica sem amostra', async () => {
    const lattes = await lattesFor();
    removeAll(lattes.state, 'IDIOMA');
    removeAll(lattes.state, 'VINCULOS');
    const report = await checkBase(lattes.port);
    expect(report.status).toBe('ok');
    expect(report.forms.map((f) => f.status)).toEqual([
      'sem-amostra',
      'sem-amostra',
      'ok',
      'sem-amostra',
    ]);
    const semAtuacao = await lattesFor();
    removeAll(semAtuacao.state, 'ATUACAO-PROFISSIONAL');
    const report2 = await checkBase(semAtuacao.port);
    expect(report2.forms.find((f) => f.kind === 'vinculo')!.detail).toContain('atuação');
  });

  it('procura o vínculo em todas as atuações, não só na primeira', async () => {
    const lattes = await lattesFor();
    const atuacoes = childElements(
      findIn(lattes.state.root, (el) => el.name === 'ATUACOES-PROFISSIONAIS')!,
      'ATUACAO-PROFISSIONAL',
    );
    // A primeira atuação fica sem vínculo; a segunda ganha um.
    removeAll(lattes.state, 'VINCULOS');
    const second = atuacoes[1]!;
    second.children.push(element('VINCULOS', { 'ANO-INICIO': '2020', 'SEQUENCIA-HISTORICO': '1' }));
    const report = await checkBase(lattes.port);
    expect(report.forms.find((f) => f.kind === 'vinculo')!.status).toBe('ok');
    expect(gets(lattes).filter((g) => g.startsWith('PKG_ATIV.cargos_vinculos'))).toHaveLength(2);
  });

  it('lacksSample aponta o formulário sem exemplar, e só ele', async () => {
    const lattes = await lattesFor();
    removeAll(lattes.state, 'VINCULOS');
    const report = await checkBase(lattes.port);
    expect(lacksSample(report, 'vinculo')?.form).toBe('GN_ATIV_VINC');
    expect(lacksSample(report, 'idioma')).toBeUndefined();
    expect(lacksSample(undefined, 'vinculo')).toBeUndefined();
    const erro = await checkBase(failingAt(lattes.port, 'pkg_idioma.lista'));
    expect(lacksSample(erro, 'vinculo')).toBeUndefined();
  });

  it('para quando a sessão caiu, no menu ou numa página', async () => {
    const menu = await lattesFor({ intercept: logonAt(/^pkg_menu\.menu$/i) });
    const noMenu = await checkBase(menu.port);
    expect(noMenu.status).toBe('sessao');
    expect(noMenu.forms).toEqual([]);
    const page = await lattesFor({ intercept: logonAt(/^pkg_ativ\.lista$/i) });
    const later = await checkBase(page.port);
    expect(later.status).toBe('sessao');
    expect(later.detail).toContain('sessão');
  });

  it('devolve erro quando a leitura falha', async () => {
    const lattes = await lattesFor();
    const report = await checkBase(failingAt(lattes.port, 'pkg_idioma.lista'));
    expect(report.status).toBe('erro');
    expect(report.detail).toBe('rede caiu');
    expect(blocksKind(report, 'idioma')).toEqual([]);
    expect(blocksKind(undefined, 'idioma')).toEqual([]);
  });

  it('confere as listas pelo código do currículo do menu', async () => {
    const report = await checkBase((await lattesFor()).port);
    expect(report.status).toBe('ok');
    expect(report.lists?.map((l) => l.status)).toEqual(ALL_LISTS.map(() => 'ok'));
  });

  it('menu sem o código do currículo não passa as listas sem conferir', async () => {
    const lattes = await lattesFor();
    const code = lattes.state.code;
    const port = {
      ...lattes.port,
      menuHtml: async () => (await lattes.port.menuHtml()).replaceAll(code, 'x'),
    };
    const report = await checkBase(port);
    expect(report.status).toBe('mudou');
    expect(report.lists?.map((l) => l.status)).toEqual(ALL_LISTS.map(() => 'erro'));
    expect(report.lists?.[0]?.detail).toBe('O código do currículo não está no menu');
  });

  it('falha ao ler o formulário de uma lista não derruba o relatório', async () => {
    const lattes = await lattesFor();
    const report = await checkBase(failingAt(lattes.port, 'PKG_EVENTO.form'));
    expect(report.status).toBe('mudou');
    expect(report.forms.length).toBeGreaterThan(0);
    const events = report.lists?.find((l) => l.control === 'F_COD_PROD');
    expect(events).toMatchObject({ detail: 'rede caiu', status: 'erro' });
    expect(report.lists?.filter((l) => l.status === 'ok')).toHaveLength(4);
  });

  it('confere as fontes das listas lidas ao vivo: a tabela de áreas e as agências', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^pkg_menu\.menu$/i, (html) =>
        html.replace(/<script>var areaDP[\s\S]*?<\/script>/, ''),
      ),
    });
    const report = await checkBase(failingAt(lattes.port, 'prc_agencia'));
    expect(report.status).toBe('mudou');
    const sources = report.lists?.slice(WATCHED_LISTS.length);
    expect(sources?.map((l) => [l.control, l.status])).toEqual([
      ['areaDP', 'nao-encontrado'],
      ['atribuir', 'erro'],
    ]);
    expect(reportText(report, '1.0.0')).toContain(
      'Áreas do conhecimento: a tabela areaDP do menu sumiu',
    );
    const gone = await lattesFor({ intercept: logonAt(/^prc_agencia$/i) });
    expect((await checkBase(gone.port)).status).toBe('sessao');
  });

  it('sessão caída no formulário de uma lista ainda para tudo', async () => {
    const lattes = await lattesFor({ intercept: logonAt(/^PKG_EVENTO\.form$/i) });
    const report = await checkBase(lattes.port);
    expect(report.status).toBe('sessao');
  });

  it('aceita outro contrato', async () => {
    const contract: Contract = {
      forms: {
        ...BASE.forms,
        resumo: { ...BASE.forms.resumo, fields: { F_TEXTO: { type: 'textarea' } } },
      },
      menu: ['pkg_resume.'],
    };
    const report = await checkBase((await lattesFor()).port, contract);
    expect(report.menu).toHaveLength(1);
    expect(report.forms.find((f) => f.kind === 'resumo')!.drifts.map((d) => d.kind)).toEqual(
      Array<string>(6).fill('campo-novo'),
    );
  });
});

describe('relatório', () => {
  const drifts: Drift[] = [
    { field: 'F_COMPR', form: 'GN_IDIOMA', kind: 'campo-sumiu' },
    { field: 'F_NOVO', form: 'GN_IDIOMA', kind: 'campo-novo' },
    {
      expected: 'text',
      field: 'f_vinc',
      form: 'GN_ATIV_VINC',
      kind: 'tipo-mudou',
      observed: 'hidden',
    },
    { expected: '4000', field: 'F_TEXTO', form: 'RES', kind: 'limite-mudou', observed: '2000' },
    { field: 'pkg_ativ.lista', form: 'GN_ATIV_VINC', kind: 'link-sumiu' },
    { expected: 'U', field: 'f_ctr', form: 'RES', kind: 'modo-mudou', observed: 'I' },
    { field: '', form: 'RES', kind: 'formulario-sumiu' },
  ];

  it('descreve cada tipo de mudança e sabe quais quebram o conector', () => {
    expect(drifts.map(driftText)).toEqual([
      'GN_IDIOMA: campo F_COMPR sumiu',
      'GN_IDIOMA: campo novo F_NOVO',
      'GN_ATIV_VINC: f_vinc era text, agora hidden',
      'RES: limite de F_TEXTO era 4000, agora 2000',
      'GN_ATIV_VINC: link pkg_ativ.lista sumiu',
      'RES: f_ctr era U, agora I',
      'RES: formulário não encontrado na página',
    ]);
    expect(drifts.map(isBreaking)).toEqual([true, false, true, false, true, true, true]);
  });

  it('o texto traz data, versão, menu e formulários, sem valores', () => {
    const report: ContractReport = {
      checkedAt: '2026-10-12T12:00:00.000Z',
      forms: [
        { drifts: [drifts[0]!], form: 'GN_IDIOMA', kind: 'idioma', status: 'mudou' },
        {
          detail: 'O currículo não tem atuação profissional',
          drifts: [],
          form: 'GN_ATIV_VINC',
          kind: 'vinculo',
          status: 'sem-amostra',
        },
        { drifts: [], form: 'RES', kind: 'resumo', status: 'ok' },
      ],
      menu: [
        { found: true, proc: 'pkg_resume.' },
        { found: false, proc: 'pkg_ativ.lista' },
      ],
      status: 'mudou',
    };
    const text = reportText(report, '0.7.0');
    expect(text).toContain('Verificação do Lattes em 2026-10-12T12:00:00.000Z');
    expect(text).toContain('Extensão 0.7.0');
    expect(text).toContain('- pkg_ativ.lista: sumiu');
    expect(text).toContain('GN_IDIOMA: mudou\n- GN_IDIOMA: campo F_COMPR sumiu');
    expect(text).toContain('GN_ATIV_VINC: sem amostra (O currículo não tem atuação profissional)');
    expect(text).toContain('RES: como o esperado');

    const url = new URL(issueUrl(report, '0.7.0'));
    expect(url.origin + url.pathname).toBe('https://github.com/rlueder/lattes-editor/issues/new');
    expect(url.searchParams.get('title')).toBe('O Lattes mudou: GN_IDIOMA');
    expect(url.searchParams.get('labels')).toBe('vigia-lattes');
    expect(url.searchParams.get('body')).toContain('```\nVerificação do Lattes');
  });

  it('sessão caída e erro entram no texto sem lista de formulários', () => {
    const report: ContractReport = {
      checkedAt: '2026-10-12T12:00:00.000Z',
      detail: 'A sessão do Lattes caiu; entre de novo',
      forms: [],
      menu: [],
      status: 'sessao',
    };
    expect(reportText(report, '1.0.0')).toBe(
      'Verificação do Lattes em 2026-10-12T12:00:00.000Z\nExtensão 1.0.0\nResultado: sessao (A sessão do Lattes caiu; entre de novo)',
    );
    expect(new URL(issueUrl(report, '1.0.0')).searchParams.get('title')).toBe('O Lattes mudou');
  });
});

describe('vigia: verificação automática', () => {
  const now = Date.parse('2026-10-13T15:00:00.000Z');
  const report = (status: 'erro' | 'mudou' | 'ok' | 'sessao', ago: number) => ({
    checkedAt: new Date(now - ago).toISOString(),
    forms: [],
    menu: [],
    status,
  });

  it('roda na primeira vez e quando o relatório não tem data legível', () => {
    expect(shouldAutoVerify(undefined, now)).toBe(true);
    expect(shouldAutoVerify({ ...report('ok', 0), checkedAt: 'ontem' }, now)).toBe(true);
  });

  it('com o Lattes como esperado, só depois do intervalo', () => {
    expect(shouldAutoVerify(report('ok', AUTO_VERIFY_EVERY_MS - 1), now)).toBe(false);
    expect(shouldAutoVerify(report('ok', AUTO_VERIFY_EVERY_MS), now)).toBe(true);
  });

  it('com problema, tenta de novo logo, mas não mais que uma vez por minuto', () => {
    for (const status of ['erro', 'mudou', 'sessao'] as const) {
      expect(shouldAutoVerify(report(status, AUTO_VERIFY_RETRY_MS - 1), now)).toBe(false);
      expect(shouldAutoVerify(report(status, AUTO_VERIFY_RETRY_MS), now)).toBe(true);
    }
  });

  it('tenta de novo, antes de mostrar, só falha de leitura e sessão', () => {
    expect(retryAutoVerify(report('erro', 0))).toBe(true);
    expect(retryAutoVerify(report('sessao', 0))).toBe(true);
    expect(retryAutoVerify(report('mudou', 0))).toBe(false);
    expect(retryAutoVerify(report('ok', 0))).toBe(false);
  });
});

describe('verificação econômica', () => {
  it('confere só os tipos da fila e não busca as listas do catálogo', async () => {
    const lattes = await lattesFor();
    const report = await checkContract(lattes.port, undefined, ['resumo']);
    expect(report.status).toBe('ok');
    expect(report.partial).toBe(true);
    expect(report.forms.map((f) => f.kind)).toEqual(['resumo']);
    expect(gets(lattes)).toHaveLength(1);
    expect(shouldAutoVerify(report, Date.now())).toBe(true);
    expect(reusableVerification(report, ['resumo'], Date.now())).toBe(true);
    expect(reusableVerification(report, ['idioma'], Date.now())).toBe(false);
    expect(reusableVerification(report, ['resumo'], Date.now() + AUTO_VERIFY_EVERY_MS)).toBe(false);
  });

  it('cada caminho é lido só uma vez na verificação completa', async () => {
    const lattes = await lattesFor();
    await checkContract(lattes.port);
    const paths = gets(lattes);
    expect(paths.length).toBe(new Set(paths).size);
  });
});
