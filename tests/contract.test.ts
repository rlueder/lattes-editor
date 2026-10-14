import { describe, expect, it } from 'vitest';

import type { LattesPort } from '../src/bridge/apply.ts';
import {
  AUTO_VERIFY_EVERY_MS,
  AUTO_VERIFY_RETRY_MS,
  blocksKind,
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
  retryAutoVerify,
  shouldAutoVerify,
} from '../src/bridge/contract.ts';
import type { FormControl } from '../src/bridge/form.ts';
import { WATCHED_LISTS } from '../src/bridge/list-watch.ts';

/** Controles de um formulário a partir da especificação: o Lattes "como o esperado". */
function controlsFrom(fields: Record<string, FieldSpec>, ctr = 'U'): FormControl[] {
  const list: FormControl[] = [];
  for (const [name, spec] of Object.entries(fields)) {
    const value = name === 'f_ctr' ? ctr : '';
    if (spec.type === 'radio') {
      list.push({ checked: false, name, type: 'radio', value: 'S' });
      list.push({ checked: true, name, type: 'radio', value: 'N' });
      continue;
    }
    list.push(
      spec.maxLength
        ? { maxLength: spec.maxLength, name, type: spec.type, value }
        : { name, type: spec.type, value },
    );
  }
  list.push({ name: 'salvar', type: 'button', value: 'Salvar' });
  return list;
}

interface FakeOptions {
  forms?: Partial<Record<'GN_ATIV_VINC' | 'GN_IDIOMA' | 'RES', FormControl[] | undefined>>;
  logonAt?: string;
  menu?: string;
  noAtuacao?: boolean;
  noIdioma?: boolean;
  noVinculo?: boolean;
  throwAt?: string;
  /** A primeira atuação não tem vínculo; a segunda tem. */
  vinculoNaSegunda?: boolean;
}

const MENU = `<a onclick="modalCV1.setarUrl(&quot;pkg_ativ.lista?f_cod=K000000000&quot;, true)">Atuação</a>
  <a onclick="modalCV1.setarUrl(&quot;pkg_resume.prc_resume?f_cod=K000000000&quot;, true)">Resumo</a>
  <a onclick="modalCV1.setarUrl(&quot;pkg_idioma.lista?f_cod=K000000000&quot;, true)">Idiomas</a>`;

/** Um combo como o Lattes o desenha: a opção vazia primeiro. */
const selectHtml = (name: string, options: readonly string[]) =>
  `<select name="${name}"><option value="">Selecione</option>${options
    .map((o, i) => `<option value="C${i}">${o}</option>`)
    .join('')}</select>`;

function fakeLattes(opts: FakeOptions = {}): { gets: string[]; port: LattesPort } {
  const gets: string[] = [];
  const forms = {
    GN_ATIV_VINC: controlsFrom(LATTES_CONTRACT.forms.vinculo.fields),
    GN_IDIOMA: controlsFrom(LATTES_CONTRACT.forms.idioma.fields),
    RES: controlsFrom(LATTES_CONTRACT.forms.resumo.fields),
    ...opts.forms,
  };
  const port: LattesPort = {
    async get(path) {
      gets.push(path);
      if (opts.throwAt && path.startsWith(opts.throwAt)) throw new Error('rede caiu');
      if (opts.logonAt && path.startsWith(opts.logonAt)) return '<form action="pkg_sec.logon">';
      if (path.startsWith('pkg_ativ.lista')) {
        if (opts.noAtuacao) return '<p>Nenhuma</p>';
        const grid = (seq: number) =>
          `<a href="PKG_ATIV.cargos_vinculos?f_cod=K000000000&amp;f_codinst=D001&amp;f_seq_ativ=${seq}">x</a>`;
        return opts.vinculoNaSegunda ? grid(5) + grid(6) : grid(5);
      }
      if (path.startsWith('PKG_ATIV.cargos_vinculos')) {
        const empty = opts.noVinculo || (opts.vinculoNaSegunda && !path.includes('f_seq_ativ=6'));
        return empty
          ? `<a href='PKG_ATIV.vinculos?f_cod=K000000000&f_codinst=D001&f_seq_ativ=5'>novo</a>`
          : `<a href='PKG_ATIV.vinculos?f_cod=K000000000&f_codinst=D001&f_seq_ativ=6&f_seq_hist=1'>v</a>`;
      }
      if (path.startsWith('PKG_ATIV.vinculos')) return 'FORM:GN_ATIV_VINC';
      if (path.startsWith('pkg_resume.')) return 'FORM:RES';
      if (path.startsWith('pkg_idioma.lista')) {
        return opts.noIdioma
          ? `<a href="pkg_idioma.form?f_cod=K000000000">Novo</a>`
          : `<a href="pkg_idioma.form?f_cod=K000000000&amp;f_seq=1">Inglês</a>
             <a href="pkg_idioma.form?f_cod=K000000000">Novo</a>`;
      }
      if (path.startsWith('pkg_idioma.form')) return 'FORM:GN_IDIOMA';
      // Os formulários de inclusão com os combos das listas, como o editor os conhece.
      const lists = WATCHED_LISTS.filter((l) => path === l.path('K000000000'));
      if (lists.length) return lists.map((l) => selectHtml(l.control, l.expected)).join('');
      return '';
    },
    menuHtml: () => opts.menu ?? MENU,
    async post() {
      throw new Error('a verificação não grava');
    },
    readForm(html, form) {
      return html === `FORM:${form}` ? forms[form as keyof typeof forms] : undefined;
    },
  };
  return { gets, port };
}

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

describe('checkContract', () => {
  it('lê o menu e um exemplar de cada formulário, sem gravar', async () => {
    const { gets, port } = fakeLattes();
    const report = await checkContract(port);
    expect(report.status).toBe('ok');
    expect(report.menu).toEqual([
      { found: true, proc: 'pkg_ativ.lista' },
      { found: true, proc: 'pkg_idioma.lista' },
      { found: true, proc: 'pkg_resume.' },
    ]);
    expect(report.forms.map((f) => [f.kind, f.status])).toEqual([
      ['idioma', 'ok'],
      ['resumo', 'ok'],
      ['vinculo', 'ok'],
    ]);
    expect(gets.some((p) => p.startsWith('PKG_ATIV.vinculos?'))).toBe(true);
    expect(report.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('aponta o campo que sumiu e o que apareceu', async () => {
    const idioma = controlsFrom(LATTES_CONTRACT.forms.idioma.fields).filter(
      (c) => c.name !== 'F_COMPR',
    );
    idioma.push({ name: 'F_NOVO', type: 'text', value: '' });
    const { port } = fakeLattes({ forms: { GN_IDIOMA: idioma } });
    const report = await checkContract(port);
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
    const { port } = fakeLattes({
      forms: { RES: controlsFrom(LATTES_CONTRACT.forms.resumo.fields, 'I') },
    });
    const report = await checkContract(port);
    expect(report.forms.find((f) => f.kind === 'resumo')!.drifts).toEqual([
      { expected: 'U', field: 'f_ctr', form: 'RES', kind: 'modo-mudou', observed: 'I' },
    ]);
  });

  it('aponta o formulário que não está mais na página', async () => {
    const { port } = fakeLattes({ forms: { GN_ATIV_VINC: undefined } });
    const report = await checkContract(port);
    const form = report.forms.find((f) => f.kind === 'vinculo')!;
    expect(form.status).toBe('mudou');
    expect(form.drifts[0]!.kind).toBe('formulario-sumiu');
  });

  it('aponta os links que sumiram do menu', async () => {
    const { port } = fakeLattes({ menu: '<a href="pkg_resume.prc_resume?f_cod=K000000000">R</a>' });
    const report = await checkContract(port);
    expect(report.status).toBe('mudou');
    expect(report.menu.filter((m) => !m.found).map((m) => m.proc)).toEqual([
      'pkg_ativ.lista',
      'pkg_idioma.lista',
    ]);
    expect(report.forms.filter((f) => f.status === 'nao-encontrado').map((f) => f.kind)).toEqual([
      'idioma',
      'vinculo',
    ]);
    expect(blocksKind(report, 'vinculo')[0]!.kind).toBe('link-sumiu');
  });

  it('sem idioma, atuação ou vínculo no currículo, fica sem amostra', async () => {
    const { port } = fakeLattes({ noIdioma: true, noVinculo: true });
    const report = await checkContract(port);
    expect(report.status).toBe('ok');
    expect(report.forms.map((f) => f.status)).toEqual(['sem-amostra', 'ok', 'sem-amostra']);
    const semAtuacao = await checkContract(fakeLattes({ noAtuacao: true }).port);
    expect(semAtuacao.forms.find((f) => f.kind === 'vinculo')!.detail).toContain('atuação');
  });

  it('procura o vínculo em todas as atuações, não só na primeira', async () => {
    const { gets, port } = fakeLattes({ vinculoNaSegunda: true });
    const report = await checkContract(port);
    expect(report.forms.find((f) => f.kind === 'vinculo')!.status).toBe('ok');
    expect(gets.filter((g) => g.startsWith('PKG_ATIV.cargos_vinculos'))).toHaveLength(2);
  });

  it('lacksSample aponta o formulário sem exemplar, e só ele', async () => {
    const report = await checkContract(fakeLattes({ noVinculo: true }).port);
    expect(lacksSample(report, 'vinculo')?.form).toBe('GN_ATIV_VINC');
    expect(lacksSample(report, 'idioma')).toBeUndefined();
    expect(lacksSample(undefined, 'vinculo')).toBeUndefined();
    const erro = await checkContract(fakeLattes({ throwAt: 'pkg_idioma.lista' }).port);
    expect(lacksSample(erro, 'vinculo')).toBeUndefined();
  });

  it('para quando a sessão caiu, no menu ou numa página', async () => {
    const noMenu = await checkContract(fakeLattes({ menu: '<form action="pkg_sec.logon">' }).port);
    expect(noMenu.status).toBe('sessao');
    expect(noMenu.forms).toEqual([]);
    const later = await checkContract(fakeLattes({ logonAt: 'pkg_ativ.lista' }).port);
    expect(later.status).toBe('sessao');
    expect(later.detail).toContain('sessão');
  });

  it('devolve erro quando a leitura falha', async () => {
    const report = await checkContract(fakeLattes({ throwAt: 'pkg_idioma.lista' }).port);
    expect(report.status).toBe('erro');
    expect(report.detail).toBe('rede caiu');
    expect(blocksKind(report, 'idioma')).toEqual([]);
    expect(blocksKind(undefined, 'idioma')).toEqual([]);
  });

  it('confere as listas pelo código do currículo do menu', async () => {
    const report = await checkContract(fakeLattes().port);
    expect(report.status).toBe('ok');
    expect(report.lists?.map((l) => l.status)).toEqual(WATCHED_LISTS.map(() => 'ok'));
  });

  it('menu sem o código do currículo não passa as listas sem conferir', async () => {
    const menu = MENU.replaceAll('K000000000', 'x');
    const report = await checkContract(fakeLattes({ menu }).port);
    expect(report.status).toBe('mudou');
    expect(report.lists?.map((l) => l.status)).toEqual(WATCHED_LISTS.map(() => 'erro'));
    expect(report.lists?.[0]?.detail).toBe('O código do currículo não está no menu');
  });

  it('falha ao ler o formulário de uma lista não derruba o relatório', async () => {
    const report = await checkContract(fakeLattes({ throwAt: 'PKG_EVENTO.form' }).port);
    expect(report.status).toBe('mudou');
    expect(report.forms.length).toBeGreaterThan(0);
    const events = report.lists?.find((l) => l.control === 'F_COD_PROD');
    expect(events).toMatchObject({ detail: 'rede caiu', status: 'erro' });
    expect(report.lists?.filter((l) => l.status === 'ok')).toHaveLength(2);
  });

  it('sessão caída no formulário de uma lista ainda para tudo', async () => {
    const report = await checkContract(fakeLattes({ logonAt: 'PKG_EVENTO.form' }).port);
    expect(report.status).toBe('sessao');
  });

  it('aceita outro contrato', async () => {
    const contract: Contract = {
      forms: {
        ...LATTES_CONTRACT.forms,
        resumo: { ...LATTES_CONTRACT.forms.resumo, fields: { F_TEXTO: { type: 'textarea' } } },
      },
      menu: ['pkg_resume.'],
    };
    const report = await checkContract(fakeLattes().port, contract);
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
