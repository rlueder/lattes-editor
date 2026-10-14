import { describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { checkContract, compareForm, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { CREATE_ITEMS_ENABLED } from '../src/bridge/create.ts';
import {
  applyCreateFormacao,
  CREATE_FORMACAO_SPEC,
  type CreateFormacaoOp,
  planCreateFormacao,
} from '../src/bridge/create-formacao.ts';
import { CREATE_SPECS, planCreateItem } from '../src/bridge/create-items.ts';
import { jsCalls, selectEntries } from '../src/bridge/create-shared.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { type Change, diffDocuments } from '../src/model/changes.ts';
import { parseXml, type XElement } from '../src/model/xml.ts';
import { CV, fakeFormacao } from './helpers/fake-lattes-create.ts';

const DOUTORADO =
  'SEQUENCIA-FORMACAO="9" NIVEL="" CODIGO-INSTITUICAO="001000000998" NOME-INSTITUICAO="Universidade de Exemplo" ' +
  'CODIGO-CURSO="12345678" NOME-CURSO="Genética e Biologia Molecular" STATUS-DO-CURSO="CONCLUIDO" ' +
  'ANO-DE-INICIO="2011" ANO-DE-CONCLUSAO="2015" FLAG-BOLSA="SIM" CODIGO-AGENCIA-FINANCIADORA="045000000000" ' +
  'NOME-AGENCIA="Conselho Nacional de Desenvolvimento Científico e Tecnológico" ANO-DE-OBTENCAO-DO-TITULO="2015" ' +
  'TITULO-DA-DISSERTACAO-TESE="Genômica de palmeiras" NOME-COMPLETO-DO-ORIENTADOR="Helena Vieira" ' +
  'NOME-DO-CO-ORIENTADOR="" CODIGO-CURSO-CAPES="42001013004P0"';

const cv = (formacao: string) =>
  parseXml(
    `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Ana"><FORMACAO-ACADEMICA-TITULACAO>${formacao}</FORMACAO-ACADEMICA-TITULACAO></DADOS-GERAIS></CURRICULO-VITAE>`,
  ).root;

const change = (fields: string[] = []): Change => ({
  element: 'DOUTORADO',
  fields: fields.map((attr) => ({ after: 'x', attr, before: '', label: `rótulo de ${attr}` })),
  form: 'Doutorado',
  key: 'CURRICULO-VITAE/DADOS-GERAIS[#0]/FORMACAO-ACADEMICA-TITULACAO[#0]/DOUTORADO[SEQUENCIA-FORMACAO=9]',
  kind: 'novo',
  path: [],
});

const el = (attrs: string, name = 'DOUTORADO', children = ''): XElement =>
  parseXml(`<${name} ${attrs}>${children}</${name}>`).root;

const plan = (attrs = DOUTORADO, name = 'DOUTORADO', children = '') =>
  planCreateFormacao(change(['NOME-ORGAO']), el(attrs, name, children), 'Formação · Doutorado');

const op = () => plan() as CreateFormacaoOp;

describe('planejar a inclusão de uma formação', () => {
  it('fica desligada por padrão; ligada, a formação nova vira inclusão', () => {
    expect(CREATE_ITEMS_ENABLED).toBe(false);
    expect(LATTES_CONTRACT.forms['criar-formacao']).toBeUndefined();
    const before = cv('<GRADUACAO SEQUENCIA-FORMACAO="1" NOME-INSTITUICAO="UFPel"/>');
    const after = cv(
      `<GRADUACAO SEQUENCIA-FORMACAO="1" NOME-INSTITUICAO="UFPel"/><DOUTORADO ${DOUTORADO}/>`,
    );
    const entries = diffDocuments(before, after).map((c) => ({ change: c, itemTitle: '' }));
    expect(planChanges(entries, after).ops).toEqual([]);
    expect(planChanges(entries, after, { createItems: true }).ops.map((o) => o.kind)).toEqual([
      'criar-formacao',
    ]);
  });

  it('a primeira formação do currículo (contêiner novo) também vai', () => {
    const before = parseXml(
      '<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Ana"/></CURRICULO-VITAE>',
    ).root;
    const after = cv(`<DOUTORADO ${DOUTORADO}/>`);
    const entries = diffDocuments(before, after).map((c) => ({ change: c, itemTitle: '' }));
    const planned = planChanges(entries, after, { createItems: true });
    expect(planned.ops.map((o) => o.kind)).toEqual(['criar-formacao']);
    const two = cv(`<GRADUACAO ${DOUTORADO}/><DOUTORADO ${DOUTORADO}/>`);
    const both = diffDocuments(before, two).map((c) => ({ change: c, itemTitle: '' }));
    expect(planChanges(both, two, { createItems: true }).unsupported[0]?.reason).toMatch(
      /uma formação por vez/,
    );
  });

  it('leva os campos do XML para os do formulário do nível', () => {
    expect(op()).toMatchObject({
      agencyCode: '045000000000',
      courseCode: '12345678',
      expect: {},
      institutionCode: '001000000998',
      kind: 'criar-formacao',
      level: '4',
    });
    expect(op().set).toEqual({
      F_BOLSA: 'S',
      F_STATUS: 'S',
      f_ano_fim: '2015',
      f_ano_ini: '2011',
      f_ano_obten: '2015',
      f_orient: 'Helena Vieira',
      f_titulo: 'Genômica de palmeiras',
    });
    const mestrado = plan(
      'CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="U" ANO-DE-INICIO="2009" TIPO-MESTRADO="S" FLAG-BOLSA="NAO" STATUS-DO-CURSO="EM_ANDAMENTO"',
      'MESTRADO',
    ) as CreateFormacaoOp;
    expect(mestrado).toMatchObject({ level: '3' });
    expect(mestrado.set).toEqual({
      F_BOLSA: 'N',
      F_STATUS: 'N',
      f_ano_ini: '2009',
      f_tpo_doutorado: 'S',
    });
    // Na confirmação, cada campo com o nome e o valor do formulário.
    const rows = opRows(op());
    expect(rows.find((r) => r.name === 'F_STATUS')).toMatchObject({
      after: 'Concluído',
      label: 'Situação do curso',
    });
  });

  it('recusa o que a inclusão não sabe fazer, com o motivo', () => {
    const base = 'CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="U" ANO-DE-INICIO="2009"';
    const reason = (attrs: string, name = 'MESTRADO', children = '') =>
      (plan(attrs, name, children) as { reason: string }).reason;
    expect(reason(base, 'POS-DOUTORADO')).toMatch(/combo|Incluir novo item/);
    expect(reason('NOME-INSTITUICAO="U" ANO-DE-INICIO="2009"')).toMatch(/busca de instituições/);
    expect(reason(`${base} NOME-CURSO="Biologia"`)).toMatch(/lista de cursos/);
    expect(reason(`${base} FLAG-BOLSA="SIM" NOME-AGENCIA="CNPq"`)).toMatch(/lista de agências/);
    expect(reason(`${base} CODIGO-AGENCIA-FINANCIADORA="1"`)).toMatch(/sem bolsa/);
    expect(reason(`${base} FLAG-BOLSA="SIM"`)).toMatch(/Bolsa sem a agência/);
    expect(reason(base, 'MESTRADO', '<PALAVRAS-CHAVE PALAVRA-CHAVE-1="genética"/>')).toMatch(
      /Palavras-chave/,
    );
    expect(reason(`${base} NOME-ORGAO="Instituto de Biociências"`)).toMatch(
      /não tem: rótulo de NOME-ORGAO/,
    );
    expect(reason(`${base} TIPO-MESTRADO="X"`)).toMatch(/sem correspondência.*\(X\)/);
    expect(reason(`${base} STATUS-DO-CURSO="TRANCADO"`)).toMatch(/sem correspondência/);
    expect(reason('CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="U"')).toMatch(/ano de início/);
    // Dois atributos do orientador com nomes diferentes: um se perderia.
    expect(
      reason(`${base} NOME-COMPLETO-DO-ORIENTADOR="Helena" NOME-DO-ORIENTADOR="Paulo"`),
    ).toMatch(/outro valor para o mesmo campo/);
    expect(
      plan(`${base} NOME-COMPLETO-DO-ORIENTADOR="Helena" NOME-DO-ORIENTADOR="Helena"`, 'MESTRADO'),
    ).toHaveProperty('kind', 'criar-formacao');
  });

  it('patente e itens que não são formação nem projeto ficam de fora', () => {
    const patente = parseXml('<PATENTE SEQUENCIA-PRODUCAO="40"/>').root;
    expect(planCreateItem(change(), [patente], 'Patente')).toEqual({
      reason: expect.stringMatching(/Patente vai à mão/),
    });
    const idioma = parseXml('<IDIOMA IDIOMA="EN"/>').root;
    expect(planCreateItem(change(), [idioma], 'Idioma')).toBeUndefined();
    expect(planCreateItem(change(), [], 'Nada')).toBeUndefined();
  });
});

describe('incluir a formação no Lattes falso', () => {
  it('busca instituição, curso e agência, inclui, acha a formação nova e confere', async () => {
    const fake = fakeFormacao();
    const result = await applyOp(op(), fake.port);
    expect(result).toMatchObject({
      assigned: { 'SEQUENCIA-FORMACAO': '1' },
      status: 'conferido',
    });
    expect(fake.posts.map((p) => p.path)).toEqual(['pkg_formacao.FORM']);
    // Tudo o mais foi GET: a busca de instituição pela URL com o nome em Latin-1.
    expect(fake.gets).toContain(`pkg_formacao.form?f_cod=${CV}&f_tipo=FA&f_nivel=4`);
    expect(fake.gets.find((g) => g.startsWith('PRC_INST_FORM'))).toBe(
      `PRC_INST_FORM?F_CTR=C&F_COD=${CV}&F_NIVEL=4&F_STA_OUTRA=N&f_nome=Universidade+de+Exemplo`,
    );
    expect(fake.gets).toContain(
      `prc_curso_form?f_cod=${CV}&f_pgm=FORM&f_nivel=4&f_inst=D001000000998`,
    );
    expect(fake.posts[0]!.body).toMatchObject({
      F_BOLSA: 'S',
      F_STATUS: 'S',
      f_agencia: '045000000000',
      // Formação guarda o código da instituição com a letra; o curso, sem.
      f_cod_curso2: '12345678',
      f_cod_inst2: 'D001000000998',
      f_ctr: 'I',
      f_curso: 'Genética e Biologia Molecular(42001013004P0)',
      f_curso_old: 'Genética e Biologia Molecular(42001013004P0)',
      f_inst: 'UNIVERSIDADE DE EXEMPLO',
      f_inst_old: 'UNIVERSIDADE DE EXEMPLO',
      f_nivel: '4',
      f_nme_agencia: 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
      f_tipo: 'FA',
      f_titulo: 'Genômica de palmeiras',
    });
  });

  it('código com V vai nos campos sem o 2', async () => {
    const vOp = {
      ...op(),
      courseCode: '87654321',
      institutionCode: '007900000004',
      institutionName: 'Universidade Estadual de Campinas',
    };
    const fake = fakeFormacao();
    expect(await applyCreateFormacao(vOp, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.posts[0]!.body).toMatchObject({
      f_cod_curso: '87654321',
      f_cod_inst: 'V007900000004',
      f_curso: 'Administração(33003025005P3)',
    });
    expect(fake.posts[0]!.body.f_cod_inst2).toBe('');
  });

  it('"sem bolsa" num nível sem o campo sai do envio', async () => {
    const semBolsa = {
      ...op(),
      agencyCode: undefined,
      courseCode: undefined,
      set: { ...op().set, F_BOLSA: 'N' },
    };
    const fake = fakeFormacao({ hide: ['F_BOLSA'] });
    expect(await applyCreateFormacao(semBolsa, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.posts[0]!.body.F_BOLSA).toBe('');
    // "Com bolsa" num nível sem o campo para antes de enviar.
    const comBolsa = { ...semBolsa, set: { ...semBolsa.set, F_BOLSA: 'S' } };
    expect(
      await applyCreateFormacao(comBolsa, fakeFormacao({ hide: ['F_BOLSA'] }).port),
    ).toMatchObject({ detail: expect.stringMatching(/não tem: Bolsa/), status: 'erro' });
  });

  it('sem curso nem bolsa, não abre as listas', async () => {
    const plain = { ...op(), agencyCode: undefined, courseCode: undefined };
    const fake = fakeFormacao();
    expect(await applyCreateFormacao(plain, fake.port)).toMatchObject({ status: 'conferido' });
    expect(
      fake.gets.some((g) => g.startsWith('prc_curso_form') || g.startsWith('prc_agencia')),
    ).toBe(false);
  });

  it('para antes de enviar quando algo não confere', async () => {
    const duplicate = fakeFormacao({
      rows: [{ f_ano_ini: '2011', f_cod_inst2: 'D001000000998', f_nivel: '4' }],
    });
    expect(await applyCreateFormacao(op(), duplicate.port)).toMatchObject({
      detail: expect.stringMatching(/já tem essa formação/),
      status: 'divergente',
    });
    expect(duplicate.posts).toEqual([]);
    // Outra formação na mesma instituição, noutro nível, não é duplicata.
    const other = fakeFormacao({
      rows: [{ f_ano_ini: '2011', f_cod_inst2: 'D001000000998', f_nivel: '3' }],
    });
    expect(await applyCreateFormacao(op(), other.port)).toMatchObject({
      assigned: { 'SEQUENCIA-FORMACAO': '2' },
      status: 'conferido',
    });

    const cases: [Parameters<typeof fakeFormacao>[0], RegExp][] = [
      [{ ctr: 'U' }, /inclusão deste nível/],
      [{ hide: ['f_titulo'] }, /não tem: Título/],
      [{ pages: { inst: '<p>Nenhum registro</p>' } }, /0 resultados/],
      [{ pages: { curso: '<select name="f_curso"></select>' } }, /Curso não encontrado/],
      [{ pages: { agencia: '<p>vazio</p>' } }, /Agência não encontrada/],
    ];
    for (const [opts, detail] of cases) {
      const fake = fakeFormacao(opts);
      expect(await applyCreateFormacao(op(), fake.port)).toMatchObject({ detail, status: 'erro' });
      expect(fake.posts).toEqual([]);
    }
    const long = { ...op(), set: { ...op().set, f_orient: 'x'.repeat(61) } };
    expect(await applyCreateFormacao(long, fakeFormacao().port)).toMatchObject({
      detail: expect.stringMatching(/Orientador passa do limite/),
    });
  });

  it('depois do envio, confere que existe uma formação nova igual à enviada', async () => {
    expect(await applyCreateFormacao(op(), fakeFormacao({ created: 0 }).port)).toMatchObject({
      detail: expect.stringMatching(/0 formações novas.*pode ter sido criada/),
      status: 'divergente',
    });
    expect(await applyCreateFormacao(op(), fakeFormacao({ created: 2 }).port)).toMatchObject({
      detail: expect.stringMatching(/2 formações novas/),
    });
    expect(
      await applyCreateFormacao(op(), fakeFormacao({ tamper: { f_ano_ini: '1999' } }).port),
    ).toMatchObject({
      assigned: { 'SEQUENCIA-FORMACAO': '1' },
      detail: expect.stringMatching(/gravada diferente: Ano de início/),
      status: 'divergente',
    });
    expect(
      await applyCreateFormacao(op(), fakeFormacao({ tamper: { f_cod_inst2: 'D9' } }).port),
    ).toMatchObject({ detail: expect.stringMatching(/Instituição/) });
    // O que veio das buscas também é relido: curso e agência diferentes falham.
    expect(
      await applyCreateFormacao(op(), fakeFormacao({ tamper: { f_cod_curso2: '99999999' } }).port),
    ).toMatchObject({
      detail: expect.stringMatching(/gravada diferente: f_cod_curso2/),
      status: 'divergente',
    });
    expect(
      await applyCreateFormacao(op(), fakeFormacao({ tamper: { f_nme_agencia: 'Outra' } }).port),
    ).toMatchObject({ detail: expect.stringMatching(/gravada diferente: f_nme_agencia/) });
    // Campo enviado que a releitura não traz fica sem conferir, nunca conferido.
    expect(
      await applyCreateFormacao(op(), fakeFormacao({ unread: ['f_agencia', 'f_curso'] }).port),
    ).toMatchObject({
      assigned: { 'SEQUENCIA-FORMACAO': '1' },
      detail: expect.stringMatching(/não conferida: o formulário relido não traz .*f_agencia/),
      status: 'divergente',
    });
    expect(await applyCreateFormacao(op(), fakeFormacao({ logonOnPost: true }).port)).toMatchObject(
      {
        status: 'sessao',
      },
    );
    expect(
      await applyCreateFormacao(op(), fakeFormacao({ sessionAfterPost: true }).port),
    ).toMatchObject({
      detail: expect.stringMatching(/conferência falhou.*pode ter sido criada/),
      status: 'divergente',
    });
  });

  it('sem a lista no menu ou com a sessão caída, não envia nada', async () => {
    const fake = fakeFormacao();
    expect(
      await applyCreateFormacao(op(), { ...fake.port, menuHtml: () => '<p>menu</p>' }),
    ).toMatchObject({ detail: expect.stringMatching(/não encontrada no menu/), status: 'erro' });
    expect(
      await applyCreateFormacao(op(), {
        ...fake.port,
        get: async () => '<SCRIPT>location="pkg_sec.logon?f_cod=ini"</SCRIPT>',
      }),
    ).toMatchObject({ status: 'sessao' });
    expect(
      await applyCreateFormacao(op(), {
        ...fake.port,
        get: async () => {
          throw new Error('rede');
        },
      }),
    ).toMatchObject({ detail: 'rede', status: 'erro' });
    expect(
      await applyCreateFormacao(op(), { ...fake.port, readForm: () => undefined }),
    ).toMatchObject({ detail: expect.stringMatching(/GN_FORMACAO2 não encontrado/) });
    expect(fake.posts).toEqual([]);
  });
});

describe('leituras das buscas', () => {
  it('lê os argumentos das chamadas e as opções da lista', () => {
    expect(
      jsCalls(
        `atribuir('1','CNPq') atribuir("2", "D\\'Avila &amp; Cia") preencherOpener('a', 3, '')`,
        'atribuir',
      ),
    ).toEqual([
      ['1', 'CNPq'],
      ['2', "D'Avila & Cia"],
    ]);
    expect(jsCalls(`preencherOpener('a', 3 , '')`, 'preencherOpener')).toEqual([['a', '3', '']]);
    // Chamada sem fechar parêntese não conta.
    expect(jsCalls(`atribuir('1' x`, 'atribuir')).toEqual([]);
    expect(
      selectEntries(
        '<select name="f_curso"><option value="">Selecione</option><option value=V1 >Um</option></select>',
        'f_curso',
      ),
    ).toEqual([{ text: 'Um', value: 'V1' }]);
    expect(selectEntries('<p/>', 'f_curso')).toEqual([]);
  });
});

describe('inclusão de formação no contrato e no registro', () => {
  it('com a chave ligada, o contrato confere o formulário do mestrado, em modo I', async () => {
    const contract = { forms: { ...LATTES_CONTRACT.forms, ...CREATE_SPECS }, menu: [] };
    const report = await checkContract(fakeFormacao().port, contract);
    expect(report.forms.find((f) => f.kind === 'criar-formacao')).toMatchObject({ status: 'ok' });
    const changed = await checkContract(fakeFormacao({ ctr: 'U' }).port, contract);
    expect(changed.forms.find((f) => f.kind === 'criar-formacao')?.drifts).toContainEqual(
      expect.objectContaining({ expected: 'I', kind: 'modo-mudou' }),
    );
    const noList = await checkContract(
      { ...fakeFormacao().port, menuHtml: () => '<p/>' },
      contract,
    );
    expect(noList.forms.find((f) => f.kind === 'criar-formacao')).toMatchObject({
      status: 'nao-encontrado',
    });
  });

  it('o contrato parcial não acusa os campos que não lista', () => {
    const observed = { a: { type: 'text' }, b: { type: 'text' } };
    expect(compareForm('F', { a: { type: 'text' } }, observed, true)).toEqual([]);
    expect(compareForm('F', { a: { type: 'text' } }, observed)).toHaveLength(1);
    expect(CREATE_FORMACAO_SPEC.partial).toBe(true);
  });

  it('uma formação criada não se desfaz pelo conector', () => {
    expect(undoOp({ ...sentEntry(op(), '1', 1), id: 1 })).toBeUndefined();
  });
});
