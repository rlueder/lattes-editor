import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { LOGON_REDIRECT } from '../scripts/lattes-simulado/html.ts';
import { applyOp, BUILD_GATES } from '../src/bridge/apply.ts';
import {
  BIOGRAPHIC_OPS_ENABLED,
  BIOGRAPHIC_SPECS,
  biographicContract,
  type BiographicOp,
  biographicSample,
  planBiographic,
} from '../src/bridge/biographic.ts';
import {
  blocksKind,
  checkContract,
  type Contract,
  LATTES_CONTRACT,
} from '../src/bridge/contract.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1">
<DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NACIONALIDADE="B" SEXO="MASCULINO">
<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo"/>
<ENDERECO FLAG-DE-PREFERENCIA="ENDERECO_INSTITUCIONAL">
<ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="Universidade" LOGRADOURO-COMPLEMENTO="Rua A, 1" PAIS="Brasil" UF="RS" CEP="90000000" CIDADE="Porto Alegre" BAIRRO="Centro" DDD="51" TELEFONE="33330000" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="a@example.org" HOME-PAGE=""/>
<ENDERECO-RESIDENCIAL LOGRADOURO="Rua B, 2" PAIS="Brasil" UF="RS" CEP="96000000" CIDADE="Pelotas" BAIRRO="Fragata" DDD="" TELEFONE="" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="" HOME-PAGE=""/>
</ENDERECO>
<FORMACAO-ACADEMICA-TITULACAO>
<GRADUACAO SEQUENCIA-FORMACAO="2" NIVEL="1" TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO="TCC" NOME-INSTITUICAO="UFPel" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2001" ANO-DE-CONCLUSAO="2004"/>
<MESTRADO SEQUENCIA-FORMACAO="1" NIVEL="3" NOME-INSTITUICAO="PUCRS" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="2006" ANO-DE-CONCLUSAO="" ANO-DE-OBTENCAO-DO-TITULO="" TITULO-DA-DISSERTACAO-TESE="Dissertação" NOME-COMPLETO-DO-ORIENTADOR="Orientador"/>
<POS-DOUTORADO SEQUENCIA-FORMACAO="9" NIVEL="P" ANO-DE-INICIO="2010" ANO-DE-CONCLUSAO=""/>
</FORMACAO-ACADEMICA-TITULACAO>
</DADOS-GERAIS></CURRICULO-VITAE>`;

function find(root: XElement, name: string): XElement {
  const stack = [root];
  while (stack.length) {
    const el = stack.pop()!;
    if (el.name === name) return el;
    for (const c of el.children) if (c.kind === 'element') stack.push(c);
  }
  throw new Error(name);
}

function plan(edit: (root: XElement) => void, enabled = true, xml = XML) {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: 'X' }));
  return planChanges(entries, working, { biographicFull: enabled, biographicOps: enabled });
}

function onlyOp(edit: (root: XElement) => void, xml = XML): BiographicOp {
  const planned = plan(edit, true, xml);
  expect(planned.unsupported).toEqual([]);
  expect(planned.ops).toHaveLength(1);
  return planned.ops[0] as BiographicOp;
}

const editMestrado = (attrs: Record<string, string>) => (root: XElement) => {
  const el = find(root, 'MESTRADO');
  for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v);
};

// ---------------------------------------------------------------- planejar

// As buscas do endereço estão desligadas na montagem (edit-lists.ts); os testes as ligam.
const LOOKUPS_ON = { ...BUILD_GATES, complEnderecoLookups: true };

describe('dados gerais: chave desligada', () => {
  it('ligada na montagem, entra no contrato; desligada, manda tudo à mão', () => {
    expect(BIOGRAPHIC_OPS_ENABLED).toBe(true);
    for (const kind of ['formacao', 'endereco', 'identificacao'] as const) {
      expect(LATTES_CONTRACT.forms[kind]).toBeDefined();
    }
    for (const proc of ['pkg_formacao.lista', 'prc_endereco', 'prc_ident']) {
      expect(LATTES_CONTRACT.menu).toContain(proc);
    }
    // A chave forçada a desligar: nada no contrato.
    expect(biographicContract(false)).toEqual({ forms: {}, menu: [] });
    const edit = (root: XElement) => {
      setAttr(find(root, 'MESTRADO'), 'ANO-DE-CONCLUSAO', '2007');
      setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'BAIRRO', 'Centro');
      setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome');
    };
    const off = plan(edit, false);
    expect(off.ops).toEqual([]);
    expect(off.unsupported.map((u) => u.reason)).toEqual([
      'Formulário não suportado ainda',
      'Formulário não suportado ainda',
      'Formulário não suportado ainda',
    ]);
    // Sem a opção, fica desligada: só planOptionsFor liga, com a capacidade.
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    edit(working);
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    expect(planChanges(entries, working).ops).toEqual([]);
    expect(
      plan(edit)
        .ops.map((o) => o.kind)
        .sort(),
    ).toEqual(['endereco', 'formacao', 'identificacao']);
  });
});

describe('dados gerais: formação acadêmica', () => {
  it('leva anos, situação e título, com nível e início para conferir', () => {
    const op = onlyOp(
      editMestrado({
        'ANO-DE-CONCLUSAO': '2007',
        'ANO-DE-OBTENCAO-DO-TITULO': '2007',
        'STATUS-DO-CURSO': 'CONCLUIDO',
        'TITULO-DA-DISSERTACAO-TESE': 'Dissertação revista',
      }),
    );
    expect(op).toMatchObject({
      expect: {
        F_STATUS: 'N',
        f_ano_fim: '',
        f_ano_obten: '',
        f_nivel: '3',
        f_titulo: 'Dissertação',
      },
      identity: { f_ano_ini: ['2006'], f_curso_old: [''], f_inst_old: ['PUCRS'] },
      kind: 'formacao',
      seq: '1',
      set: {
        F_STATUS: 'S',
        f_ano_fim: '2007',
        f_ano_obten: '2007',
        f_titulo: 'Dissertação revista',
      },
    });
    // O início alterado vai no set e confere o valor antigo.
    const start = onlyOp(editMestrado({ 'ANO-DE-INICIO': '2005' }));
    expect(start.expect.f_ano_ini).toBe('2006');
    expect(start.set.f_ano_ini).toBe('2005');
    expect(start.identity).not.toHaveProperty('f_ano_ini');
    // Graduação: o título é o do trabalho de conclusão.
    const grad = onlyOp((root) =>
      setAttr(find(root, 'GRADUACAO'), 'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO', 'Novo TCC'),
    );
    expect(grad).toMatchObject({
      expect: { f_nivel: '1' },
      seq: '2',
      set: { f_titulo: 'Novo TCC' },
    });
  });

  it('situação vazia é nenhum rádio marcado', () => {
    const op = onlyOp(editMestrado({ 'STATUS-DO-CURSO': '' }));
    expect(op.set.F_STATUS).toBeNull();
  });

  it('recusa o que não sabe fazer, com o motivo', () => {
    const reasons = (edit: (root: XElement) => void) => plan(edit).unsupported.map((u) => u.reason);
    expect(reasons(editMestrado({ 'NOME-INSTITUICAO': 'Outra' }))).toEqual([
      expect.stringMatching(/^A instituição só muda pela busca do Lattes/),
    ]);
    expect(reasons(editMestrado({ 'STATUS-DO-CURSO': 'TRANCADO' }))).toEqual([
      expect.stringMatching(/^Valor que o formulário de mestrado do Lattes não tem: /),
    ]);
    expect(
      reasons((root) => {
        const el = find(root, 'MESTRADO');
        setAttr(el, 'NIVEL', '');
        setAttr(el, 'ANO-DE-CONCLUSAO', '2007');
      }),
    ).toEqual([expect.stringMatching(/^O nível é o tipo da formação no Lattes/)]);
    // Pós-doutorado: a outra lista (f_tipo=AP), com o nível do formulário.
    const pos = plan((root) => setAttr(find(root, 'POS-DOUTORADO'), 'ANO-DE-CONCLUSAO', '2012'));
    expect(pos.unsupported).toEqual([]);
    expect(pos.ops[0]).toMatchObject({
      expect: { f_ano_fim: '', f_nivel: '5', f_tipo: 'AP' },
      kind: 'formacao',
      list: 'AP',
      seq: '9',
      set: { f_ano_fim: '2012' },
    });
  });
});

describe('dados gerais: endereço e identificação', () => {
  it('endereço profissional vai nos campos _i, residencial nos _r', () => {
    const prof = onlyOp((root) => {
      const el = find(root, 'ENDERECO-PROFISSIONAL');
      setAttr(el, 'LOGRADOURO-COMPLEMENTO', 'Rua C, 3');
      setAttr(el, 'TELEFONE', '33331111');
    });
    expect(prof).toMatchObject({
      expect: { f_fone_i: '33330000', f_rua_i: 'Rua A, 1' },
      kind: 'endereco',
      set: { f_fone_i: '33331111', f_rua_i: 'Rua C, 3' },
    });
    const res = onlyOp((root) => setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'CEP', '96010000'));
    expect(res.set).toEqual({ f_cep_r: '96010000' });
    expect(opRows(res)).toEqual([
      { after: '96010000', before: '96000000', label: 'CEP (residencial)', name: 'f_cep_r' },
    ]);
  });

  it('o logradouro de cada endereço vai no campo dele, sem um sobrescrever o outro', () => {
    const res = onlyOp((root) =>
      setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'LOGRADOURO', 'Rua D'),
    );
    expect(res.set).toEqual({ f_rua_r: 'Rua D' });
    // O atributo do outro elemento, se aparecer, não cai no mesmo campo.
    const both = plan((root) => {
      const el = find(root, 'ENDERECO-PROFISSIONAL');
      setAttr(el, 'LOGRADOURO-COMPLEMENTO', 'Rua E');
      setAttr(el, 'LOGRADOURO', 'Rua F');
    });
    expect(both.ops).toEqual([]);
    expect(both.unsupported.map((u) => u.reason)).toEqual([
      expect.stringMatching(/^Campos não suportados ainda: /),
    ]);
    // Dois títulos no mesmo item da formação também não passam.
    const titles = plan(
      editMestrado({
        'TITULO-DA-DISSERTACAO-TESE': 'Nova',
        'TITULO-DA-MONOGRAFIA': 'Outra',
      }),
    );
    expect(titles.ops).toEqual([]);
  });

  it('país e preferência de endereço vão; a instituição do profissional fica à mão', () => {
    const planned = plan((root) => {
      setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'PAIS', 'Portugal');
      setAttr(find(root, 'ENDERECO'), 'FLAG-DE-PREFERENCIA', 'ENDERECO_RESIDENCIAL');
    });
    expect(planned.unsupported).toEqual([]);
    expect(planned.ops.map((o) => [o.set, o.expect])).toEqual(
      expect.arrayContaining([
        [{ f_pais_r: 'POR' }, { f_pais_r: 'BRA' }],
        [{ f_end_corr: 'R' }, { f_end_corr: 'I' }],
      ]),
    );
    const reasons = plan((root) =>
      setAttr(find(root, 'ENDERECO-PROFISSIONAL'), 'NOME-INSTITUICAO-EMPRESA', 'Outra'),
    ).unsupported.map((u) => u.reason);
    expect(reasons).toEqual([expect.stringMatching(/^A instituição só muda pela busca do Lattes/)]);
  });

  it('identificação leva o nome e o sexo, conferindo a nacionalidade', () => {
    const op = onlyOp((root) => setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome'));
    expect(op).toMatchObject({
      expect: { f_nacionalidade: 'B', f_nome: 'Pessoa de Teste' },
      kind: 'identificacao',
      set: { f_nome: 'Outro Nome' },
    });
    expect(opRows(op)[0]).toMatchObject({ label: 'Nome completo' });
    // Sem nacionalidade B ou E no XML, não há com o que conferir: segue à mão.
    for (const xml of [XML.replace('NACIONALIDADE="B" ', ''), XML.replace('"B"', '""')]) {
      expect(
        plan(
          (root) => setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome'),
          true,
          xml,
        ).unsupported.map((u) => u.reason),
      ).toEqual(['Nacionalidade sem código B ou E no XML: não dá para conferir']);
    }
    expect(onlyOp((root) => setAttr(find(root, 'DADOS-GERAIS'), 'SEXO', 'FEMININO'))).toMatchObject(
      {
        expect: { f_sexo: 'M' },
        set: { f_sexo: 'F' },
      },
    );
  });

  it('só planeja alteração de um elemento que ainda existe', () => {
    const root = parseXml(XML).root;
    const change = {
      element: 'MESTRADO',
      fields: [],
      form: 'Mestrado',
      key: 'k',
      kind: 'novo' as const,
      path: ['CURRICULO-VITAE'],
    };
    expect(planBiographic(change, [root], 'X')).toBeUndefined();
    expect(planBiographic({ ...change, kind: 'alterado' }, [], 'X')).toBeUndefined();
    const path = resolvePath(root, ['CURRICULO-VITAE', 'DADOS-GERAIS', 'RESUMO-CV[#0]']);
    expect(
      planBiographic({ ...change, element: 'RESUMO-CV', kind: 'alterado' }, path, 'X'),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------- Lattes simulado

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com o currículo
// do XML acima: a lista de formação, o endereço e a identificação vêm dele.
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withLattesSimulado>[0] = {}) {
  await open?.close();
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
    ...options,
  });
  return open;
}

const inState = (lattes: LattesSimuladoNoTeste, name: string, seq?: string) =>
  findIn(
    lattes.state.root,
    (el) => el.name === name && (seq === undefined || getAttr(el, 'SEQUENCIA-FORMACAO') === seq),
  )!;

const posts = (lattes: LattesSimuladoNoTeste) => postsOf(lattes).map((p) => p.proc);

/** Os formulários de dados gerais em outro modo (f_ctr). */
const otherMode = faults.rewritePages(/^(pkg_formacao\.form|prc_endereco|prc_ident)$/i, (html) =>
  html.replace('name="f_ctr" value="U"', 'name="f_ctr" value="I"'),
);

const mestradoOp = () =>
  onlyOp(
    editMestrado({
      'ANO-DE-CONCLUSAO': '2007',
      'STATUS-DO-CURSO': 'CONCLUIDO',
      'TITULO-DA-DISSERTACAO-TESE': 'Dissertação revista',
    }),
  );

describe('dados gerais no Lattes simulado', () => {
  it('formação: acha a linha pelo f_seq, envia só os campos e confere', async () => {
    const lattes = await lattesFor();
    expect(await applyOp(mestradoOp(), lattes.port)).toMatchObject({ status: 'conferido' });
    expect(posts(lattes)).toEqual(['pkg_formacao.FORM']);
    const mestrado = inState(lattes, 'MESTRADO');
    expect(getAttr(mestrado, 'ANO-DE-CONCLUSAO')).toBe('2007');
    expect(getAttr(mestrado, 'ANO-DE-INICIO')).toBe('2006');
    expect(getAttr(mestrado, 'NIVEL')).toBe('3');
    expect(getAttr(mestrado, 'TITULO-DA-DISSERTACAO-TESE')).toBe('Dissertação revista');
    expect(getAttr(mestrado, 'STATUS-DO-CURSO')).toBe('CONCLUIDO');
    // A outra formação ficou como estava.
    const graduacao = inState(lattes, 'GRADUACAO');
    expect(getAttr(graduacao, 'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO')).toBe('TCC');
    expect(getAttr(graduacao, 'STATUS-DO-CURSO')).toBe('CONCLUIDO');
  });

  it('formação: desfazer volta ao que estava', async () => {
    const lattes = await lattesFor();
    const op = mestradoOp();
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const undo = undoOp({ ...sentEntry(op, '1', 1), id: 7 })!;
    expect(undo.set).toMatchObject({ f_ano_fim: '', f_titulo: 'Dissertação', F_STATUS: 'N' });
    expect(await applyOp(undo, lattes.port)).toMatchObject({ status: 'conferido' });
    const mestrado = inState(lattes, 'MESTRADO');
    expect(getAttr(mestrado, 'ANO-DE-CONCLUSAO')).toBe('');
    expect(getAttr(mestrado, 'TITULO-DA-DISSERTACAO-TESE')).toBe('Dissertação');
    expect(getAttr(mestrado, 'STATUS-DO-CURSO')).toBe('EM_ANDAMENTO');
  });

  it('formação: não grava noutra formação do mesmo nível e ano quando o f_seq é de outro item', async () => {
    // No editor, o mestrado 1 é da PUCRS. No Lattes, o f_seq=1 é outro mestrado
    // do mesmo ano, noutra instituição e curso: o f_seq não é sempre o número
    // do item (censo de 15/10/2026), e só nível e ano não separam os dois.
    const other =
      '<MESTRADO SEQUENCIA-FORMACAO="1" NIVEL="3" NOME-INSTITUICAO="UFRGS" NOME-CURSO="Física" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="2006" ANO-DE-CONCLUSAO="" ANO-DE-OBTENCAO-DO-TITULO="" TITULO-DA-DISSERTACAO-TESE="Dissertação" NOME-COMPLETO-DO-ORIENTADOR="Orientador"/>';
    const inLattes = XML.replace(/<MESTRADO SEQUENCIA-FORMACAO="1"[^>]*\/>/, other);
    expect(inLattes).toContain('UFRGS');
    await open?.close();
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${inLattes}`),
    });
    for (const edit of [
      editMestrado({ 'STATUS-DO-CURSO': 'CONCLUIDO' }),
      editMestrado({ 'ANO-DE-INICIO': '2005' }),
    ]) {
      const r = await applyOp(onlyOp(edit), open.port);
      expect(r.status).toBe('divergente');
      expect(r.detail).toMatch(/Instituição/);
    }
    expect(posts(open)).toEqual([]);
  });

  it('formação: instituição com outra caixa e acento ainda é a mesma', async () => {
    const lattes = await lattesFor();
    setAttr(inState(lattes, 'MESTRADO'), 'NOME-INSTITUICAO', ' pucrs ');
    expect(await applyOp(mestradoOp(), lattes.port)).toMatchObject({ status: 'conferido' });
  });

  it('formação: para antes de enviar quando algo não confere', async () => {
    // Nível diferente: a linha do Lattes não é a que o editor pensa.
    const wrong = await lattesFor();
    setAttr(inState(wrong, 'MESTRADO'), 'NIVEL', '4');
    expect(await applyOp(mestradoOp(), wrong.port)).toMatchObject({
      detail: expect.stringMatching(/Nível/),
      status: 'divergente',
    });
    expect(posts(wrong)).toEqual([]);
    // Sem a linha na lista.
    const none = await lattesFor();
    const fa = inState(none, 'FORMACAO-ACADEMICA-TITULACAO');
    for (const name of ['MESTRADO', 'GRADUACAO']) none.state.remove(fa, inState(none, name));
    expect(await applyOp(mestradoOp(), none.port)).toMatchObject({
      detail: 'Formação 1 não encontrada no Lattes (0 achadas)',
      status: 'erro',
    });
    // Sem a lista no menu.
    const noMenu = { ...(await lattesFor()).port, menuHtml: () => '<p>menu</p>' };
    expect(await applyOp(mestradoOp(), noMenu)).toMatchObject({
      detail: 'Formação acadêmica não encontrada no menu do Lattes',
      status: 'erro',
    });
    // Fora do modo de alteração.
    expect(
      await applyOp(mestradoOp(), (await lattesFor({ intercept: otherMode })).port),
    ).toMatchObject({
      detail: expect.stringMatching(/modo de alteração/),
      status: 'erro',
    });
    // Sessão caída na lista.
    const logon = await lattesFor({ intercept: faults.logonAtGet(1) });
    expect(await applyOp(mestradoOp(), logon.port)).toMatchObject({ status: 'sessao' });
  });

  it('endereço: grava só o residencial e confere que o resto não mudou', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'BAIRRO', 'Centro'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(posts(lattes)).toEqual(['PRC_ENDERECO']);
    expect(getAttr(inState(lattes, 'ENDERECO-PROFISSIONAL'), 'BAIRRO')).toBe('Centro');
    expect(getAttr(inState(lattes, 'ENDERECO-RESIDENCIAL'), 'BAIRRO')).toBe('Centro');
    const side = await lattesFor({
      intercept: faults.afterPost((_req, state) =>
        setAttr(
          findIn(state.root, (el) => el.name === 'ENDERECO-PROFISSIONAL')!,
          'LOGRADOURO-COMPLEMENTO',
          'outra',
        ),
      ),
    });
    expect(await applyOp(op, side.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: Logradouro (profissional)',
      status: 'divergente',
    });
    const noMenu = { ...side.port, menuHtml: () => '<p>menu</p>' };
    expect(await applyOp(op, noMenu)).toMatchObject({
      detail: 'Endereço não encontrado no menu do Lattes',
      status: 'erro',
    });
  });

  const addressPlan = (edit: (root: XElement) => void, xml = XML, lookups = true) => {
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    edit(working);
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: 'X' }));
    return planChanges(entries, working, {
      biographicFull: true,
      biographicOps: true,
      complEnderecoLookups: lookups,
    });
  };
  const newInstitution = (code: string, name: string) => (root: XElement) => {
    const el = find(root, 'ENDERECO-PROFISSIONAL');
    setAttr(el, 'CODIGO-INSTITUICAO-EMPRESA', code);
    setAttr(el, 'NOME-INSTITUICAO-EMPRESA', name);
  };
  const withOrgan = XML.replace(
    'NOME-INSTITUICAO-EMPRESA="Universidade"',
    'NOME-INSTITUICAO-EMPRESA="Universidade" CODIGO-ORGAO="000001000008" NOME-ORGAO="Instituto de Biociências"',
  );

  it('endereço: a instituição nova pela busca da página de endereço', async () => {
    const lattes = await lattesFor();
    const planned = addressPlan(newInstitution('000000000002', 'Universidade de São Paulo'));
    expect(planned.unsupported).toEqual([]);
    const op = planned.ops[0] as BiographicOp;
    expect(op).toMatchObject({
      institution: { before: '', code: '000000000002', name: 'Universidade de São Paulo' },
      kind: 'endereco',
      set: {},
    });
    expect(opRows(op).map((r) => [r.before, r.after])).toEqual([
      ['Universidade', 'Universidade de São Paulo'],
    ]);
    expect(undoOp({ ...sentEntry(op, '1', 1000), id: 3 })).toBeUndefined();
    expect(await applyOp(op, lattes.port, LOOKUPS_ON)).toMatchObject({ status: 'conferido' });
    // A busca vai por POST, com os ocultos da janela do endereço.
    const search = postsOf(lattes).find((p) => p.proc === 'PRC_INST_ATIV')!;
    expect(search.pairs).toEqual([
      ['F_CTR', 'C'],
      ['F_COD', expect.any(String)],
      ['F_PGM', ''],
      ['F_MODAL_CV', '1'],
      ['f_nome', 'Universidade de São Paulo'],
    ]);
    const sent = postsOf(lattes).find((p) => p.proc === 'PRC_ENDERECO')!.fields;
    // O seleciona() dessa janela tira a letra do código.
    expect(sent).toMatchObject({
      f_cod_inst: '000000000002',
      f_cod_inst2: '',
      f_inst_old: 'Universidade de São Paulo',
    });
    expect(sent).not.toHaveProperty('f_inst');
    const el = inState(lattes, 'ENDERECO-PROFISSIONAL');
    expect(getAttr(el, 'CODIGO-INSTITUICAO-EMPRESA')).toBe('000000000002');
    expect(getAttr(el, 'NOME-INSTITUICAO-EMPRESA')).toBe('Universidade de São Paulo');
  });

  it('endereço: instituição de letra que não é V vai em f_cod_inst2', async () => {
    const lattes = await lattesFor();
    const op = addressPlan(
      newInstitution('000000000004', 'Empresa Brasileira de Pesquisa Agropecuária'),
    ).ops[0]!;
    expect(await applyOp(op, lattes.port, LOOKUPS_ON)).toMatchObject({ status: 'conferido' });
    const sent = postsOf(lattes).find((p) => p.proc === 'PRC_ENDERECO')!.fields;
    expect(sent).toMatchObject({ f_cod_inst: '', f_cod_inst2: '000000000004' });
  });

  it('endereço: o Lattes com outra instituição, ou a busca sem ela, nada é enviado', async () => {
    const op = addressPlan(newInstitution('000000000002', 'Universidade de São Paulo')).ops[0]!;
    const other = await lattesFor();
    setAttr(inState(other, 'ENDERECO-PROFISSIONAL'), 'CODIGO-INSTITUICAO-EMPRESA', '000000000001');
    expect(await applyOp(op, other.port, LOOKUPS_ON)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Instituição',
      status: 'divergente',
    });
    expect(posts(other)).toEqual([]);
    const missing = addressPlan(newInstitution('000000000099', 'Universidade Inexistente')).ops[0]!;
    const lattes = await lattesFor();
    expect(await applyOp(missing, lattes.port, LOOKUPS_ON)).toMatchObject({
      detail: 'Instituição não encontrada na busca do Lattes (0 resultados com o código)',
      status: 'erro',
    });
    expect(posts(lattes)).toEqual(['PRC_INST_ATIV']);
    const logon = await lattesFor({
      intercept: (req, _state, next) =>
        req.proc.toLowerCase() === 'prc_inst_ativ' ? { html: LOGON_REDIRECT } : next(),
    });
    expect(await applyOp(op, logon.port, LOOKUPS_ON)).toMatchObject({ status: 'sessao' });
  });

  it('endereço: o nome que a página não mostra depois de gravar é acusado', async () => {
    const lattes = await lattesFor({
      intercept: faults.afterPost((req, state) => {
        if (req.proc.toLowerCase() !== 'prc_endereco') return;
        setAttr(
          findIn(state.root, (el) => el.name === 'ENDERECO-PROFISSIONAL')!,
          'NOME-INSTITUICAO-EMPRESA',
          'Universidade',
        );
      }),
    });
    const op = addressPlan(newInstitution('000000000002', 'Universidade de São Paulo')).ops[0]!;
    const r = await applyOp(op, lattes.port, LOOKUPS_ON);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/^O Lattes não gravou/);
  });

  it('endereço: com órgão no item, ou sem a capacidade das buscas, fica à mão', async () => {
    const reasons = (edit: (root: XElement) => void, xml = XML, lookups = true) =>
      addressPlan(edit, xml, lookups).unsupported.map((u) => u.reason);
    expect(reasons(newInstitution('000000000002', 'Universidade de São Paulo'), withOrgan)).toEqual(
      [expect.stringMatching(/^Com órgão no endereço profissional/)],
    );
    expect(
      reasons(
        (root) => setAttr(find(root, 'ENDERECO-PROFISSIONAL'), 'NOME-ORGAO', 'Outro'),
        withOrgan,
      ),
    ).toEqual(['Órgão: escolha pela lista do Lattes, que grava o código junto']);
    expect(
      reasons(newInstitution('000000000002', 'Universidade de São Paulo'), XML, false),
    ).toEqual(['Instituição, curso e órgão pelas buscas do Lattes: desligado nesta montagem']);
    expect(
      reasons(
        (root) => setAttr(find(root, 'ENDERECO-PROFISSIONAL'), 'CODIGO-INSTITUICAO-EMPRESA', ''),
        XML.replace(
          'NOME-INSTITUICAO-EMPRESA=',
          'CODIGO-INSTITUICAO-EMPRESA="000000000001" NOME-INSTITUICAO-EMPRESA=',
        ),
      ),
    ).toEqual(['Instituição sem código do Lattes: escolha pela busca de instituições']);
    // O banco exige, com a instituição, o país e, no Brasil, a cidade e a UF (28/10/2026).
    const withoutCity = (root: XElement) => {
      newInstitution('000000000002', 'Universidade de São Paulo')(root);
      setAttr(find(root, 'ENDERECO-PROFISSIONAL'), 'CIDADE', '');
    };
    expect(reasons(withoutCity)).toEqual([
      'Com instituição, o Lattes exige no endereço profissional o país e, no Brasil, a cidade e a UF',
    ]);
    // A extensão sem a capacidade recusa sem enviar.
    const lattes = await lattesFor();
    const op = addressPlan(newInstitution('000000000002', 'Universidade de São Paulo')).ops[0]!;
    expect(await applyOp(op, lattes.port, { editEvento: true, lists: new Set() })).toMatchObject({
      status: 'erro',
    });
    expect(posts(lattes)).toEqual([]);
  });

  const ufrgs = XML.replace(
    'NOME-INSTITUICAO-EMPRESA="Universidade"',
    'CODIGO-INSTITUICAO-EMPRESA="000000000001" NOME-INSTITUICAO-EMPRESA="Universidade Federal do Rio Grande do Sul" CODIGO-ORGAO="000001000008" NOME-ORGAO="Instituto de Biociências" CODIGO-UNIDADE="" NOME-UNIDADE=""',
  );
  const lattesWith = async (xml: string) => {
    await open?.close();
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xml}`),
    });
    return open;
  };
  const newOrgan = (code: string, name: string) => (root: XElement) => {
    const el = find(root, 'ENDERECO-PROFISSIONAL');
    setAttr(el, 'CODIGO-ORGAO', code);
    setAttr(el, 'NOME-ORGAO', name);
  };

  it('endereço: o órgão novo pela janela de órgãos da instituição', async () => {
    const lattes = await lattesWith(ufrgs);
    const planned = addressPlan(newOrgan('000002000004', 'Instituto de Informática'), ufrgs);
    expect(planned.unsupported).toEqual([]);
    const op = planned.ops[0] as BiographicOp;
    expect(op).toMatchObject({
      kind: 'endereco',
      organ: {
        before: '000001000008',
        beforeText: 'Instituto de Biociências',
        code: '000002000004',
      },
    });
    expect(await applyOp(op, lattes.port, LOOKUPS_ON)).toMatchObject({ status: 'conferido' });
    // A janela com a letra da instituição, como o orgao() da página.
    expect(lattes.state.log.map((l) => l.path)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^prc_orgao_cargo\?.*f_cod_inst=V000000000001/),
      ]),
    );
    const sent = postsOf(lattes).find((p) => p.proc === 'PRC_ENDERECO')!.fields;
    expect(sent).toMatchObject({
      f_codorgao: '000002000004',
      f_codorgao2: '',
      f_orgao_old: 'Instituto de Informática',
    });
    expect(sent).not.toHaveProperty('f_orgao');
    const el = inState(lattes, 'ENDERECO-PROFISSIONAL');
    expect(getAttr(el, 'CODIGO-ORGAO')).toBe('000002000004');
    expect(getAttr(el, 'NOME-ORGAO')).toBe('Instituto de Informática');
  });

  it('endereço: instituição nova com o órgão dela, na janela da instituição nova', async () => {
    const usp = ufrgs
      .replace(
        'CODIGO-INSTITUICAO-EMPRESA="000000000001"',
        'CODIGO-INSTITUICAO-EMPRESA="000000000002"',
      )
      .replace('Universidade Federal do Rio Grande do Sul', 'Universidade de São Paulo')
      .replace(
        'CODIGO-ORGAO="000001000008" NOME-ORGAO="Instituto de Biociências"',
        'CODIGO-ORGAO="000009000001" NOME-ORGAO="Órgão de outra"',
      );
    const lattes = await lattesWith(usp);
    const op = addressPlan((root) => {
      newInstitution('000000000001', 'Universidade Federal do Rio Grande do Sul')(root);
      newOrgan('000002000004', 'Instituto de Informática')(root);
    }, usp).ops[0]!;
    expect(op).toMatchObject({
      institution: { code: '000000000001' },
      organ: { code: '000002000004' },
    });
    expect(await applyOp(op, lattes.port, LOOKUPS_ON)).toMatchObject({ status: 'conferido' });
    const el = inState(lattes, 'ENDERECO-PROFISSIONAL');
    expect(getAttr(el, 'CODIGO-INSTITUICAO-EMPRESA')).toBe('000000000001');
    expect(getAttr(el, 'CODIGO-ORGAO')).toBe('000002000004');
  });

  it('endereço: órgão que não está na janela, ou outro no Lattes, nada é enviado', async () => {
    const missing = addressPlan(newOrgan('000099000000', 'Inexistente'), ufrgs).ops[0]!;
    const lattes = await lattesWith(ufrgs);
    expect(await applyOp(missing, lattes.port, LOOKUPS_ON)).toMatchObject({
      detail: expect.stringMatching(/^Órgão não encontrado na janela de órgãos/),
      status: 'erro',
    });
    const op = addressPlan(newOrgan('000002000004', 'Instituto de Informática'), ufrgs).ops[0]!;
    const other = await lattesWith(ufrgs);
    setAttr(inState(other, 'ENDERECO-PROFISSIONAL'), 'NOME-ORGAO', 'Outro órgão');
    expect(await applyOp(op, other.port, LOOKUPS_ON)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Órgão/Unidade',
      status: 'divergente',
    });
    expect(posts(other)).toEqual([]);
    // O órgão não fica vazio, nem troca com unidade no item.
    const reasons = (edit: (root: XElement) => void, xml = ufrgs) =>
      addressPlan(edit, xml).unsupported.map((u) => u.reason);
    expect(reasons(newOrgan('', ''))).toEqual([expect.stringMatching(/não fica vazio/)]);
    expect(
      reasons(
        newOrgan('000002000004', 'Instituto de Informática'),
        ufrgs.replace('CODIGO-UNIDADE=""', 'CODIGO-UNIDADE="000001001004"'),
      ),
    ).toEqual([expect.stringMatching(/^Com unidade no endereço profissional/)]);
  });

  it('endereço: o limite do campo vale antes de enviar', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) =>
      setAttr(find(root, 'ENDERECO-PROFISSIONAL'), 'CEP', '9'.repeat(16)),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'CEP (profissional) passa do limite do Lattes (15 caracteres)',
      status: 'erro',
    });
    expect(posts(lattes)).toEqual([]);
  });

  it('identificação: grava o nome; com a nacionalidade vazia no GET, não envia', async () => {
    const op = onlyOp((root) => setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome'));
    const lattes = await lattesFor();
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const general = inState(lattes, 'DADOS-GERAIS');
    expect(getAttr(general, 'NACIONALIDADE')).toBe('B');
    expect(getAttr(general, 'NOME-COMPLETO')).toBe('Outro Nome');
    const empty = await lattesFor();
    setAttr(inState(empty, 'DADOS-GERAIS'), 'NACIONALIDADE', '');
    expect(await applyOp(op, empty.port)).toMatchObject({
      detail: expect.stringMatching(/Nacionalidade/),
      status: 'divergente',
    });
    expect(posts(empty)).toEqual([]);
  });
});

// ---------------------------------------------------------------- contrato

const contractOn = (): Contract => {
  const extra = biographicContract(true);
  return {
    forms: { ...LATTES_CONTRACT.forms, ...extra.forms },
    menu: [...LATTES_CONTRACT.menu, ...extra.menu],
  };
};

interface CensusForm {
  fields: { maxLength?: number; name: string; type: string }[];
  hidden: string[];
  name: string;
}

describe('dados gerais no contrato', () => {
  it('com a chave ligada, confere os três formulários só lendo', async () => {
    const lattes = await lattesFor();
    const report = await checkContract(lattes.port, contractOn());
    for (const kind of ['endereco', 'identificacao']) {
      expect(report.forms.find((f) => f.kind === kind)).toMatchObject({ status: 'ok' });
    }
    // O contrato da formação é parcial: ano de obtenção, título e os outros
    // campos do formulário (seção 17) não entram na conferência, e com a
    // chave ligada a verificação não acusa mudança por causa deles.
    const formacao = report.forms.find((f) => f.kind === 'formacao')!;
    expect(formacao).toMatchObject({ drifts: [], status: 'ok' });
    expect(blocksKind(report, 'formacao')).toEqual([]);
    expect(report.menu.every((m) => m.found)).toBe(true);
    expect(report.menu.map((m) => m.proc)).toEqual(contractOn().menu);
    expect(postsOf(lattes)).toEqual([]);
  });

  it.each([
    ['endereco', 'GN_ENDERECO'],
    ['identificacao', 'GN_IDENT'],
  ] as const)('%s confere todos os campos que o censo leu no Lattes', (kind, name) => {
    // Campo do formulário fora da especificação aparece no painel como
    // "campo novo" toda vez que a verificação roda.
    const census = JSON.parse(
      readFileSync('docs/lattes-formularios/censo-2026-10-15.json', 'utf8'),
    ) as { entries: { page?: { forms?: CensusForm[] } }[] };
    const form = census.entries.flatMap((e) => e.page?.forms ?? []).find((f) => f.name === name)!;
    const observed = [...new Set([...form.fields.map((f) => f.name), ...form.hidden])].sort();
    const spec = BIOGRAPHIC_SPECS[kind].fields;
    expect(Object.keys(spec).sort()).toEqual(observed);
    for (const field of form.fields) {
      // Nome que aparece também como oculto (f_pcd): o censo não diz qual vem
      // primeiro, e no Lattes real é o oculto (verificação de 16/10/2026).
      const type = form.hidden.includes(field.name) ? 'hidden' : field.type;
      expect(spec[field.name], field.name).toMatchObject({
        type,
        ...(field.maxLength ? { maxLength: field.maxLength } : {}),
      });
    }
  });

  it('aponta modo errado, formação sem exemplar e link sumido', async () => {
    const wrongMode = await checkContract(
      (await lattesFor({ intercept: otherMode })).port,
      contractOn(),
    );
    expect(wrongMode.forms.find((f) => f.kind === 'identificacao')?.drifts).toContainEqual(
      expect.objectContaining({ expected: 'U', kind: 'modo-mudou', observed: 'I' }),
    );
    const semFormacao = await lattesFor();
    const fa = inState(semFormacao, 'FORMACAO-ACADEMICA-TITULACAO');
    for (const name of ['MESTRADO', 'GRADUACAO']) {
      semFormacao.state.remove(fa, inState(semFormacao, name));
    }
    const empty = await checkContract(semFormacao.port, contractOn());
    expect(empty.forms.find((f) => f.kind === 'formacao')).toMatchObject({
      detail: 'O currículo não tem formação acadêmica',
      status: 'sem-amostra',
    });
    const noMenu = { ...semFormacao.port, menuHtml: () => '<p>menu</p>' };
    const gone = await checkContract(noMenu, contractOn());
    for (const [kind, proc] of [
      ['formacao', 'pkg_formacao.lista'],
      ['endereco', 'prc_endereco'],
      ['identificacao', 'prc_ident'],
    ]) {
      expect(gone.forms.find((f) => f.kind === kind)).toMatchObject({
        drifts: [expect.objectContaining({ field: proc, kind: 'link-sumiu' })],
        status: 'nao-encontrado',
      });
    }
  });

  it('o exemplar da formação ignora a lista de pós-doutorado e o link de inclusão', async () => {
    const lattes = await lattesFor();
    const code = lattes.state.code;
    const menu = await lattes.port.menuHtml();
    // O menu tem também a lista de pós-doutorado (f_tipo=AP); o exemplar sai só da FA.
    expect(menu).toContain('f_tipo=AP');
    const found = await biographicSample('formacao', menu, lattes.port.get);
    // A primeira linha da lista, a graduação (f_seq 2), e não o pós-doutorado.
    expect(found).toEqual({ path: `pkg_formacao.form?f_cod=${code}&f_seq=2&f_tipo=FA` });
    const sample = await biographicSample('identificacao', menu, lattes.port.get);
    expect(sample).toEqual({ path: `prc_ident?f_cod=${code}&f_pcd=N` });
  });
});
