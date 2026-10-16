// Alteração de prêmio e de formação complementar (LAT-58, edit-lists.ts): a
// linha se acha abrindo o formulário de cada linha da lista e ficando com o
// único cujos valores são os do item. As chaves ficam desligadas até o teste
// acompanhado; aqui elas são ligadas só pelas opções do plano.

import { afterEach, describe, expect, it } from 'vitest';

import { type ApplyGates, applyOp } from '../src/bridge/apply.ts';
import { checkContract, type Contract, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import {
  EDIT_FORMACAO_COMPL_ENABLED,
  EDIT_PREMIO_ENABLED,
  enabledListEdits,
  FORMACAO_COMPL_SPEC,
  isListEditKind,
  listEditContract,
  type ListEditOp,
  PREMIO_SPEC,
} from '../src/bridge/edit-lists.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { childElements, getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética">
<PREMIOS-TITULOS>
<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Prêmio Jovem Pesquisador" NOME-DA-ENTIDADE-PROMOTORA="Fundação Exemplo" ANO-DA-PREMIACAO="2018" NOME-DO-PREMIO-OU-TITULO-INGLES=""/>
<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Menção honrosa" NOME-DA-ENTIDADE-PROMOTORA="Sociedade Fictícia" ANO-DA-PREMIACAO="2020" NOME-DO-PREMIO-OU-TITULO-INGLES=""/>
<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Menção honrosa" NOME-DA-ENTIDADE-PROMOTORA="Sociedade Fictícia" ANO-DA-PREMIACAO="2021" NOME-DO-PREMIO-OU-TITULO-INGLES=""/>
</PREMIOS-TITULOS></DADOS-GERAIS>
<DADOS-COMPLEMENTARES><FORMACAO-COMPLEMENTAR>
<FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO SEQUENCIA-FORMACAO="4" NIVEL="F" CARGA-HORARIA="20" CODIGO-INSTITUICAO="" NOME-INSTITUICAO="Escola Sintética" CODIGO-CURSO="" NOME-CURSO="Curso de Exemplo" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2019" ANO-DE-CONCLUSAO="2019"/>
<OUTROS SEQUENCIA-FORMACAO="5" NIVEL="Y" CARGA-HORARIA="40" CODIGO-INSTITUICAO="" NOME-INSTITUICAO="Instituto Fictício" CODIGO-CURSO="" NOME-CURSO="Oficina de Exemplo" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="2022" ANO-DE-CONCLUSAO=""/>
</FORMACAO-COMPLEMENTAR></DADOS-COMPLEMENTARES></CURRICULO-VITAE>`;

const ON: PlanOptions = { editFormacaoComplementar: true, editPremio: true };

const premios = (root: XElement) =>
  childElements(
    findIn(root, (el) => el.name === 'PREMIOS-TITULOS')!,
    'PREMIO-TITULO',
  );
const compl = (root: XElement, seq: string) =>
  findIn(root, (el) => getAttr(el, 'SEQUENCIA-FORMACAO') === seq)!;

function planAfter(edit: (root: XElement) => void, options: PlanOptions = ON) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    options,
  );
}

function onlyOp(edit: (root: XElement) => void): ListEditOp {
  const plan = planAfter(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as ListEditOp;
}

function onlyReason(edit: (root: XElement) => void, options: PlanOptions = ON): string {
  const plan = planAfter(edit, options);
  expect(plan.ops).toEqual([]);
  return plan.unsupported.map((u) => u.reason).join(' | ');
}

/** As chaves ligadas do lado da extensão, como numa montagem com elas ligadas. */
const GATES: ApplyGates = { editEvento: true, lists: new Set(['formacao-complementar', 'premio']) };

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

describe('alteração em listas sem número: chaves', () => {
  it('ligadas na montagem; com a opção desligada, o item fica à mão', () => {
    expect(EDIT_PREMIO_ENABLED).toBe(true);
    expect(EDIT_FORMACAO_COMPL_ENABLED).toBe(true);
    expect(enabledListEdits()).toEqual(new Set(['formacao-complementar', 'premio']));
    expect(LATTES_CONTRACT.forms.premio).toBeDefined();
    const edit = (root: XElement) => setAttr(premios(root)[0]!, 'ANO-DA-PREMIACAO', '2019');
    expect(onlyReason(edit, {})).toBe('Formulário não suportado ainda');
    expect(onlyReason(edit, { editFormacaoComplementar: true })).toBe(
      'Formulário não suportado ainda',
    );
  });

  it('ligadas, o contrato ganha os formulários e as listas', () => {
    expect(listEditContract(new Set(['premio', 'formacao-complementar']))).toEqual({
      forms: { 'formacao-complementar': FORMACAO_COMPL_SPEC, premio: PREMIO_SPEC },
      menu: ['pkg_formacao_compl.lista', 'pkg_premio.lista'],
    });
    expect(isListEditKind('premio')).toBe(true);
    expect(isListEditKind('idioma')).toBe(false);
  });
});

describe('prêmio: plano', () => {
  it('troca só o campo alterado, com o antes, e acha a linha pelos outros', () => {
    const op = onlyOp((root) =>
      setAttr(premios(root)[0]!, 'NOME-DO-PREMIO-OU-TITULO', 'Prêmio Pesquisador'),
    );
    expect(op).toMatchObject({ kind: 'premio' });
    expect(op.set).toEqual({ f_titulo: 'Prêmio Pesquisador' });
    expect(op.expect).toEqual({ f_titulo: 'Prêmio Jovem Pesquisador' });
    expect(op.match).toEqual({ f_agencia: 'Fundação Exemplo', f_ano: '2018' });
    expect(opRows(op)).toEqual([
      {
        after: 'Prêmio Pesquisador',
        before: 'Prêmio Jovem Pesquisador',
        label: 'Nome do prêmio ou título',
        name: 'f_titulo',
      },
    ]);
  });

  it('nome e ano não vão vazios, e o nome em inglês fica à mão', () => {
    expect(onlyReason((root) => setAttr(premios(root)[0]!, 'ANO-DA-PREMIACAO', ''))).toMatch(
      /^O Lattes não aceita .* vazio$/,
    );
    expect(
      onlyReason((root) =>
        setAttr(premios(root)[0]!, 'NOME-DO-PREMIO-OU-TITULO-INGLES', 'Young researcher'),
      ),
    ).toBe('O formulário de prêmios e títulos do Lattes não tem o nome em inglês');
  });
});

describe('formação complementar: plano', () => {
  it('carga e status, com o nível na conferência e curso e instituição para achar', () => {
    const op = onlyOp((root) => {
      setAttr(compl(root, '5'), 'CARGA-HORARIA', '60');
      setAttr(compl(root, '5'), 'STATUS-DO-CURSO', 'CONCLUIDO');
    });
    expect(op).toMatchObject({ kind: 'formacao-complementar' });
    expect(op.set).toEqual({ f_carga: '60', F_STATUS: 'S' });
    expect(op.expect).toEqual({ f_carga: '40', f_nivel: 'Y', F_STATUS: 'N' });
    expect(op.match).toEqual({
      f_curso_old: 'Oficina de Exemplo',
      f_inst_old: 'Instituto Fictício',
    });
    expect(opRows(op).map((r) => [r.label, r.before, r.after])).toEqual([
      ['Carga horária', '40', '60'],
      ['Status do curso', 'Em andamento', 'Concluído'],
    ]);
  });

  it('o que o formulário não tem, ou o que não se converte, fica à mão', () => {
    expect(onlyReason((root) => setAttr(compl(root, '4'), 'ANO-DE-INICIO', '2018'))).toBe(
      'O formulário de formação complementar do Lattes não tem os anos',
    );
    expect(onlyReason((root) => setAttr(compl(root, '4'), 'CARGA-HORARIA', 'vinte'))).toMatch(
      /^Campos não suportados ainda: /,
    );
    expect(onlyReason((root) => setAttr(compl(root, '4'), 'NOME-CURSO', 'Outro curso'))).toMatch(
      /^Campos não suportados ainda: /,
    );
  });

  it('só alteração: item novo ou removido segue outros caminhos', () => {
    const plan = planAfter((root) => {
      const container = findIn(root, (el) => el.name === 'FORMACAO-COMPLEMENTAR')!;
      container.children = container.children.filter(
        (c) => c.kind !== 'element' || getAttr(c, 'SEQUENCIA-FORMACAO') !== '4',
      );
    });
    expect(plan.ops.filter((o) => o.kind === 'formacao-complementar')).toEqual([]);
  });
});

describe('alteração em listas sem número: aplicar no Lattes simulado', () => {
  const premioIn = (lattes: LattesSimuladoNoTeste, i: number) => premios(lattes.state.root)[i]!;

  it('prêmio: abre as linhas, acha a única igual, envia e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => setAttr(premios(root)[1]!, 'NOME-DA-ENTIDADE-PROMOTORA', 'SBX'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({ status: 'conferido' });
    expect(getAttr(premioIn(lattes, 1), 'NOME-DA-ENTIDADE-PROMOTORA')).toBe('SBX');
    expect(getAttr(premioIn(lattes, 2), 'NOME-DA-ENTIDADE-PROMOTORA')).toBe('Sociedade Fictícia');
    const post = lattes.state.log.find((l) => l.method === 'POST')!;
    expect(post.proc).toBe('pkg_premio.form');
    expect(post.pairs).toContainEqual(['f_ctr', 'U']);
    expect(post.pairs).toContainEqual(['f_titulo', 'Menção honrosa']);
  });

  it('prêmio: desfaz pelo registro, achando a linha pelo valor novo', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) =>
      setAttr(premios(root)[0]!, 'NOME-DO-PREMIO-OU-TITULO', 'Prêmio Pesquisador'),
    );
    expect((await applyOp(op, lattes.port, GATES)).status).toBe('conferido');
    const undo = undoOp({ ...sentEntry(op, '1', 1000), id: 2 })!;
    expect(undo).toMatchObject({ kind: 'premio', set: { f_titulo: 'Prêmio Jovem Pesquisador' } });
    expect((await applyOp(undo, lattes.port, GATES)).status).toBe('conferido');
    expect(getAttr(premioIn(lattes, 0), 'NOME-DO-PREMIO-OU-TITULO')).toBe(
      'Prêmio Jovem Pesquisador',
    );
  });

  it('prêmio: duas linhas iguais ou nenhuma, nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(premioIn(lattes, 2), 'ANO-DA-PREMIACAO', '2020');
    const op = onlyOp((root) => setAttr(premios(root)[1]!, 'NOME-DA-ENTIDADE-PROMOTORA', 'SBX'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'Mais de um item de prêmios e títulos igual no Lattes',
      status: 'erro',
    });
    setAttr(premioIn(lattes, 1), 'NOME-DA-ENTIDADE-PROMOTORA', 'Outra');
    setAttr(premioIn(lattes, 2), 'NOME-DA-ENTIDADE-PROMOTORA', 'Outra');
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'Item de prêmios e títulos não encontrado no Lattes',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('prêmio: acha a linha sem diferença de acento e caixa, e a conferência estrita para', async () => {
    const lattes = await lattesFor();
    setAttr(premioIn(lattes, 0), 'NOME-DO-PREMIO-OU-TITULO', 'PREMIO JOVEM PESQUISADOR');
    const op = onlyOp((root) =>
      setAttr(premios(root)[0]!, 'NOME-DO-PREMIO-OU-TITULO', 'Prêmio Pesquisador'),
    );
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Nome do prêmio ou título',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('fora do evento, o formulário vai mesmo quando o valor já é o do Lattes', async () => {
    const lattes = await lattesFor();
    const op: ListEditOp = {
      expect: { f_ano: '2018' },
      key: 'k',
      kind: 'premio',
      label: 'Prêmio',
      match: { f_agencia: 'Fundação Exemplo', f_titulo: 'Prêmio Jovem Pesquisador' },
      set: { f_ano: '2018' },
    };
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'Gravado e conferido no Lattes',
      status: 'conferido',
    });
    expect(postsOf(lattes)).toHaveLength(1);
  });

  it('prêmio: para no segundo item igual, sem ler o resto da lista', async () => {
    const lattes = await lattesFor();
    setAttr(premioIn(lattes, 0), 'NOME-DO-PREMIO-OU-TITULO', 'Menção honrosa');
    setAttr(premioIn(lattes, 0), 'NOME-DA-ENTIDADE-PROMOTORA', 'Sociedade Fictícia');
    setAttr(premioIn(lattes, 0), 'ANO-DA-PREMIACAO', '2020');
    const op = onlyOp((root) => setAttr(premios(root)[1]!, 'NOME-DA-ENTIDADE-PROMOTORA', 'SBX'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'Mais de um item de prêmios e títulos igual no Lattes',
      status: 'erro',
    });
    const forms = lattes.state.log.filter(
      (l) => l.method === 'GET' && /^pkg_premio\.form$/i.test(l.proc),
    );
    expect(forms).toHaveLength(2);
  });

  it('prêmio: um envio que inclui em vez de alterar é acusado', async () => {
    // O Lattes simulado, depois do POST, ganha uma linha: como se o envio
    // tivesse sido lido como inclusão.
    const lattes = await lattesFor({
      intercept: faults.afterPost((_req, state) => {
        const container = findIn(state.root, (el) => el.name === 'PREMIOS-TITULOS')!;
        const copy = parseXml(
          '<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Cópia" NOME-DA-ENTIDADE-PROMOTORA="X" ANO-DA-PREMIACAO="2018"/>',
        ).root;
        container.children.push(copy);
      }),
    });
    const op = onlyOp((root) => setAttr(premios(root)[0]!, 'ANO-DA-PREMIACAO', '2019'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail:
        'O Lattes incluiu uma linha nova em vez de alterar (3 antes, 4 depois): confira a lista no Lattes e exclua a cópia',
      status: 'divergente',
    });
  });

  it('prêmio: o ano vai com quatro dígitos', () => {
    expect(onlyReason((root) => setAttr(premios(root)[0]!, 'ANO-DA-PREMIACAO', '19'))).toMatch(
      /com quatro dígitos$/,
    );
  });

  it('a extensão com a chave desligada não grava prêmio nem formação complementar; ligada, grava', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => setAttr(premios(root)[0]!, 'ANO-DA-PREMIACAO', '2019'));
    expect(
      await applyOp(op, lattes.port, {
        editEvento: true,
        lists: new Set(['formacao-complementar']),
      }),
    ).toMatchObject({
      detail: 'Esta extensão não tem o formulário deste tipo no contrato; a alteração fica à mão',
      status: 'erro',
    });
    // A montagem de nenhuma das duas, forçada: também para sem ler.
    expect((await applyOp(op, lattes.port, { editEvento: true, lists: new Set() })).status).toBe(
      'erro',
    );
    expect(lattes.state.log.filter((l) => l.method === 'GET' && /premio/i.test(l.proc))).toEqual(
      [],
    );
    // Sem as opções, vale a montagem desta versão, com as duas ligadas: grava.
    expect((await applyOp(op, lattes.port)).status).toBe('conferido');
  });

  it('sem a lista no menu, para antes de ler', async () => {
    const lattes = await lattesFor();
    const port = { ...lattes.port, menuHtml: () => '<a href="pkg_idioma.lista?f_cod=x">x</a>' };
    const op = onlyOp((root) => setAttr(premios(root)[0]!, 'ANO-DA-PREMIACAO', '2019'));
    expect(await applyOp(op, port, GATES)).toMatchObject({
      detail: 'Lista de prêmios e títulos não encontrada no menu do Lattes',
      status: 'erro',
    });
  });

  it('formação complementar: envia com o f_ctr vazio que a página traz e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      setAttr(compl(root, '5'), 'CARGA-HORARIA', '60');
      setAttr(compl(root, '5'), 'STATUS-DO-CURSO', 'CONCLUIDO');
    });
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({ status: 'conferido' });
    const el = compl(lattes.state.root, '5');
    expect(getAttr(el, 'CARGA-HORARIA')).toBe('60');
    expect(getAttr(el, 'STATUS-DO-CURSO')).toBe('CONCLUIDO');
    expect(getAttr(el, 'NOME-CURSO')).toBe('Oficina de Exemplo');
    const post = lattes.state.log.find((l) => l.method === 'POST')!;
    expect(post.proc).toBe('PKG_FORMACAO_COMPL.FORM2');
    expect(post.pairs).toContainEqual(['f_ctr', '']);
  });

  it('formação complementar: desfaz pelo registro', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      setAttr(compl(root, '5'), 'CARGA-HORARIA', '60');
      setAttr(compl(root, '5'), 'STATUS-DO-CURSO', 'CONCLUIDO');
    });
    expect((await applyOp(op, lattes.port, GATES)).status).toBe('conferido');
    const undo = undoOp({ ...sentEntry(op, '1', 1000), id: 5 })!;
    expect(undo).toMatchObject({ set: { f_carga: '40', F_STATUS: 'N' } });
    expect((await applyOp(undo, lattes.port, GATES)).status).toBe('conferido');
    const el = compl(lattes.state.root, '5');
    expect(getAttr(el, 'CARGA-HORARIA')).toBe('40');
    expect(getAttr(el, 'STATUS-DO-CURSO')).toBe('EM_ANDAMENTO');
  });

  it('formação complementar: instituição ou curso que mudam junto são acusados', async () => {
    const lattes = await lattesFor({
      intercept: faults.afterPost((_req, state) =>
        setAttr(
          findIn(state.root, (el) => getAttr(el, 'SEQUENCIA-FORMACAO') === '5')!,
          'NOME-INSTITUICAO',
          'Outra escola',
        ),
      ),
    });
    const op = onlyOp((root) => setAttr(compl(root, '5'), 'CARGA-HORARIA', '60'));
    const r = await applyOp(op, lattes.port, GATES);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/^Outros campos mudaram no Lattes: .*Instituição/);
  });

  it('formação complementar: outro nível no Lattes, nada é enviado', async () => {
    const lattes = await lattesFor();
    const el = compl(lattes.state.root, '5');
    el.attrs = el.attrs.map((a) => (a.name === 'NIVEL' ? { ...a, value: 'F' } : a));
    const op = onlyOp((root) => setAttr(compl(root, '5'), 'CARGA-HORARIA', '60'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      // Nenhuma linha com o antes; achada pelo curso e pela instituição, a
      // conferência estrita acusa o nível.
      detail: 'O Lattes não está como o editor espera: Nível',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('formação complementar: formulário em outro modo não é enviado', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^PKG_FORMACAO_COMPL\.form$/i, (html) =>
        html.replace('name="f_ctr" value=""', 'name="f_ctr" value="I"'),
      ),
    });
    const op = onlyOp((root) => setAttr(compl(root, '4'), 'CARGA-HORARIA', '30'));
    expect((await applyOp(op, lattes.port, GATES)).detail).toBe(
      'O formulário não está em modo de alteração',
    );
    expect(postsOf(lattes)).toEqual([]);
  });

  it('contrato: confere um exemplar de cada formulário, só lendo', async () => {
    const lattes = await lattesFor();
    const extra = listEditContract(new Set(['premio', 'formacao-complementar']));
    const contract: Contract = {
      forms: { ...LATTES_CONTRACT.forms, ...extra.forms },
      menu: [...LATTES_CONTRACT.menu, ...extra.menu],
    };
    const report = await checkContract(lattes.port, contract);
    expect(report.forms.find((f) => f.kind === 'premio')).toMatchObject({
      drifts: [],
      status: 'ok',
    });
    expect(report.forms.find((f) => f.kind === 'formacao-complementar')).toMatchObject({
      drifts: [],
      status: 'ok',
    });
    expect(postsOf(lattes)).toEqual([]);
    const container = findIn(lattes.state.root, (el) => el.name === 'PREMIOS-TITULOS')!;
    container.children = [];
    const vazio = await checkContract(lattes.port, contract);
    expect(vazio.forms.find((f) => f.kind === 'premio')).toMatchObject({
      detail: 'O currículo não tem prêmios e títulos',
      status: 'sem-amostra',
    });
    const semLista = await checkContract(
      { ...lattes.port, menuHtml: () => '<a href="pkg_idioma.lista?f_cod=x">x</a>' },
      contract,
    );
    expect(semLista.forms.find((f) => f.kind === 'premio')).toMatchObject({
      status: 'nao-encontrado',
    });
  });
});
