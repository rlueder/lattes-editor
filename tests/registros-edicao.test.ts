// Alterar patentes e registros pelo motor de produção
// (src/bridge/production/targets/registros.ts), contra o Lattes simulado, que
// tem as grades de depositantes e a de datas da patente como a edição real as
// trouxe em 19/10/2026 (scripts/lattes-simulado/registro-grades.ts).

import { afterEach, describe, expect, it } from 'vitest';

import {
  addHolder,
  seedHolder,
  storedHolders,
} from '../scripts/lattes-simulado/registro-grades.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { yearFromDate } from '../src/bridge/production/targets/registros-paginas.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { applyLinkedAttrs } from '../src/model/linked-attrs.ts';
import {
  childElements,
  element,
  getAttr,
  parseXml,
  setAttr,
  type XElement,
} from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const AUTHOR = `<AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-TECNICA>
<PATENTE SEQUENCIA-PRODUCAO="7"><DADOS-BASICOS-DA-PATENTE TITULO="Uma patente" ANO-DESENVOLVIMENTO="2005" PAIS="Brasil"/><DETALHAMENTO-DA-PATENTE FINALIDADE="antes"><REGISTRO-OU-PATENTE TIPO-PATENTE="PRIVILEGIO_DE_INOVACAO_PI" CODIGO-DO-REGISTRO-OU-PATENTE="BR1" DATA-PEDIDO-DE-DEPOSITO="10032005" INSTITUICAO-DEPOSITO-REGISTRO="INPI"/></DETALHAMENTO-DA-PATENTE>${AUTHOR}</PATENTE>
<DESENHO-INDUSTRIAL SEQUENCIA-PRODUCAO="8"><DADOS-BASICOS-DO-DESENHO-INDUSTRIAL TITULO="Um desenho" ANO-DESENVOLVIMENTO="2005" PAIS="Brasil"/><DETALHAMENTO-DO-DESENHO-INDUSTRIAL FINALIDADE="antes" INSTITUICAO-FINANCIADORA="x"><REGISTRO-OU-PATENTE TIPO-PATENTE="DESENHO_INDUSTRIAL_DI" CODIGO-DO-REGISTRO-OU-PATENTE="DI1" DATA-PEDIDO-DE-DEPOSITO="10012005" INSTITUICAO-DEPOSITO-REGISTRO="INPI"/></DETALHAMENTO-DO-DESENHO-INDUSTRIAL>${AUTHOR}</DESENHO-INDUSTRIAL>
<MARCA SEQUENCIA-PRODUCAO="9"><DADOS-BASICOS-DA-MARCA TITULO="Uma marca" ANO-DESENVOLVIMENTO="2005" PAIS="Brasil"/><DETALHAMENTO-DA-MARCA NATUREZA="Figurativa"><REGISTRO-OU-PATENTE TIPO-PATENTE="MARCA_REGISTRADA_DE_PRODUTO_MPD" CODIGO-DO-REGISTRO-OU-PATENTE="MR1" INSTITUICAO-DEPOSITO-REGISTRO="INPI"/></DETALHAMENTO-DA-MARCA>${AUTHOR}</MARCA>
</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

/**
 * Uma patente como a exportação da patente de teste de 20/10/2026 a trouxe
 * (com nomes sintéticos): o depositante em NOME-DO-DEPOSITANTE e copiado nos
 * AUTORES, com a ordem contada à parte, e a data de depósito também no
 * histórico de situações.
 */
const HOLDER_XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-TECNICA>
<PATENTE SEQUENCIA-PRODUCAO="40"><DADOS-BASICOS-DA-PATENTE TITULO="Patente com depositante" ANO-DESENVOLVIMENTO="2007" PAIS="Brasil"/><DETALHAMENTO-DA-PATENTE CATEGORIA="Produto e Processo"><REGISTRO-OU-PATENTE TIPO-PATENTE="PRIVILEGIO_DE_INOVACAO_PI" CODIGO-DO-REGISTRO-OU-PATENTE="BR40" DATA-PEDIDO-DE-DEPOSITO="12032007" DATA-DE-PEDIDO-DE-EXAME="" DATA-DE-CONCESSAO="" INSTITUICAO-DEPOSITO-REGISTRO="INPI" NOME-DO-TITULAR="" NOME-DO-DEPOSITANTE="Depositante Sintético"/><HISTORICO-SITUACOES-PATENTE DESCRICAO-SITUACAO-PATENTE="Depósito" DATA-SITUACAO-PATENTE="12032007" STATUS-SITUACAO-PATENTE="SIM"/></DETALHAMENTO-DA-PATENTE><AUTORES NOME-COMPLETO-DO-AUTOR="Depositante Sintético" NOME-PARA-CITACAO="SINTÉTICO, D." ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ=""/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ="1"/></PATENTE>
</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function planAfter(edit: (root: XElement) => void, xml = XML) {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    { editProduction: true },
  );
}

function opsAfter(edit: (root: XElement) => void, xml = XML): ProductionOp[] {
  const plan = planAfter(edit, xml);
  expect(plan.unsupported).toEqual([]);
  return plan.ops as ProductionOp[];
}

const reasonsAfter = (edit: (root: XElement) => void, xml = XML) =>
  planAfter(edit, xml).unsupported.map((u) => u.reason);

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattes(xml = XML, options: Parameters<typeof withLattesSimulado>[0] = {}) {
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xml}`),
    ...options,
  });
  return open;
}

describe('patente', () => {
  it('título, finalidade e data de depósito vão, e o depositante fica', async () => {
    const sim = await lattes();
    seedHolder(byName(sim.state.root, 'PATENTE'), 'Depositante Sintético', 'SINTÉTICO, D.', '14');
    const ops = opsAfter((root) => {
      setAttr(byName(root, 'DADOS-BASICOS-DA-PATENTE'), 'TITULO', 'Outra patente');
      setAttr(byName(root, 'DETALHAMENTO-DA-PATENTE'), 'FINALIDADE', 'depois');
      setAttr(
        findIn(byName(root, 'PATENTE'), (e) => e.name === 'REGISTRO-OU-PATENTE')!,
        'DATA-PEDIDO-DE-DEPOSITO',
        '11032006',
      );
    });
    for (const op of ops)
      expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    const patent = byName(sim.state.root, 'PATENTE');
    expect(getAttr(byName(patent, 'DADOS-BASICOS-DA-PATENTE'), 'TITULO')).toBe('Outra patente');
    expect(getAttr(byName(patent, 'REGISTRO-OU-PATENTE'), 'DATA-PEDIDO-DE-DEPOSITO')).toBe(
      '11032006',
    );
    expect(storedHolders(patent)).toEqual(['Depositante Sintético']);
    const post = postsOf(sim).at(-1)!.fields;
    expect(post.f_depositante_pessoa_l).toBe('Depositante Sintético|14|SINTÉTICO, D.|N');
    expect(post.f_dados_grid_datas).toMatch(/<id>1<\/id>\r?\n\t<contato>Depósito<\/contato>/);
  });

  it('o ano não vai: sai da data de depósito', () => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(byName(working, 'DADOS-BASICOS-DA-PATENTE'), 'ANO-DESENVOLVIMENTO', '2004');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true },
    );
    expect(plan.unsupported[0]?.reason).toMatch(/não tem campo para o ano/);
  });
});

const registry = (root: XElement) => byName(root, 'REGISTRO-OU-PATENTE');
const history = (root: XElement) => byName(root, 'HISTORICO-SITUACOES-PATENTE');
const depositor = (name: string) => (root: XElement) =>
  setAttr(registry(root), 'NOME-DO-DEPOSITANTE', name);

describe('patente: o depositante pessoa', () => {
  it('troca pelo da lista de coautores do menu, e a releitura confere', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter(depositor('Coautora de Exemplo'), HOLDER_XML);
    expect(ops[0]).toMatchObject({
      expect: { f_depositante_pessoa_l: 'Depositante Sintético' },
      holders: { after: 'Coautora de Exemplo', before: 'Depositante Sintético' },
    });
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    const post = postsOf(sim).at(-1)!.fields;
    expect(post.f_depositante_pessoa_l).toBe('Coautora de Exemplo|3|EXEMPLO, C.|N');
    // O depositante não foi como autor.
    expect(post.f_autores_l).not.toMatch(/Depositante|Coautora/);
    const patent = byName(sim.state.root, 'PATENTE');
    expect(storedHolders(patent)).toEqual(['Coautora de Exemplo']);
    expect(getAttr(registry(patent), 'NOME-DO-DEPOSITANTE')).toBe('Coautora de Exemplo');
  });

  it('vazio tira o depositante da grade', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter(depositor(''), HOLDER_XML);
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim).at(-1)!.fields.f_depositante_pessoa_l).toBe('');
    expect(storedHolders(byName(sim.state.root, 'PATENTE'))).toEqual([]);
  });

  it('nome fora da lista do menu: o motivo, e nada vai', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter(depositor('Pessoa Fora da Lista'), HOLDER_XML);
    const r = await applyOp(ops[0]!, sim.port);
    expect(r.status).toBe('erro');
    expect(r.detail).toMatch(/não está na lista de coautores do Lattes: Pessoa Fora da Lista/);
    expect(postsOf(sim)).toEqual([]);
  });

  it('o Lattes com outro depositante: divergente, e nada vai', async () => {
    const sim = await lattes(HOLDER_XML);
    seedHolder(byName(sim.state.root, 'PATENTE'), 'Outra Pessoa', 'PESSOA, O.', '9');
    const ops = opsAfter(depositor('Coautora de Exemplo'), HOLDER_XML);
    const r = await applyOp(ops[0]!, sim.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/Nome do depositante/);
    expect(postsOf(sim)).toEqual([]);
  });

  it('a vírgula não quer dizer mais de um: "SOBRENOME, Nome" é uma pessoa', () => {
    const ops = opsAfter(depositor('SINTÉTICO, Depositante'), HOLDER_XML);
    expect(ops[0]!.holders).toEqual({
      after: 'SINTÉTICO, Depositante',
      before: 'Depositante Sintético',
    });
  });

  it('mais de um depositante fica à mão', async () => {
    expect(reasonsAfter(depositor('Uma Pessoa; Outra Pessoa'), HOLDER_XML)).toEqual([
      expect.stringMatching(/Mais de um depositante vai à mão/),
    ]);
    const sim = await lattes(HOLDER_XML);
    addHolder(byName(sim.state.root, 'PATENTE'), 'Outra Pessoa', 'PESSOA, O.', '9');
    const ops = opsAfter(depositor('Coautora de Exemplo'), HOLDER_XML);
    const r = await applyOp(ops[0]!, sim.port);
    expect(r.status).toBe('erro');
    expect(r.detail).toMatch(/Mais de um depositante/);
    expect(postsOf(sim)).toEqual([]);
  });

  it('o titular instituição fica à mão, pela busca de instituições', () => {
    expect(
      reasonsAfter((root) => setAttr(registry(root), 'NOME-DO-TITULAR', 'Instituição'), HOLDER_XML),
    ).toEqual([expect.stringMatching(/busca de instituições do Lattes/)]);
  });

  it('um autor novo não leva o depositante copiado nos autores', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter((root) => {
      const patent = byName(root, 'PATENTE');
      patent.children.push(
        element('AUTORES', {
          'NOME-COMPLETO-DO-AUTOR': 'Coautora de Exemplo',
          'NOME-PARA-CITACAO': 'EXEMPLO, C.',
          'ORDEM-DE-AUTORIA': '2',
        }),
      );
    }, HOLDER_XML);
    expect(ops[0]!.authors?.before.map((a) => a.name)).toEqual(['Pessoa Sintética']);
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    const post = postsOf(sim).at(-1)!.fields;
    expect(post.f_autores_l).not.toMatch(/Depositante/);
    expect(post.f_depositante_pessoa_l).toBe('Depositante Sintético|0|SINTÉTICO, D.|N');
    // O simulado exporta como o Lattes: o depositante de novo nos autores.
    const names = childElements(byName(sim.state.root, 'PATENTE'), 'AUTORES').map((a) =>
      getAttr(a, 'NOME-COMPLETO-DO-AUTOR'),
    );
    expect(names).toEqual(['Depositante Sintético', 'Pessoa Sintética', 'Coautora de Exemplo']);
  });

  it('a linha de autor que é o depositante fica à mão', () => {
    const copy = (root: XElement) =>
      childElements(byName(root, 'PATENTE'), 'AUTORES').find(
        (a) => getAttr(a, 'NOME-COMPLETO-DO-AUTOR') === 'Depositante Sintético',
      )!;
    expect(
      reasonsAfter(
        (root) => setAttr(copy(root), 'NOME-COMPLETO-DO-AUTOR', 'Outro Nome'),
        HOLDER_XML,
      ),
    ).toEqual([expect.stringMatching(/Esta linha de autor tem o nome do depositante/)]);
  });

  it('um autor de verdade com o nome do depositante: a mudança de autores fica à mão', () => {
    // Quem inventa e também deposita: duas linhas com o nome, um depositante.
    const xml = HOLDER_XML.replace(
      '</PATENTE>',
      '<AUTORES NOME-COMPLETO-DO-AUTOR="Depositante Sintético" NOME-PARA-CITACAO="SINTÉTICO, D." ORDEM-DE-AUTORIA="2" NRO-ID-CNPQ=""/></PATENTE>',
    );
    const reasons = reasonsAfter((root) => {
      byName(root, 'PATENTE').children.push(
        element('AUTORES', {
          'NOME-COMPLETO-DO-AUTOR': 'Coautora de Exemplo',
          'NOME-PARA-CITACAO': 'EXEMPLO, C.',
          'ORDEM-DE-AUTORIA': '3',
        }),
      );
    }, xml);
    expect(reasons).toEqual([
      expect.stringMatching(/mais autores com o nome do depositante do que depositantes/),
    ]);
  });

  it('o depositante novo, ainda não exportado, não tira um autor com o nome dele', () => {
    // A Coautora é autora de verdade; com a troca na fila, ela passa a
    // depositante, mas a exportação ainda não a copiou nos autores.
    const xml = HOLDER_XML.replace(
      '</PATENTE>',
      '<AUTORES NOME-COMPLETO-DO-AUTOR="Coautora de Exemplo" NOME-PARA-CITACAO="EXEMPLO, C." ORDEM-DE-AUTORIA="2" NRO-ID-CNPQ="3"/></PATENTE>',
    );
    const ops = opsAfter((root) => {
      depositor('Coautora de Exemplo')(root);
      const patent = byName(root, 'PATENTE');
      patent.children = patent.children.filter(
        (c) => c.kind !== 'element' || getAttr(c, 'NOME-COMPLETO-DO-AUTOR') !== 'Pessoa Sintética',
      );
    }, xml);
    const authors = ops.find((o) => o.authors)!.authors!;
    expect(authors.before.map((a) => a.name)).toEqual(['Pessoa Sintética', 'Coautora de Exemplo']);
    expect(authors.after.map((a) => a.name)).toEqual(['Coautora de Exemplo']);
  });
});

describe('patente: o histórico de situações', () => {
  /** A data de depósito no registro e na situação "Depósito", as duas iguais. */
  const bothDates = (date: string) => (root: XElement) => {
    setAttr(registry(root), 'DATA-PEDIDO-DE-DEPOSITO', date);
    setAttr(history(root), 'DATA-SITUACAO-PATENTE', date);
  };

  it('a data de uma situação conhecida vai pela grade de situações, uma vez só', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter(bothDates('13032007'), HOLDER_XML);
    // Duas mudanças (o registro e o histórico) para o mesmo campo datas:1.
    expect(ops).toHaveLength(2);
    for (const op of ops) {
      expect(op).toMatchObject({
        expect: { 'datas:1': '12/03/2007' },
        set: { 'datas:1': '13/03/2007' },
      });
    }
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    // A segunda acha o Lattes já com a data nova e não envia nada.
    expect(await applyOp(ops[1]!, sim.port)).toEqual(
      expect.objectContaining({
        detail: 'O Lattes já estava assim; nada foi enviado',
        status: 'conferido',
      }),
    );
    expect(postsOf(sim)).toHaveLength(1);
    expect(postsOf(sim)[0]!.fields.f_dados_grid_datas).toMatch(
      /<contato>Depósito<\/contato>\r?\n\t<endereco>13\/03\/2007<\/endereco>/,
    );
    const patent = byName(sim.state.root, 'PATENTE');
    expect(getAttr(registry(patent), 'DATA-PEDIDO-DE-DEPOSITO')).toBe('13032007');
    expect(getAttr(history(patent), 'DATA-SITUACAO-PATENTE')).toBe('13032007');
  });

  it('o virtual já no valor novo não esconde outro antes que não bate', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter(bothDates('13032007'), HOLDER_XML);
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    // A segunda, com um antes que a página não tem (o depositante): a data já
    // está como o editor quer, mas o antes divergente vem primeiro.
    const r = await applyOp({ ...ops[1]!, holders: { after: 'Outra', before: 'Outra' } }, sim.port);
    expect(r.status).toBe('divergente');
    expect(postsOf(sim)).toHaveLength(1);
  });

  it('com a data do registro e mais outro campo, a mudança do registro também confere depois', async () => {
    const sim = await lattes(HOLDER_XML);
    const ops = opsAfter((root) => {
      bothDates('13032007')(root);
      setAttr(registry(root), 'CODIGO-DO-REGISTRO-OU-PATENTE', 'BR41');
    }, HOLDER_XML);
    const historyOp = ops.find((o) => !('f_cod_reg' in o.set))!;
    const registryOp = ops.find((o) => 'f_cod_reg' in o.set)!;
    // O histórico primeiro: o registro acha a data já nova e manda o número.
    expect(await applyOp(historyOp, sim.port)).toMatchObject({ status: 'conferido' });
    expect(await applyOp(registryOp, sim.port)).toMatchObject({ status: 'conferido' });
    const reg = registry(byName(sim.state.root, 'PATENTE'));
    expect(getAttr(reg, 'CODIGO-DO-REGISTRO-OU-PATENTE')).toBe('BR41');
    expect(getAttr(reg, 'DATA-PEDIDO-DE-DEPOSITO')).toBe('13032007');
  });

  it('a data do registro e a do histórico diferentes ficam à mão', () => {
    const same = /são o mesmo campo no Lattes; deixe as duas iguais no editor/;
    // Só o histórico muda: o registro fica com a data de antes.
    expect(
      reasonsAfter(
        (root) => setAttr(history(root), 'DATA-SITUACAO-PATENTE', '13032007'),
        HOLDER_XML,
      ),
    ).toEqual([expect.stringMatching(same)]);
    // Só o registro muda: o histórico fica com a data de antes.
    expect(
      reasonsAfter(
        (root) => setAttr(registry(root), 'DATA-PEDIDO-DE-DEPOSITO', '13032007'),
        HOLDER_XML,
      ),
    ).toEqual([expect.stringMatching(same)]);
    // Os dois mudam, cada um para uma data.
    expect(
      reasonsAfter((root) => {
        setAttr(registry(root), 'DATA-PEDIDO-DE-DEPOSITO', '13032007');
        setAttr(history(root), 'DATA-SITUACAO-PATENTE', '14032007');
      }, HOLDER_XML),
    ).toEqual([expect.stringMatching(same), expect.stringMatching(same)]);
  });

  /** A troca como o editor a grava: o atributo e o que segue dele (linked-attrs.ts). */
  const edit =
    (pick: (root: XElement) => XElement, attr: string, value: string) => (root: XElement) => {
      const el = pick(root);
      const previous = getAttr(el, attr);
      setAttr(el, attr, value);
      return applyLinkedAttrs(el, attr, root, previous);
    };

  it('o editor leva a data do registro à situação do histórico, e ela vai', async () => {
    let linked: string[] = [];
    const ops = opsAfter((root) => {
      linked = edit(registry, 'DATA-PEDIDO-DE-DEPOSITO', '13032007')(root);
    }, HOLDER_XML);
    expect(linked).toEqual(['HISTORICO-SITUACOES-PATENTE@DATA-SITUACAO-PATENTE']);
    expect(ops.map((o) => o.set)).toEqual([
      { 'datas:1': '13/03/2007' },
      { 'datas:1': '13/03/2007' },
    ]);
    const sim = await lattes(HOLDER_XML);
    for (const op of ops)
      expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim)).toHaveLength(1);
    expect(getAttr(history(byName(sim.state.root, 'PATENTE')), 'DATA-SITUACAO-PATENTE')).toBe(
      '13032007',
    );
  });

  it('e a data da situação ao registro', () => {
    let linked: string[] = [];
    const ops = opsAfter((root) => {
      linked = edit(history, 'DATA-SITUACAO-PATENTE', '13032007')(root);
    }, HOLDER_XML);
    expect(linked).toEqual(['REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO']);
    expect(ops).toHaveLength(2);
  });

  it('sem a linha do histórico, só o registro muda, e a data vai', async () => {
    // XML não tem histórico: a linha não se cria.
    let linked: string[] = ['x'];
    const ops = opsAfter((root) => {
      linked = edit(registry, 'DATA-PEDIDO-DE-DEPOSITO', '11032006')(root);
    });
    expect(linked).toEqual([]);
    expect(ops).toHaveLength(1);
    const sim = await lattes();
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(registry(byName(sim.state.root, 'PATENTE')), 'DATA-PEDIDO-DE-DEPOSITO')).toBe(
      '11032006',
    );
  });

  it('a situação desconhecida e a data sem par no histórico não se ligam', () => {
    const root = parseXml(
      HOLDER_XML.replace(
        'DESCRICAO-SITUACAO-PATENTE="Depósito"',
        'DESCRICAO-SITUACAO-PATENTE="Expiração"',
      ),
    ).root;
    expect(edit(history, 'DATA-SITUACAO-PATENTE', '13032007')(root)).toEqual([]);
    expect(edit(registry, 'DATA-DE-CONCESSAO', '01012010')(root)).toEqual([]);
    expect(getAttr(registry(root), 'DATA-PEDIDO-DE-DEPOSITO')).toBe('12032007');
    // Sem a raiz, nada fora do elemento muda.
    const other = parseXml(HOLDER_XML).root;
    setAttr(registry(other), 'DATA-PEDIDO-DE-DEPOSITO', '13032007');
    expect(applyLinkedAttrs(registry(other), 'DATA-PEDIDO-DE-DEPOSITO')).toEqual([]);
    expect(getAttr(history(other), 'DATA-SITUACAO-PATENTE')).toBe('12032007');
  });

  it('a descrição sem acento nem caixa ainda acha a data', () => {
    const xml = HOLDER_XML.replace(
      'DESCRICAO-SITUACAO-PATENTE="Depósito"',
      'DESCRICAO-SITUACAO-PATENTE="DEPOSITO"',
    );
    const ops = opsAfter(bothDates('13032007'), xml);
    expect(ops.map((o) => o.set)).toEqual([
      { 'datas:1': '13/03/2007' },
      { 'datas:1': '13/03/2007' },
    ]);
  });

  it('a situação trocada no editor leva a data do registro junto, e a linha muda na grade', async () => {
    let linked: string[] = [];
    const ops = opsAfter((root) => {
      linked = edit(history, 'DESCRICAO-SITUACAO-PATENTE', 'Concessão')(root);
    }, HOLDER_XML);
    expect(linked.sort()).toEqual([
      'REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO',
      'REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO',
    ]);
    for (const op of ops) {
      expect(op).toMatchObject({
        expect: { 'datas:1': '12/03/2007', 'datas:3': '' },
        set: { 'datas:1': '', 'datas:3': '12/03/2007' },
      });
    }
    const sim = await lattes(HOLDER_XML);
    for (const op of ops)
      expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim)).toHaveLength(1);
    const grid = postsOf(sim)[0]!.fields.f_dados_grid_datas!;
    expect(grid).toMatch(/<contato>Concessão<\/contato>\r?\n\t<endereco>12\/03\/2007<\/endereco>/);
    expect(grid).not.toMatch(/<contato>Depósito<\/contato>/);
  });

  it('a linha que a página não deixa excluir: o envio para, sem POST', async () => {
    const ops = opsAfter((root) => {
      edit(history, 'DESCRICAO-SITUACAO-PATENTE', 'Concessão')(root);
    }, HOLDER_XML);
    const sim = await lattes(HOLDER_XML, {
      intercept: async (req, _state, next) => {
        const out = await next();
        return /patente_registro\.form/i.test(req.proc) && req.method === 'GET' && 'html' in out
          ? { ...out, html: out.html.replace('"deletable":"true"', '"deletable":"false"') }
          : out;
      },
    });
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({
      detail: expect.stringMatching(/"Depósito" da patente não pode ser excluída no Lattes/),
      status: 'erro',
    });
    expect(postsOf(sim)).toEqual([]);
  });

  it('a situação trocada sem o registro acompanhar, repetida ou sem data no registro fica à mão', () => {
    // Sem o editor (linked-attrs), o registro ainda tem a data no depósito.
    expect(
      reasonsAfter(
        (root) => setAttr(history(root), 'DESCRICAO-SITUACAO-PATENTE', 'Concessão'),
        HOLDER_XML,
      ),
    ).toEqual([expect.stringMatching(/são o mesmo campo no Lattes/)]);
    expect(
      reasonsAfter(
        (root) => setAttr(history(root), 'DESCRICAO-SITUACAO-PATENTE', 'Licenciamento'),
        HOLDER_XML,
      ),
    ).toEqual([expect.stringMatching(/o conector só troca entre Concessão/)]);
    expect(
      reasonsAfter(
        (root) => setAttr(history(root), 'DESCRICAO-SITUACAO-PATENTE', 'DEPOSITO'),
        HOLDER_XML,
      ),
    ).toEqual([expect.stringMatching(/são a mesma situação no Lattes/)]);
    const two = HOLDER_XML.replace(
      '</DETALHAMENTO-DA-PATENTE>',
      '<HISTORICO-SITUACOES-PATENTE DESCRICAO-SITUACAO-PATENTE="Concessão" DATA-SITUACAO-PATENTE="01012010" STATUS-SITUACAO-PATENTE="SIM"/></DETALHAMENTO-DA-PATENTE>',
    );
    expect(
      reasonsAfter(
        (root) => setAttr(history(root), 'DESCRICAO-SITUACAO-PATENTE', 'Concessão'),
        two,
      ),
    ).toEqual([expect.stringMatching(/já está em outra linha do histórico/)]);
  });

  it('status, situação desconhecida, inclusão e exclusão ficam à mão', () => {
    expect(
      reasonsAfter((root) => setAttr(history(root), 'STATUS-SITUACAO-PATENTE', 'NAO'), HOLDER_XML),
    ).toEqual([expect.stringMatching(/^O formulário de patente do Lattes não tem: /)]);
    const unknown = HOLDER_XML.replace(
      'DESCRICAO-SITUACAO-PATENTE="Depósito"',
      'DESCRICAO-SITUACAO-PATENTE="Expiração"',
    );
    expect(
      reasonsAfter((root) => setAttr(history(root), 'DATA-SITUACAO-PATENTE', '13032007'), unknown),
    ).toEqual([expect.stringMatching(/"Expiração" vai à mão: o conector só troca as de/)]);
    expect(
      reasonsAfter((root) => {
        const detail = byName(root, 'DETALHAMENTO-DA-PATENTE');
        detail.children.push(
          element('HISTORICO-SITUACOES-PATENTE', {
            'DATA-SITUACAO-PATENTE': '01012010',
            'DESCRICAO-SITUACAO-PATENTE': 'Concessão',
            'STATUS-SITUACAO-PATENTE': 'SIM',
          }),
        );
      }, HOLDER_XML),
    ).toEqual([expect.stringMatching(/Incluir ou tirar uma situação/)]);
    expect(
      reasonsAfter((root) => {
        const detail = byName(root, 'DETALHAMENTO-DA-PATENTE');
        detail.children = detail.children.filter((c) => c !== history(root));
      }, HOLDER_XML),
    ).toEqual([expect.stringMatching(/Incluir ou tirar uma situação/)]);
  });
});

describe('registros', () => {
  it('desenho industrial: o envio leva o ano que a página tira da data', async () => {
    const sim = await lattes();
    const ops = opsAfter((root) =>
      setAttr(byName(root, 'DADOS-BASICOS-DO-DESENHO-INDUSTRIAL'), 'TITULO', 'Outro desenho'),
    );
    const r = await applyOp(ops[0]!, sim.port);
    expect(r.detail).toBe('Gravado e conferido no Lattes');
    expect(postsOf(sim).at(-1)!.fields.f_ano).toBe('2005');
  });

  it('marca: sem grade de depositantes na página, a natureza e o tipo vão', async () => {
    const sim = await lattes();
    const ops = opsAfter((root) => {
      setAttr(byName(root, 'DETALHAMENTO-DA-MARCA'), 'NATUREZA', 'Nominativa');
      setAttr(
        findIn(byName(root, 'MARCA'), (e) => e.name === 'REGISTRO-OU-PATENTE')!,
        'TIPO-PATENTE',
        'MARCA_REGISTRADA_DE_SERVICO_MSV',
      );
    });
    for (const op of ops)
      expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim).at(-1)!.fields).toMatchObject({ f_natureza: 'Nominativa', f_tipo: 'MSV' });
  });
});

describe('o ano que a página tira da data de depósito', () => {
  const page = (input: string) => `<script>\n  dc.f_ano.value = anoDep;\n</script>${input}`;

  it('acha a data em qualquer ordem de atributos', () => {
    expect(
      yearFromDate(page('<input value="11/03/2006" type="text" name="f_dta_dep">'), {}),
    ).toEqual({
      f_ano: '2006',
    });
    expect(yearFromDate(page('<input name="f_dta_dep" value="11/03/2006">'), {})).toEqual({
      f_ano: '2006',
    });
    expect(yearFromDate(page(''), { f_dta_dep: '01/02/2010' })).toEqual({ f_ano: '2010' });
  });

  it('sem a data, nada vai; e a página sem anoDep não pede o ano', () => {
    expect(yearFromDate(page('<input name="f_dta_dep" value="">'), {})).toBeUndefined();
    expect(yearFromDate('<input name="f_dta_dep" value="">', {})).toEqual({});
  });
});
