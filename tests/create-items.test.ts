import { afterEach, describe, expect, it } from 'vitest';

import type { Institution } from '../scripts/lattes-simulado/estado.ts';
import type { SimRequest } from '../scripts/lattes-simulado/pedido.ts';
import type { Intercept } from '../scripts/lattes-simulado/servidor.ts';
import type { SimResponse } from '../scripts/lattes-simulado/tipos.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { blocksKind, checkContract, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import {
  applyCreateAtuacao,
  CREATE_ATUACAO_SPEC,
  CREATE_ITEMS_ENABLED,
  type CreateAtuacaoOp,
  institutionResults,
  planCreateAtuacao,
} from '../src/bridge/create.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import type { Change } from '../src/model/changes.ts';
import { diffDocuments } from '../src/model/changes.ts';
import {
  childElements,
  element,
  getAttr,
  parseXml,
  setAttr,
  type XElement,
} from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withSmallLattes,
} from './helpers/lattes-simulado.ts';

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
      // SIM no XML é Não (0) no formulário: invertido, observado em 15/10/2026.
      f_stavinc: '0',
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

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com o currículo
// pequeno (atuações 5 e 6) e duas instituições a mais na busca: a do XML e
// outra de nome parecido.
const INSTITUTIONS: Institution[] = [
  { code: 'D001000000998', name: 'UNIVERSIDADE DE EXEMPLO', uf: 'RS' },
  { code: 'D001000000999', name: 'UNIVERSIDADE DE EXEMPLO DO NORTE', uf: 'PA' },
];

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withSmallLattes>[0] = {}) {
  await open?.close();
  open = await withSmallLattes({ institutions: INSTITUTIONS, ...options });
  return open;
}

const isProc = (req: SimRequest, proc: string) => req.proc.toLowerCase() === proc.toLowerCase();

/** O POST de inclusão da atuação trocado: chama next() n vezes, ou responde outra coisa. */
const onInclude =
  (fn: (next: () => Promise<SimResponse>) => Promise<SimResponse>): Intercept =>
  (req, _state, next) =>
    req.method === 'POST' && isProc(req, 'PKG_ATIV.INCLUI') ? fn(next) : next();

/** O formulário de inclusão em outro modo. */
const includeMode = (ctr: string) =>
  faults.rewritePages(/^PKG_ATIV\.inclui$/i, (html) =>
    html.replace('name="f_ctr" value="I"', `name="f_ctr" value="${ctr}"`),
  );

const procs = (lattes: LattesSimuladoNoTeste) => postsOf(lattes).map((p) => p.proc);

const op = () => plan(atuacao(INST, VINCULO)) as CreateAtuacaoOp;

describe('incluir a atuação no Lattes simulado', () => {
  it('busca a instituição, inclui, acha a atuação nova e confere o vínculo', async () => {
    const lattes = await lattesFor();
    const result = await applyOp(op(), lattes.port);
    expect(result).toMatchObject({
      assigned: { 'SEQUENCIA-ATIVIDADE': '7' },
      status: 'conferido',
    });
    expect(procs(lattes)).toEqual(['PRC_INST_FORM', 'PKG_ATIV.INCLUI']);
    // Código sem V: vai em f_cod_inst2, com o nome da busca.
    expect(postsOf(lattes)[1]!.fields).toMatchObject({
      f_cod_inst2: 'D001000000998',
      f_ctr: 'I',
      f_inst: 'UNIVERSIDADE DE EXEMPLO',
    });
    const created = findIn(
      lattes.state.root,
      (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '7',
    )!;
    expect(getAttr(created, 'CODIGO-INSTITUICAO')).toBe('001000000998');
  });

  it('para antes de enviar quando algo não confere', async () => {
    const already = await lattesFor();
    const atuacoes = findIn(already.state.root, (el) => el.name === 'ATUACOES-PROFISSIONAIS')!;
    atuacoes.children.push(
      element('ATUACAO-PROFISSIONAL', {
        'CODIGO-INSTITUICAO': '001000000998',
        'NOME-INSTITUICAO': 'Universidade de Exemplo',
        'SEQUENCIA-ATIVIDADE': '8',
      }),
    );
    expect(await applyCreateAtuacao(op(), already.port)).toMatchObject({
      detail: expect.stringMatching(/já tem uma atuação/),
      status: 'divergente',
    });
    expect(
      await applyCreateAtuacao(op(), (await lattesFor({ intercept: includeMode('U') })).port),
    ).toMatchObject({
      detail: expect.stringMatching(/modo de inclusão/),
      status: 'erro',
    });
    const none = await lattesFor({
      intercept: (req, _state, next) =>
        isProc(req, 'PRC_INST_FORM') ? { html: '<p>Nenhuma</p>' } : next(),
    });
    expect(await applyCreateAtuacao(op(), none.port)).toMatchObject({
      detail: expect.stringMatching(/0 resultados/),
      status: 'erro',
    });
    expect(procs(none)).toEqual(['PRC_INST_FORM']);
    const long = { ...op(), set: { ...op().set, f_carga: '4000' } };
    expect(await applyCreateAtuacao(long, (await lattesFor()).port)).toMatchObject({
      detail: expect.stringMatching(/f_carga passa do limite/),
    });
  });

  it('depois do envio, confere que existe uma atuação nova e que o vínculo bate', async () => {
    // Depois do POST aceito, o que não confere avisa que a atuação pode existir.
    const zero = await lattesFor({
      intercept: onInclude(async () => ({ html: '<script>/* nada gravado */</script>' })),
    });
    expect(await applyCreateAtuacao(op(), zero.port)).toMatchObject({
      detail: expect.stringMatching(/0 atuações novas.*pode ter sido criada/),
      status: 'divergente',
    });
    const two = await lattesFor({
      intercept: onInclude(async (next) => {
        await next();
        return next();
      }),
    });
    expect(await applyCreateAtuacao(op(), two.port)).toMatchObject({
      detail: expect.stringMatching(/2 atuações novas.*pode ter sido criada/),
      status: 'divergente',
    });
    const different = await lattesFor({
      intercept: onInclude(async (next) => {
        const out = await next();
        const v = findIn(
          open!.state.root,
          (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '7',
        )!;
        setAttr(childElements(v, 'VINCULOS')[0]!, 'ANO-INICIO', '1999');
        return out;
      }),
    });
    expect(await applyCreateAtuacao(op(), different.port)).toMatchObject({
      assigned: { 'SEQUENCIA-ATIVIDADE': '7' },
      detail: expect.stringMatching(/gravada diferente: f_ano_ini/),
      status: 'divergente',
    });
    const logon = await lattesFor({
      intercept: onInclude(async () => ({ html: '<form action="pkg_sec.logon">' })),
    });
    expect(await applyCreateAtuacao(op(), logon.port)).toMatchObject({
      status: 'sessao',
    });
  });

  it('sem a lista ou o link de inclusão, não envia nada', async () => {
    const lattes = await lattesFor();
    expect(
      await applyCreateAtuacao(op(), { ...lattes.port, menuHtml: () => '<p>menu</p>' }),
    ).toMatchObject({ detail: expect.stringMatching(/não encontrada no menu/), status: 'erro' });
    const noLink = { ...lattes.port, get: async () => '<p>lista vazia</p>' };
    expect(await applyCreateAtuacao(op(), noLink)).toMatchObject({
      detail: expect.stringMatching(/Inclusão de atuação/),
    });
    expect(procs(lattes)).toEqual([]);
  });

  it('lê os resultados da busca de instituição', () => {
    expect(institutionResults("x seleciona('V123', 'Uni A') y seleciona('D9','B')")).toEqual([
      { code: 'V123', name: 'Uni A' },
      { code: 'D9', name: 'B' },
    ]);
    // Entidades e apóstrofo escapado; nome que continua com entidade fica de fora.
    expect(
      institutionResults(
        "seleciona('D1','UNIVERSIDADE D\\'AVILA &amp; FILHOS') seleciona('D2','S&atilde;o Paulo') seleciona('D3','Nome &estranho;')",
      ),
    ).toEqual([
      { code: 'D1', name: "UNIVERSIDADE D'AVILA & FILHOS" },
      { code: 'D2', name: 'São Paulo' },
    ]);
  });
});

describe('inclusão no contrato e no registro do enviado', () => {
  it('com a inclusão ligada, o contrato confere o formulário em modo I', async () => {
    const lattes = await lattesFor();
    const report = await checkContract(lattes.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-atuacao': CREATE_ATUACAO_SPEC },
      menu: [],
    });
    // O tipo de f_tipo_privacidade fica fora do contrato da inclusão: o
    // formulário o traz, e ele aparece como campo novo, que não trava.
    expect(report.forms.find((f) => f.kind === 'criar-atuacao')!.drifts).toEqual([
      { field: 'f_tipo_privacidade', form: 'GN_ATIV', kind: 'campo-novo' },
    ]);
    expect(blocksKind(report, 'criar-atuacao')).toEqual([]);
    const wrongMode = await lattesFor({ intercept: includeMode('U') });
    const changed = await checkContract(wrongMode.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-atuacao': CREATE_ATUACAO_SPEC },
      menu: [],
    });
    expect(changed.forms.find((f) => f.kind === 'criar-atuacao')?.drifts).toContainEqual(
      expect.objectContaining({ expected: 'I', kind: 'modo-mudou', observed: 'U' }),
    );
  });

  it('um item criado não se desfaz pelo conector', () => {
    expect(undoOp({ ...sentEntry(op(), '1', 1), id: 1 })).toBeUndefined();
  });
});
