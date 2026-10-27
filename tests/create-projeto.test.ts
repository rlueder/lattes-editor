import { describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { checkContract, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { planCreateAtuacao } from '../src/bridge/create.ts';
import { CREATE_SPECS } from '../src/bridge/create-items.ts';
import {
  applyCreateProjeto,
  type CreateProjetoOp,
  planCreateProjeto,
  projetoOp,
  TEAM_BY_HAND,
  TEAM_UNREAD,
  vinculoChoices,
} from '../src/bridge/create-projeto.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { type Change, diffDocuments, pathTo, resolvePath } from '../src/model/changes.ts';
import { parseXml, walk, type XElement } from '../src/model/xml.ts';
import { CV, fakeProjeto } from './helpers/fake-lattes-create.ts';

const PROJETO =
  'SEQUENCIA-PROJETO="8" ANO-INICIO="2024" ANO-FIM="" NOME-DO-PROJETO="Genômica de palmeiras" ' +
  'SITUACAO="EM_ANDAMENTO" NATUREZA="PESQUISA" NUMERO-GRADUACAO="3" NUMERO-DOUTORADO="1" ' +
  'DESCRICAO-DO-PROJETO="Diversidade genética." FLAG-POTENCIAL-INOVACAO="NAO" ' +
  'FORMATO-DATA-CERTIFICACAO="DDMMAAAA" IDENTIFICADOR-PROJETO=""';

const OWNER =
  'NOME-COMPLETO="Ana Silva" NOME-PARA-CITACAO="SILVA, A." ORDEM-DE-INTEGRACAO="1" FLAG-RESPONSAVEL="SIM" NRO-ID-CNPQ="1234567890123456"';

const cv = (projeto: string, inst = 'CODIGO-INSTITUICAO="001000000998"') =>
  parseXml(
    `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1234567890123456"><DADOS-GERAIS NOME-COMPLETO="Ana Silva"><ATUACOES-PROFISSIONAIS>
      <ATUACAO-PROFISSIONAL ${inst} NOME-INSTITUICAO="Universidade de Exemplo" SEQUENCIA-ATIVIDADE="3">
        <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2019"/>
        <ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
          <PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCAO-ATIVIDADE="4" FLAG-PERIODO="ATUAL" ANO-INICIO="2024">${projeto}</PARTICIPACAO-EM-PROJETO>
        </ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
      </ATUACAO-PROFISSIONAL>
    </ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`,
  ).root;

const projeto = (
  attrs = PROJETO,
  children = `<EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO ${OWNER}/></EQUIPE-DO-PROJETO>`,
) => `<PROJETO-DE-PESQUISA ${attrs}>${children}</PROJETO-DE-PESQUISA>`;

/** Planeja o projeto novo como a lista de alterações o entrega (a participação inteira é nova). */
function planned(xml: string, inst?: string, text?: string) {
  const after = cv(xml, inst);
  const original = parseXml(
    `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1234567890123456"><DADOS-GERAIS NOME-COMPLETO="Ana Silva"><ATUACOES-PROFISSIONAIS>
      <ATUACAO-PROFISSIONAL ${inst ?? 'CODIGO-INSTITUICAO="001000000998"'} NOME-INSTITUICAO="Universidade de Exemplo" SEQUENCIA-ATIVIDADE="3">
        <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2019"/>
      </ATUACAO-PROFISSIONAL>
    </ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`,
  ).root;
  const changes = diffDocuments(original, after).filter((c) => c.kind === 'novo');
  const change = changes[0]!;
  const chain = resolvePath(after, change.path);
  // O texto do potencial, escrito no editor para o elemento do projeto (InnovationText.tsx).
  let key = '';
  walk(after, (el) => {
    if (el.name === 'PROJETO-DE-PESQUISA') key = pathTo(after, el)!.join('/');
  });
  const extras = text ? { [key]: { f_txt_potencial: text } } : {};
  return projetoOp(change, chain, 'Projeto · Genômica', extras);
}

const op = () => planned(projeto()) as CreateProjetoOp;

describe('planejar a inclusão de um projeto', () => {
  it('sem a opção do plano fica de fora; ligada, o projeto novo vai à mão pela equipe', () => {
    expect(LATTES_CONTRACT.forms['criar-projeto']).toBeDefined();
    const before = cv(projeto(PROJETO.replace('SEQUENCIA-PROJETO="8"', 'SEQUENCIA-PROJETO="7"')));
    const after = cv(
      projeto(PROJETO.replace('SEQUENCIA-PROJETO="8"', 'SEQUENCIA-PROJETO="7"')) + projeto(),
    );
    const entries = diffDocuments(before, after).map((c) => ({ change: c, itemTitle: '' }));
    expect(entries.map((e) => e.change.element)).toEqual(['PROJETO-DE-PESQUISA']);
    expect(planChanges(entries, after).ops).toEqual([]);
    // Ligada, o projeto novo vai à mão pelo motivo da equipe (seção 21).
    const on = planChanges(entries, after, { createItems: true });
    expect(on.ops).toEqual([]);
    expect(on.unsupported.map((u) => u.reason)).toEqual([TEAM_BY_HAND]);
  });

  it('leva os campos do projeto e a natureza, que escolhe a lista', () => {
    expect(op()).toMatchObject({
      expect: {},
      institutionCode: '001000000998',
      institutionName: 'Universidade de Exemplo',
      kind: 'criar-projeto',
      nature: 'P',
    });
    expect(op().set).toEqual({
      F_ANO_FIM: '',
      F_ANO_INIC: '2024',
      F_NRO_DOUTORADO: '1',
      F_NRO_GRADUACAO: '3',
      F_TPO_NATUREZA: 'P',
      F_TPO_SITUACAO: 'A',
      f_ref: 'Diversidade genética.',
      f_sta_inovacao: 'N',
      f_titulo: 'Genômica de palmeiras',
    });
    // A equipe pode estar vazia, ou ter só o dono pelo nome.
    const byName = OWNER.replace('NRO-ID-CNPQ="1234567890123456"', 'NRO-ID-CNPQ=""');
    expect(
      planned(
        projeto(
          PROJETO,
          `<EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO ${byName}/></EQUIPE-DO-PROJETO>`,
        ),
      ),
    ).toHaveProperty('kind');
    expect(planned(projeto(PROJETO, ''))).toHaveProperty('kind');
  });

  it('recusa o que a inclusão não sabe fazer, com o motivo', () => {
    const reason = (xml: string, inst?: string) =>
      (planned(xml, inst) as { reason: string }).reason;
    expect(reason(projeto() + projeto())).toMatch(/um projeto por vez/);
    expect(reason(projeto(), 'CODIGO-INSTITUICAO=""')).toMatch(/código da instituição/);
    expect(reason(projeto(PROJETO.replace('NATUREZA="PESQUISA"', 'NATUREZA=""')))).toMatch(
      /natureza/,
    );
    const other =
      '<EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO NOME-COMPLETO="Bruno" ORDEM-DE-INTEGRACAO="1"/></EQUIPE-DO-PROJETO>';
    expect(reason(projeto(PROJETO, other))).toMatch(/exige você na equipe/);
    // Você e outro integrante: a equipe vai, pela lista de autores do menu (create-projeto-extras.ts).
    const two = `<EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO ${OWNER}/><INTEGRANTES-DO-PROJETO NOME-COMPLETO="Bruno"/></EQUIPE-DO-PROJETO>`;
    expect(planned(projeto(PROJETO, two))).toMatchObject({
      extras: {
        team: expect.arrayContaining([
          expect.objectContaining({ owner: true }),
          expect.objectContaining({ name: 'Bruno', owner: false }),
        ]),
      },
    });
    const notOwner = OWNER.replace('1234567890123456', '9999999999999999');
    expect(
      reason(
        projeto(
          PROJETO,
          `<EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO ${notOwner}/></EQUIPE-DO-PROJETO>`,
        ),
      ),
    ).toMatch(/exige você na equipe/);
    expect(
      reason(
        projeto(
          PROJETO,
          '<FINANCIADORES-DO-PROJETO><FINANCIADOR-DO-PROJETO NOME-INSTITUICAO="CNPq"/></FINANCIADORES-DO-PROJETO>',
        ),
      ),
    ).toMatch(/natureza que o Lattes não tem/);
    // Com a natureza, o financiador vai na inclusão, pela busca (create-projeto-extras.ts).
    expect(
      planned(
        projeto(
          PROJETO,
          '<FINANCIADORES-DO-PROJETO><FINANCIADOR-DO-PROJETO NOME-INSTITUICAO="CNPq" NATUREZA="BOLSA"/></FINANCIADORES-DO-PROJETO>',
        ),
      ),
    ).toMatchObject({ extras: { funders: [{ letter: 'B', name: 'CNPq' }] } });
    // O que o formulário não tem fica fora, à vista, e o projeto vai.
    expect(
      planned(projeto(PROJETO.replace('IDENTIFICADOR-PROJETO=""', 'IDENTIFICADOR-PROJETO="X1"'))),
    ).toMatchObject({ left: [expect.any(String)] });
    expect(
      reason(
        projeto(PROJETO.replace('FLAG-POTENCIAL-INOVACAO="NAO"', 'FLAG-POTENCIAL-INOVACAO="SIM"')),
      ),
    ).toMatch(/escreva no editor qual é o potencial/);
    // Com o texto escrito no editor, o Sim vai com ele.
    expect(
      planned(
        projeto(PROJETO.replace('FLAG-POTENCIAL-INOVACAO="NAO"', 'FLAG-POTENCIAL-INOVACAO="SIM"')),
        undefined,
        'Um processo novo',
      ),
    ).toMatchObject({ set: { f_sta_inovacao: 'S', f_txt_potencial: 'Um processo novo' } });
    expect(reason(projeto(PROJETO.replace('SITUACAO="EM_ANDAMENTO"', 'SITUACAO=""')))).toMatch(
      /nome, situação e ano/,
    );
  });

  it('o órgão escolhido na lista vai com o projeto; só o nome, ou sem órgão, não', () => {
    const before = cv('');
    const after = cv(projeto());
    const changes = diffDocuments(before, after).filter((c) => c.kind === 'novo');
    const chain = resolvePath(after, changes[0]!.path);
    const part = chain.find((c) => c.name === 'PARTICIPACAO-EM-PROJETO')!;
    expect(planCreateProjeto(changes[0]!, chain, 'Projeto')).toEqual({ reason: TEAM_BY_HAND });
    part.attrs.push({ name: 'NOME-ORGAO', value: 'Instituto de Biociências' });
    expect(projetoOp(changes[0]!, chain, 'Projeto')).toEqual({
      reason: expect.stringMatching(/escolha pela lista do Lattes/),
    });
    part.attrs.push({ name: 'CODIGO-ORGAO', value: '000000000101' });
    expect(planCreateProjeto(changes[0]!, chain, 'Projeto')).toMatchObject({
      organ: { code: '000000000101' },
    });
    part.attrs.push(
      { name: 'CODIGO-UNIDADE', value: '000000000102' },
      { name: 'NOME-UNIDADE', value: 'Laboratório de Genética' },
    );
    expect(projetoOp(changes[0]!, chain, 'Projeto')).toMatchObject({
      organ: { code: '000000000102', parent: '000000000101' },
    });
  });

  it('também quando a mudança é o contêiner das participações', () => {
    const original = parseXml(
      `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1234567890123456"><DADOS-GERAIS NOME-COMPLETO="Ana Silva"><ATUACOES-PROFISSIONAIS>
        <ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="001000000998" NOME-INSTITUICAO="Universidade de Exemplo" SEQUENCIA-ATIVIDADE="3">
          <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2019"/>
        </ATUACAO-PROFISSIONAL>
      </ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`,
    ).root;
    const after = cv(projeto());
    const change = diffDocuments(original, after).find((c) => c.kind === 'novo')!;
    expect(change.element).toBe('ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO');
    const chain = resolvePath(after, change.path);
    expect(projetoOp(change, chain, 'Projeto')).toHaveProperty('kind', 'criar-projeto');
    // O planejamento manda à mão: a equipe e o órgão (seção 21).
    expect(planCreateProjeto(change, chain, 'Projeto')).toEqual({ reason: TEAM_BY_HAND });
    const participacao = chain.at(-1)!.children.find((c): c is XElement => c.kind === 'element')!;
    participacao.attrs.push({ name: 'MES-INICIO', value: '3' });
    expect(projetoOp(change, chain, 'Projeto')).toMatchObject({
      left: [expect.stringMatching(/MES-INICIO|Mês/)],
    });
  });

  it('a atuação nova com projeto vai antes; o projeto, no envio seguinte', () => {
    const atuacao = parseXml(
      `<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="1" NOME-INSTITUICAO="U">
        <VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="CELETISTA" ANO-INICIO="2020"/>
        <ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO><PARTICIPACAO-EM-PROJETO>${projeto()}</PARTICIPACAO-EM-PROJETO></ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
      </ATUACAO-PROFISSIONAL>`,
    ).root;
    const change = { key: 'k', kind: 'novo' } as Change;
    expect(planCreateAtuacao(change, atuacao, 'Atuação')).toMatchObject({
      kind: 'criar-atuacao',
      later: [expect.stringMatching(/projeto/i)],
    });
  });
});

describe('incluir o projeto no Lattes falso', () => {
  it('escolhe a atuação, inclui, acha o projeto novo e confere', async () => {
    const fake = fakeProjeto();
    const result = await applyOp(op(), fake.port);
    expect(result).toMatchObject({
      assigned: { 'SEQUENCIA-PROJETO': '1' },
      detail: TEAM_UNREAD,
      status: 'conferido',
    });
    expect(fake.posts.map((p) => p.path)).toEqual(['PKG_PROJETO.FORM']);
    expect(fake.posts[0]!.body).toMatchObject({
      // A própria pessoa na equipe, como coordenadora (seção 22).
      f_autores_l: 'Ana Silva||SILVA, A.|s',
      // O vínculo da atuação vai para os ocultos; os anos do projeto valem.
      F_ANO_FIM: '',
      F_ANO_INIC: '2024',
      F_TPO_NATUREZA: 'P',
      F_TPO_SITUACAO: 'A',
      f_carga: '40',
      f_cod: CV,
      // Projeto guarda o código sem a letra.
      f_cod_inst2: '001000000998',
      f_ctr: 'I',
      f_enqua: 'Professor Adjunto',
      f_inst: 'UNIVERSIDADE DE EXEMPLO',
      f_regime: '3',
      f_stavinc: '1',
      f_titulo: 'Genômica de palmeiras',
      f_vinc: 'Servidor público',
    });
  });

  it('o órgão sai da janela de órgãos da instituição e volta no texto de f_orgao', async () => {
    const fake = fakeProjeto();
    const withOrgan = { ...op(), organ: { code: '000000000101' } };
    expect(await applyOp(withOrgan, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.posts[0]!.body).toMatchObject({
      f_codorgao: '000000000101',
      f_codorgao2: '',
      f_orgao_old: 'Instituto de Biociências',
    });
    // Uma unidade: o código dela, e o texto com o órgão de cima.
    const unitFake = fakeProjeto();
    const unit = { ...op(), organ: { code: '000000000102', parent: '000000000101' } };
    expect(await applyOp(unit, unitFake.port)).toMatchObject({ status: 'conferido' });
    expect(unitFake.posts[0]!.body).toMatchObject({
      f_codorgao: '000000000102',
      // O envio do formulário leva a quebra de linha como CRLF.
      f_orgao_old: expect.stringMatching(
        /^Instituto de Biociências\/\r?\nLaboratório de Genética$/,
      ),
    });
    // Órgão fora da janela: nada vai.
    const missing = fakeProjeto();
    expect(await applyOp({ ...op(), organ: { code: '000000000999' } }, missing.port)).toMatchObject(
      { status: 'erro' },
    );
    expect(missing.posts).toEqual([]);
    // O Lattes mostra outro órgão depois de criar.
    const other = fakeProjeto({ tamper: { f_orgao: 'Outro órgão' } });
    expect(await applyOp(withOrgan, other.port)).toMatchObject({ status: 'divergente' });
  });

  it('código com V vai em f_cod_inst', async () => {
    const fake = fakeProjeto();
    const v = { ...op(), institutionCode: '007900000004' };
    expect(await applyCreateProjeto(v, fake.port)).toMatchObject({ status: 'conferido' });
    // O vínculo dessa atuação terminou em 2018; o projeto em andamento vai sem fim.
    expect(fake.posts[0]!.body).toMatchObject({
      F_ANO_FIM: '',
      f_cod_inst: '007900000004',
      f_regime: '',
    });
  });

  it('para antes de enviar quando algo não confere', async () => {
    const duplicate = fakeProjeto({ rows: [{ f_titulo: 'GENÔMICA DE PALMEIRAS' }] });
    expect(await applyCreateProjeto(op(), duplicate.port)).toMatchObject({
      detail: expect.stringMatching(/já tem um projeto/),
      status: 'divergente',
    });
    expect(duplicate.posts).toEqual([]);
    const cases: [Parameters<typeof fakeProjeto>[0], RegExp][] = [
      [{ ctr: 'U' }, /inclusão desta natureza/],
      [{ hide: ['f_ref'] }, /não tem: Descrição/],
      [{ pages: { vinculos: '<p>nada</p>' } }, /0 achadas/],
      [{ noInclusion: true }, /Inclusão de projeto não encontrada/],
    ];
    for (const [opts, detail] of cases) {
      const fake = fakeProjeto(opts);
      expect(await applyCreateProjeto(op(), fake.port)).toMatchObject({ detail, status: 'erro' });
      expect(fake.posts).toEqual([]);
    }
    const long = { ...op(), set: { ...op().set, F_NRO_GRADUACAO: '100' } };
    expect(await applyCreateProjeto(long, fakeProjeto().port)).toMatchObject({
      detail: expect.stringMatching(/Alunos de graduação passa do limite/),
    });
    const otherNature = { ...op(), nature: 'D' };
    expect(await applyCreateProjeto(otherNature, fakeProjeto().port)).toMatchObject({
      detail: expect.stringMatching(/não está no menu/),
      status: 'erro',
    });
  });

  it('depois do envio, confere que existe um projeto novo igual ao enviado', async () => {
    expect(await applyCreateProjeto(op(), fakeProjeto({ created: 0 }).port)).toMatchObject({
      detail: expect.stringMatching(/0 projetos novos.*pode ter sido criado:/),
      status: 'divergente',
    });
    expect(
      await applyCreateProjeto(op(), fakeProjeto({ tamper: { f_titulo: 'Outro' } }).port),
    ).toMatchObject({
      assigned: { 'SEQUENCIA-PROJETO': '1' },
      detail: expect.stringMatching(/outro valor em: Título/),
      status: 'divergente',
    });
    // A instituição e o vínculo da atuação também são relidos: projeto
    // pendurado em outra atuação falha.
    expect(
      await applyCreateProjeto(
        op(),
        fakeProjeto({ tamper: { f_cod_inst2: '009', f_vinc: 'Outro' } }).port,
      ),
    ).toMatchObject({
      detail: expect.stringMatching(/outro valor em: Vínculo, Instituição/),
      status: 'divergente',
    });
    expect(
      await applyCreateProjeto(op(), fakeProjeto({ unread: ['f_vinc', 'f_regime'] }).port),
    ).toMatchObject({
      assigned: { 'SEQUENCIA-PROJETO': '1' },
      detail: expect.stringMatching(/não deu para reler: /),
      status: 'divergente',
    });
    expect(await applyCreateProjeto(op(), fakeProjeto({ logonOnPost: true }).port)).toMatchObject({
      status: 'sessao',
    });
    expect(
      await applyCreateProjeto(op(), fakeProjeto({ sessionAfterPost: true }).port),
    ).toMatchObject({ detail: expect.stringMatching(/conferência falhou/), status: 'divergente' });
  });

  it('erros fora do Lattes não enviam nada', async () => {
    const fake = fakeProjeto();
    expect(
      await applyCreateProjeto(op(), {
        ...fake.port,
        menuHtml: () => {
          throw new Error('aba fechada');
        },
      }),
    ).toMatchObject({ detail: 'aba fechada', status: 'erro' });
    expect(fake.posts).toEqual([]);
  });

  it('lê as instituições das atuações na janela pp_lista_inst', () => {
    expect(
      vinculoChoices(
        "preencherOpener('a','','1','2019','','40','Celetista','D1','U') preencherOpener('curta')",
      ),
    ).toEqual([
      {
        anoFim: '',
        anoInic: '2019',
        carga: '40',
        code: 'D1',
        enqua: 'a',
        name: 'U',
        regime: '',
        stavinc: '1',
        vinc: 'Celetista',
      },
    ]);
  });
});

describe('inclusão de projeto no contrato e no registro', () => {
  it('com a chave ligada, o contrato confere o formulário de inclusão de pesquisa', async () => {
    const contract = { forms: { ...LATTES_CONTRACT.forms, ...CREATE_SPECS }, menu: [] };
    const report = await checkContract(fakeProjeto().port, contract);
    expect(report.forms.find((f) => f.kind === 'criar-projeto')).toMatchObject({ status: 'ok' });
    const noLink = await checkContract(fakeProjeto({ noInclusion: true }).port, contract);
    expect(noLink.forms.find((f) => f.kind === 'criar-projeto')).toMatchObject({
      status: 'nao-encontrado',
    });
    const noList = await checkContract({ ...fakeProjeto().port, menuHtml: () => '<p/>' }, contract);
    expect(noList.forms.find((f) => f.kind === 'criar-projeto')?.drifts[0]).toMatchObject({
      field: 'pkg_projeto.lista',
    });
  });

  it('um projeto criado não se desfaz pelo conector', () => {
    expect(undoOp({ ...sentEntry(op(), '1', 1), id: 1 })).toBeUndefined();
  });
});
