import { describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { checkContract, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import {
  applyCreateAtuacao,
  CREATE_ATUACAO_SPEC,
  CREATE_ITEMS_ENABLED,
  type CreateAtuacaoOp,
  institutionResults,
  planCreateAtuacao,
} from '../src/bridge/create.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import type { FormControl } from '../src/bridge/form.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import type { Change } from '../src/model/changes.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { parseXml, type XElement } from '../src/model/xml.ts';

const atuacao = (attrs: string, vinculos: string) =>
  parseXml(`<ATUACAO-PROFISSIONAL ${attrs}>${vinculos}</ATUACAO-PROFISSIONAL>`).root;

const VINCULO =
  '<VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="OUTRO" OUTRO-VINCULO-INFORMADO="Sócio-fundador" ' +
  'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Fundador" CARGA-HORARIA-SEMANAL="40" ' +
  'FLAG-DEDICACAO-EXCLUSIVA="NAO" FLAG-VINCULO-EMPREGATICIO="SIM" MES-INICIO="1" ANO-INICIO="2026" ' +
  'MES-FIM="" ANO-FIM="" OUTRAS-INFORMACOES=""/>';

const INST = 'CODIGO-INSTITUICAO="001000000998" NOME-INSTITUICAO="Universidade de Exemplo"';

const change: Change = {
  element: 'ATUACAO-PROFISSIONAL',
  fields: [],
  form: 'Atuação profissional',
  key: 'CURRICULO-VITAE/ATUACAO-PROFISSIONAL[7]',
  kind: 'novo',
  path: ['CURRICULO-VITAE'],
};

const plan = (el: XElement) => planCreateAtuacao(change, el, 'Atuação · Exemplo');

describe('planejar a inclusão de uma atuação', () => {
  it('fica desligada por padrão até o teste no Lattes real', () => {
    expect(CREATE_ITEMS_ENABLED).toBe(false);
    expect(LATTES_CONTRACT.forms['criar-atuacao']).toBeUndefined();
    const before = parseXml(
      '<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS><ATUACOES-PROFISSIONAIS></ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>',
    ).root;
    const after = parseXml(
      `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS><ATUACOES-PROFISSIONAIS>
        <ATUACAO-PROFISSIONAL SEQUENCIA-ATIVIDADE="7" ${INST}>${VINCULO}</ATUACAO-PROFISSIONAL>
       </ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`,
    ).root;
    const entries = diffDocuments(before, after).map((c) => ({ change: c, itemTitle: '' }));
    const off = planChanges(entries, after);
    expect(off.ops).toEqual([]);
    const on = planChanges(entries, after, { createItems: true });
    expect(on.ops.map((o) => o.kind)).toContain('criar-atuacao');
  });

  it('leva os campos do vínculo para o formulário de inclusão', () => {
    const op = plan(atuacao(INST, VINCULO)) as CreateAtuacaoOp;
    expect(op).toMatchObject({
      expect: {},
      institutionCode: '001000000998',
      institutionName: 'Universidade de Exemplo',
      kind: 'criar-atuacao',
    });
    expect(op.set).toMatchObject({
      f_ano_ini: '2026',
      f_carga: '40',
      f_enqua: 'Fundador',
      f_mes_ini: '1',
      f_regime: null,
      f_stavinc: '1',
      f_status: 'S',
      f_vinc: 'Sócio-fundador',
      f_vinculo: 'Sócio-fundador',
    });
    // Na confirmação, f_vinculo não aparece (repete f_vinc).
    expect(opRows(op).map((r) => r.name)).not.toContain('f_vinculo');
    const celetista = plan(
      atuacao(
        INST,
        VINCULO.replace('OUTRO-VINCULO-INFORMADO="Sócio-fundador" ', '')
          .replace('"OUTRO"', '"CELETISTA"')
          .replace('ANO-FIM=""', 'ANO-FIM="2027"'),
      ),
    ) as CreateAtuacaoOp;
    expect(celetista.set).toMatchObject({ f_status: 'N', f_vinc: 'Celetista' });
  });

  it('recusa o que a inclusão não sabe fazer, com o motivo', () => {
    expect(plan(atuacao('NOME-INSTITUICAO="Sem código"', VINCULO))).toEqual({
      reason: expect.stringMatching(/busca de instituições/),
    });
    expect(plan(atuacao(INST, VINCULO + VINCULO))).toEqual({
      reason: expect.stringMatching(/um vínculo só/),
    });
    expect(plan(atuacao(INST, VINCULO.replace('ANO-INICIO="2026"', 'ANO-INICIO=""')))).toEqual({
      reason: expect.stringMatching(/ano de início/),
    });
    expect(
      plan(
        atuacao(
          INST,
          VINCULO.replace('OUTRO-VINCULO-INFORMADO="Sócio-fundador" ', '').replace(
            '"OUTRO"',
            '"LIVRE"',
          ),
        ),
      ),
    ).toEqual({ reason: expect.stringMatching(/não mapeado: LIVRE/) });
    expect(
      plan(
        atuacao(
          INST,
          VINCULO.replace(
            'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Fundador"',
            'ENQUADRAMENTO-FUNCIONAL="PROFESSOR_TITULAR"',
          ),
        ),
      ),
    ).toEqual({ reason: expect.stringMatching(/Enquadramento/) });
  });
});

/** Um Lattes falso com a lista de atuações, a inclusão, a busca e o vínculo. */
function fakeLattes(
  opts: {
    already?: boolean;
    created?: number;
    ctr?: string;
    logonOnPost?: boolean;
    results?: string;
    savedDifferent?: boolean;
  } = {},
) {
  const grids = [{ codinst: 'D009', seq: '6' }];
  if (opts.already) grids.push({ codinst: 'D001000000998', seq: '5' });
  let saved: Record<string, string> = {};
  const posts: string[] = [];
  const list = () =>
    `${grids
      .map(
        (g) =>
          `<a href="PKG_ATIV.cargos_vinculos?f_cod=K000000000&amp;f_codinst=${g.codinst}&amp;f_seq_ativ=${g.seq}">x</a>`,
      )
      .join('')}<a href="PKG_ATIV.inclui?f_cod=K000000000">Incluir</a>`;
  const ativ: FormControl[] = [
    ...Object.entries(CREATE_ATUACAO_SPEC.fields).map(([name, spec]) => ({
      maxLength: spec.maxLength,
      name,
      type: spec.type === 'select-one' ? 'select-one' : spec.type,
      value: name === 'f_ctr' ? (opts.ctr ?? 'I') : name === 'f_cod' ? 'K000000000' : '',
    })),
  ];
  const port = {
    async get(path: string) {
      if (path.startsWith('pkg_ativ.lista')) return list();
      if (path.startsWith('PKG_ATIV.inclui')) return 'FORM:GN_ATIV';
      if (path.startsWith('PKG_ATIV.cargos_vinculos')) {
        return `<a href="PKG_ATIV.vinculos?f_cod=K000000000&f_seq_ativ=7&f_seq_hist=1">v</a>`;
      }
      if (path.startsWith('PKG_ATIV.vinculos')) return 'FORM:GN_ATIV_VINC';
      return '';
    },
    menuHtml: () => '<a href="pkg_ativ.lista?f_cod=K000000000">Atuação</a>',
    async post(path: string, body: string) {
      posts.push(path);
      if (path === 'PRC_INST_FORM') {
        return (
          opts.results ??
          `<a href="javascript:seleciona('D001000000998','UNIVERSIDADE DE EXEMPLO')">U</a>
           <a href="javascript:seleciona('D001000000999','OUTRA')">O</a>`
        );
      }
      if (opts.logonOnPost) return '<form action="pkg_sec.logon">';
      saved = Object.fromEntries(
        body
          .split('&')
          .map((kv) =>
            kv
              .split('=')
              .map((s) =>
                s
                  .replace(/\+/g, ' ')
                  .replace(/%([0-9A-F]{2})/gi, (_, h: string) =>
                    String.fromCharCode(parseInt(h, 16)),
                  ),
              ),
          ),
      );
      for (let i = 0; i < (opts.created ?? 1); i++) {
        grids.push({ codinst: saved.f_cod_inst2 ?? saved.f_cod_inst ?? '', seq: String(7 + i) });
      }
      if (opts.savedDifferent) saved.f_ano_ini = '1999';
      return '<script>parent.modalCV2.setarUrl("pkg_ativ.lista")</script>';
    },
    readForm(html: string, form: string): FormControl[] | undefined {
      if (html === 'FORM:GN_ATIV' && form === 'GN_ATIV') return ativ;
      if (html === 'FORM:GN_ATIV_VINC' && form === 'GN_ATIV_VINC') {
        return Object.entries(saved).map(([name, value]) => ({ name, type: 'text', value }));
      }
      return undefined;
    },
  };
  return { port, posts, saved: () => saved };
}

const op = () => plan(atuacao(INST, VINCULO)) as CreateAtuacaoOp;

describe('incluir a atuação no Lattes falso', () => {
  it('busca a instituição, inclui, acha a atuação nova e confere o vínculo', async () => {
    const fake = fakeLattes();
    const result = await applyOp(op(), fake.port);
    expect(result).toMatchObject({
      assigned: { 'SEQUENCIA-ATIVIDADE': '7' },
      status: 'conferido',
    });
    expect(fake.posts).toEqual(['PRC_INST_FORM', 'PKG_ATIV.INCLUI']);
    // Código sem V: vai em f_cod_inst2, com o nome da busca.
    expect(fake.saved()).toMatchObject({
      f_cod_inst2: 'D001000000998',
      f_ctr: 'I',
      f_inst: 'UNIVERSIDADE DE EXEMPLO',
    });
  });

  it('para antes de enviar quando algo não confere', async () => {
    expect(await applyCreateAtuacao(op(), fakeLattes({ already: true }).port)).toMatchObject({
      detail: /já tem uma atuação/,
      status: 'divergente',
    });
    expect(await applyCreateAtuacao(op(), fakeLattes({ ctr: 'U' }).port)).toMatchObject({
      detail: /modo de inclusão/,
      status: 'erro',
    });
    const none = fakeLattes({ results: '<p>Nenhuma</p>' });
    expect(await applyCreateAtuacao(op(), none.port)).toMatchObject({
      detail: /0 resultados/,
      status: 'erro',
    });
    expect(none.posts).toEqual(['PRC_INST_FORM']);
    const long = { ...op(), set: { ...op().set, f_carga: '4000' } };
    expect(await applyCreateAtuacao(long, fakeLattes().port)).toMatchObject({
      detail: /f_carga passa do limite/,
    });
  });

  it('depois do envio, confere que existe uma atuação nova e que o vínculo bate', async () => {
    expect(await applyCreateAtuacao(op(), fakeLattes({ created: 0 }).port)).toMatchObject({
      detail: /0 achadas/,
      status: 'erro',
    });
    expect(await applyCreateAtuacao(op(), fakeLattes({ created: 2 }).port)).toMatchObject({
      detail: /2 achadas/,
    });
    expect(await applyCreateAtuacao(op(), fakeLattes({ savedDifferent: true }).port)).toMatchObject(
      {
        detail: /gravou diferente: f_ano_ini/,
      },
    );
    expect(await applyCreateAtuacao(op(), fakeLattes({ logonOnPost: true }).port)).toMatchObject({
      status: 'sessao',
    });
  });

  it('sem a lista ou o link de inclusão, não envia nada', async () => {
    const fake = fakeLattes();
    expect(
      await applyCreateAtuacao(op(), { ...fake.port, menuHtml: () => '<p>menu</p>' }),
    ).toMatchObject({ detail: /não encontrada no menu/, status: 'erro' });
    const noLink = { ...fake.port, get: async () => '<p>lista vazia</p>' };
    expect(await applyCreateAtuacao(op(), noLink)).toMatchObject({ detail: /Inclusão de atuação/ });
    expect(fake.posts).toEqual([]);
  });

  it('lê os resultados da busca de instituição', () => {
    expect(institutionResults("x seleciona('V123', 'Uni A') y seleciona('D9','B')")).toEqual([
      { code: 'V123', name: 'Uni A' },
      { code: 'D9', name: 'B' },
    ]);
  });
});

describe('inclusão no contrato e no registro do enviado', () => {
  it('com a inclusão ligada, o contrato confere o formulário em modo I', async () => {
    const fake = fakeLattes();
    const report = await checkContract(fake.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-atuacao': CREATE_ATUACAO_SPEC },
      menu: [],
    });
    expect(report.forms.find((f) => f.kind === 'criar-atuacao')).toMatchObject({ status: 'ok' });
    const wrongMode = fakeLattes({ ctr: 'U' });
    const changed = await checkContract(wrongMode.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-atuacao': CREATE_ATUACAO_SPEC },
      menu: [],
    });
    expect(changed.forms.find((f) => f.kind === 'criar-atuacao')?.drifts).toContainEqual(
      expect.objectContaining({ expected: 'I', kind: 'modo-mudou', observed: 'U' }),
    );
  });

  it('um item criado não se desfaz pela ponte', () => {
    expect(undoOp({ ...sentEntry(op(), '1', 1), id: 1 })).toBeUndefined();
  });
});
