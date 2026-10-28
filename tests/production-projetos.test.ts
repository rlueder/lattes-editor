import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp, type LattesPort } from '../src/bridge/apply.ts';
import { atuacaoByHand, vinculoByHand } from '../src/bridge/atuacao-by-hand.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { type FunderEdit, funderValue } from '../src/bridge/production/financiador.ts';
import { sameAuthors, withLeads } from '../src/bridge/production/members.ts';
import { opaqueByHand, readOpaque } from '../src/bridge/production/opaque.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import { type Change, diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
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
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const MEMBERS = `<EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO NOME-COMPLETO="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-INTEGRACAO="1" FLAG-RESPONSAVEL="SIM" NRO-ID-CNPQ=""/><INTEGRANTES-DO-PROJETO NOME-COMPLETO="Colega de Exemplo" NOME-PARA-CITACAO="COLEGA, E." ORDEM-DE-INTEGRACAO="2" FLAG-RESPONSAVEL="NAO" NRO-ID-CNPQ="7"/></EQUIPE-DO-PROJETO>`;

// Um financiador e duas produções ligadas, como o projeto de teste do Lattes real (20/10/2026).
const LINKS = `<FINANCIADORES-DO-PROJETO><FINANCIADOR-DO-PROJETO SEQUENCIA-FINANCIADOR="1" CODIGO-INSTITUICAO="000100000001" NOME-INSTITUICAO="Agência" NATUREZA="AUXILIO_FINANCEIRO"/></FINANCIADORES-DO-PROJETO><PRODUCOES-CT-DO-PROJETO><PRODUCAO-CT-DO-PROJETO SEQUENCIA-PRODUCAO-CT="34" TITULO-DA-PRODUCAO-CT="Evento &amp; Oficina" TIPO-PRODUCAO-CT="Participações em eventos"/><PRODUCAO-CT-DO-PROJETO SEQUENCIA-PRODUCAO-CT="39" TITULO-DA-PRODUCAO-CT="Programa de Exemplo" TIPO-PRODUCAO-CT="Software"/></PRODUCOES-CT-DO-PROJETO>`;

const project = (seq: string, nature: string, name: string, extra = '') =>
  `<PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCAO-ATIVIDADE="${seq}" FLAG-PERIODO="ATUAL" MES-INICIO="3" ANO-INICIO="2020" MES-FIM="" ANO-FIM="" NOME-ORGAO="Instituto"><PROJETO-DE-PESQUISA SEQUENCIA-PROJETO="${seq}" ANO-INICIO="2020" ANO-FIM="" NOME-DO-PROJETO="${name}" SITUACAO="EM_ANDAMENTO" NATUREZA="${nature}" NUMERO-GRADUACAO="3" NUMERO-DOUTORADO="1" DESCRICAO-DO-PROJETO="Descrição" DESCRICAO-DO-PROJETO-INGLES="" NOME-DO-PROJETO-INGLES="" FLAG-POTENCIAL-INOVACAO="NAO" IDENTIFICADOR-PROJETO="">${MEMBERS}${extra}</PROJETO-DE-PESQUISA></PARTICIPACAO-EM-PROJETO>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética" NOME-EM-CITACOES-BIBLIOGRAFICAS="SINTÉTICA, P.">
<AREAS-DE-ATUACAO><AREA-DE-ATUACAO SEQUENCIA-AREA-DE-ATUACAO="1" NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_BIOLOGICAS" NOME-DA-AREA-DO-CONHECIMENTO="Genética" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE=""/></AREAS-DE-ATUACAO>
<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="001000000998" NOME-INSTITUICAO="Universidade de Exemplo" SEQUENCIA-ATIVIDADE="1" SEQUENCIA-IMPORTANCIA="1">
<VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="CELETISTA" ENQUADRAMENTO-FUNCIONAL="" MES-INICIO="01" ANO-INICIO="2011" MES-FIM="" ANO-FIM="" CARGA-HORARIA-SEMANAL="40" FLAG-DEDICACAO-EXCLUSIVA="NAO" FLAG-VINCULO-EMPREGATICIO="SIM"/>
<ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO><DIRECAO-E-ADMINISTRACAO SEQUENCIA-FUNCAO-ATIVIDADE="9" FLAG-PERIODO="ATUAL" MES-INICIO="1" ANO-INICIO="2015" CARGO-OU-FUNCAO="Coordenação"/></ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO>
<ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
${project('1', 'PESQUISA', 'Projeto de Exemplo')}
${project('2', 'EXTENSAO', 'Projeto de Extensão')}
${project('3', 'PESQUISA', 'Projeto Financiado', LINKS)}
</ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS></DADOS-GERAIS>
<PRODUCAO-TECNICA><SOFTWARE SEQUENCIA-PRODUCAO="39"/><TRABALHO-TECNICO SEQUENCIA-PRODUCAO="34"/><TRABALHO-TECNICO SEQUENCIA-PRODUCAO="40"/></PRODUCAO-TECNICA>
<OUTRA-PRODUCAO><ORIENTACOES-CONCLUIDAS><OUTRAS-ORIENTACOES-CONCLUIDAS SEQUENCIA-PRODUCAO="41"/></ORIENTACOES-CONCLUIDAS></OUTRA-PRODUCAO></CURRICULO-VITAE>`;

const ON: PlanOptions = { editFunders: true, editProduction: true };

const projectOf = (root: XElement, seq: string) =>
  findIn(
    root,
    (el) => el.name === 'PROJETO-DE-PESQUISA' && getAttr(el, 'SEQUENCIA-PROJETO') === seq,
  )!;

const membersOf = (root: XElement, seq: string) =>
  childElements(childElements(projectOf(root, seq), 'EQUIPE-DO-PROJETO')[0]!).map((m) => [
    getAttr(m, 'NOME-COMPLETO'),
    getAttr(m, 'FLAG-RESPONSAVEL'),
  ]);

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

function onlyOp(edit: (root: XElement) => void): ProductionOp {
  const plan = planAfter(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as ProductionOp;
}

const reasonOf = (edit: (root: XElement) => void) => {
  const plan = planAfter(edit);
  expect(plan.ops).toEqual([]);
  return plan.unsupported.map((u) => u.reason);
};

const setProject = (seq: string, attr: string, value: string) => (root: XElement) =>
  setAttr(projectOf(root, seq), attr, value);

const memberEl = (root: XElement, seq: string, order: string) =>
  childElements(childElements(projectOf(root, seq), 'EQUIPE-DO-PROJETO')[0]!).find(
    (m) => getAttr(m, 'ORDEM-DE-INTEGRACAO') === order,
  )!;

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

describe('projeto: a especificação contra o censo', () => {
  it('cada campo e oculto ligado está no formulário capturado de cada natureza', () => {
    const census = JSON.parse(
      readFileSync('docs/lattes-formularios/censo-2026-10-15.json', 'utf8'),
    ) as {
      entries: {
        id: string;
        page?: { forms?: { fields: { name: string }[]; hidden: string[]; name: string }[] };
      }[];
    };
    const t = PRODUCTION_TARGETS.find((x) => x.id === 'projeto')!;
    const used = [
      ...Object.values(t.fields).map((m) => (typeof m === 'string' ? m : m.field)),
      ...t.grids,
      ...(t.opaqueGrids ?? []).map((g) => g.field),
      t.year.field!,
    ];
    for (const id of ['projeto-P', 'projeto-D', 'projeto-E', 'projeto-N', 'projeto-O']) {
      const form = census.entries
        .find((e) => e.id === id)!
        .page!.forms!.find((f) => f.name === t.form.name)!;
      const names = new Set([...form.fields.map((f) => f.name), ...form.hidden]);
      // f_ref: só na tabela da seção 17 (comentário em projetos.ts).
      expect(used.filter((f) => !names.has(f))).toEqual(['f_ref']);
    }
  });
});

describe('projeto: plano', () => {
  it('um campo do projeto vira a operação, pela lista da natureza', () => {
    const op = onlyOp(setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(op).toMatchObject({
      expect: { f_titulo: 'Projeto de Exemplo' },
      kind: 'producao',
      listParams: { f_cod_tipo: 'P' },
      match: { title: 'Projeto de Exemplo', year: '2020' },
      set: { f_titulo: 'Projeto Revisto' },
      target: 'projeto',
    });
  });

  it('a natureza nova vai no formulário; a lista é a da natureza de antes', () => {
    const op = onlyOp(setProject('2', 'NATUREZA', 'ENSINO'));
    expect(op).toMatchObject({
      expect: { F_TPO_NATUREZA: 'E' },
      listParams: { f_cod_tipo: 'E' },
      set: { F_TPO_NATUREZA: 'N' },
    });
    expect(op.rows[0]).toMatchObject({ after: 'Ensino', before: 'Extensão' });
  });

  it('o que o formulário não tem fica à mão, com o motivo', () => {
    expect(reasonOf(setProject('1', 'IDENTIFICADOR-PROJETO', 'X1'))[0]).toMatch(
      /não tem: Identificador/,
    );
    expect(reasonOf(setProject('1', 'FLAG-POTENCIAL-INOVACAO', 'SIM'))[0]).toMatch(
      /escreva no editor qual é o potencial/,
    );
  });

  it('o Sim com o texto escrito no editor vai com f_sta_inovacao S e o texto', () => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(projectOf(working, '1'), 'FLAG-POTENCIAL-INOVACAO', 'SIM');
    const changes = diffDocuments(original, working);
    const extras = { [changes[0]!.key]: { f_txt_potencial: '  Um processo novo  ' } };
    const plan = planChanges(
      changes.map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { ...ON, extras },
    );
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops[0]).toMatchObject({
      expect: { f_sta_inovacao: 'N' },
      set: { f_sta_inovacao: 'S', f_txt_potencial: 'Um processo novo' },
    });
    const long = { [changes[0]!.key]: { f_txt_potencial: 'x'.repeat(401) } };
    const tooLong = planChanges(
      changes.map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { ...ON, extras: long },
    );
    expect(tooLong.unsupported[0]?.reason).toMatch(/passa de 400 caracteres/);
  });

  it('voltar o potencial de inovação para Não vai', () => {
    const plan = planChanges(
      diffDocuments(
        (() => {
          const r = parseXml(XML).root;
          setAttr(projectOf(r, '1'), 'FLAG-POTENCIAL-INOVACAO', 'SIM');
          return r;
        })(),
        parseXml(XML).root,
      ).map((change) => ({ change, itemTitle: '' })),
      parseXml(XML).root,
      ON,
    );
    expect(plan.ops[0]).toMatchObject({
      expect: { f_sta_inovacao: 'S' },
      set: { f_sta_inovacao: 'N' },
    });
  });

  it('projeto com financiador e produções ligadas vai', () => {
    expect(onlyOp(setProject('3', 'NOME-DO-PROJETO', 'Outro'))).toMatchObject({
      set: { f_titulo: 'Outro' },
    });
  });

  it('as ligações vão pela grade; a orientação pelo projeto antigo e o tirar tudo ficam à mão', () => {
    const prods = (root: XElement) =>
      childElements(projectOf(root, '3'), 'PRODUCOES-CT-DO-PROJETO')[0]!;
    const removeOne = (root: XElement) => {
      const c = prods(root);
      c.children = childElements(c).slice(1);
    };
    const removeAll = (root: XElement) => {
      const p = projectOf(root, '3');
      p.children = p.children.filter((c) => c !== prods(root));
    };
    const retitle = (root: XElement) =>
      setAttr(childElements(prods(root))[0]!, 'TITULO-DA-PRODUCAO-CT', 'Outro título');
    const addOrientacao = (root: XElement) =>
      projectOf(root, '3').children.push(
        element('ORIENTACOES', {}, [
          element('ORIENTACAO', { 'SEQUENCIA-ORIENTACAO': '7', 'TITULO-ORIENTACAO': 'Tese' }),
        ]),
      );
    // O título de uma produção ligada é do Lattes: fica só para ler, e não segura o resto.
    expect(reasonOf(retitle)[0]).toMatch(/^Dados que o próprio Lattes gera: o título/);
    expect(
      planAfter((root) => {
        retitle(root);
        setProject('3', 'NOME-DO-PROJETO', 'Outro')(root);
      }).ops,
    ).toHaveLength(1);
    // Tirar ou incluir uma ligação vai pela grade (project-links.ts), e não segura o resto.
    expect(planAfter(removeOne).ops[0]).toMatchObject({
      links: { producoes: { after: ['39'], before: ['39', '34'] } },
    });
    const addTwo = (root: XElement) =>
      prods(root).children.push(
        element('PRODUCAO-CT-DO-PROJETO', { 'SEQUENCIA-PRODUCAO-CT': '40' }),
        element('PRODUCAO-CT-DO-PROJETO', { 'SEQUENCIA-PRODUCAO-CT': '41' }),
      );
    // Duas na fila viram a mesma operação: produção e orientação, cada uma na sua grade.
    const both = planAfter(addTwo).ops;
    expect(both).toHaveLength(2);
    expect(both[0]).toMatchObject({
      links: {
        orientacoes: { after: ['41'], before: [] },
        producoes: { after: ['34', '39', '40'], before: ['34', '39'] },
      },
    });
    expect((both[1] as ProductionOp).links).toEqual((both[0] as ProductionOp).links);
    expect(
      planAfter((root) => {
        removeOne(root);
        setProject('3', 'NOME-DO-PROJETO', 'Outro')(root);
      }).ops,
    ).toHaveLength(2);
    expect(reasonOf(removeAll)[0]).toMatch(/tire uma de cada vez/);
    expect(
      reasonOf((root) => {
        prods(root).children.push(
          element('PRODUCAO-CT-DO-PROJETO', { 'SEQUENCIA-PRODUCAO-CT': '99' }),
        );
      })[0],
    ).toMatch(/item ligado 99 não está no currículo/);
    expect(reasonOf(addOrientacao)[0]).toMatch(
      /as orientações ligadas pela página voltam em Produções C&T/,
    );
    expect(
      reasonOf((root) => {
        addOrientacao(root);
        setProject('3', 'NOME-DO-PROJETO', 'Outro')(root);
      }),
    ).toContain(
      'O item tem mudança em orientações ligadas, que vai à mão, e o envio levaria de volta as do Lattes; alterar este item vai à mão junto',
    );
    // A mudança nas ligações de outro projeto não segura este.
    expect(
      planAfter((root) => {
        removeOne(root);
        setProject('1', 'NOME-DO-PROJETO', 'Outro')(root);
      }).ops,
    ).toHaveLength(2);
  });

  it('desligada, o projeto fica à mão', () => {
    const plan = planAfter(setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto'), {});
    expect(plan.ops).toEqual([]);
  });

  it('sem a natureza, não há lista onde achar o projeto', () => {
    const original = parseXml(XML).root;
    setAttr(projectOf(original, '1'), 'NATUREZA', '');
    const working = parseXml(XML).root;
    setAttr(projectOf(working, '1'), 'NATUREZA', '');
    setAttr(projectOf(working, '1'), 'NOME-DO-PROJETO', 'Outro');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
      working,
      ON,
    );
    expect(plan.unsupported[0]!.reason).toMatch(/em que lista/);
  });
});

describe('projeto: equipe no plano', () => {
  it('trocar um integrante por outro da lista de autores', () => {
    const op = onlyOp((root) =>
      setAttr(memberEl(root, '1', '2'), 'NOME-COMPLETO', 'Coautora de Exemplo'),
    );
    expect(op.authors).toMatchObject({
      after: [
        { lead: true, name: 'Pessoa Sintética' },
        { lead: false, name: 'Coautora de Exemplo' },
      ],
      before: [{ name: 'Pessoa Sintética' }, { name: 'Colega de Exemplo' }],
    });
    expect(op.rows[0]).toMatchObject({
      after: 'Pessoa Sintética (coordenador); Coautora de Exemplo',
      label: 'Equipe',
    });
  });

  it('citação, coordenador a mais ou a menos, e a equipe sem você ficam à mão', () => {
    expect(
      reasonOf((root) => setAttr(memberEl(root, '1', '2'), 'NOME-PARA-CITACAO', 'X, Y.'))[0],
    ).toMatch(/citação e o ID CNPq/);
    expect(
      reasonOf((root) => setAttr(memberEl(root, '1', '2'), 'FLAG-RESPONSAVEL', 'SIM'))[0],
    ).toMatch(/um coordenador na equipe, e só um/);
    expect(
      reasonOf((root) => {
        const equipe = childElements(projectOf(root, '1'), 'EQUIPE-DO-PROJETO')[0]!;
        equipe.children = equipe.children.filter(
          (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-DE-INTEGRACAO') === '1'),
        );
        setAttr(memberEl(root, '1', '2'), 'FLAG-RESPONSAVEL', 'SIM');
      }),
    ).toContain('O Lattes exige você na equipe');
  });

  it('trocar o coordenador: duas mudanças, a mesma equipe de antes e de depois', () => {
    const plan = planAfter((root) => {
      setAttr(memberEl(root, '1', '1'), 'FLAG-RESPONSAVEL', 'NAO');
      setAttr(memberEl(root, '1', '2'), 'FLAG-RESPONSAVEL', 'SIM');
    });
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops).toHaveLength(2);
    for (const op of plan.ops as ProductionOp[]) {
      expect(op.authors!.before.map((m) => m.lead)).toEqual([true, false]);
      expect(op.authors!.after.map((m) => m.lead)).toEqual([false, true]);
    }
  });

  it('integrante novo e integrante tirado', () => {
    const added = onlyOp((root) => {
      childElements(projectOf(root, '1'), 'EQUIPE-DO-PROJETO')[0]!.children.push(
        element('INTEGRANTES-DO-PROJETO', {
          'FLAG-RESPONSAVEL': 'NAO',
          'NOME-COMPLETO': 'Coautora de Exemplo',
          'NOME-PARA-CITACAO': 'EXEMPLO, C.',
          'ORDEM-DE-INTEGRACAO': '3',
        }),
      );
    });
    expect(added.authors!.before).toHaveLength(2);
    expect(added.authors!.after).toHaveLength(3);
    const removed = onlyOp((root) => {
      const equipe = childElements(projectOf(root, '1'), 'EQUIPE-DO-PROJETO')[0]!;
      equipe.children = equipe.children.filter(
        (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-DE-INTEGRACAO') === '2'),
      );
    });
    expect(removed.authors!.before.map((m) => m.name)).toEqual([
      'Pessoa Sintética',
      'Colega de Exemplo',
    ]);
    expect(removed.authors!.after.map((m) => m.name)).toEqual(['Pessoa Sintética']);
  });
});

describe('projeto: grades', () => {
  it('a marca de coordenador entra no lugar dela, ou no fim', () => {
    const rows = [
      Object.fromEntries([
        ['l', 'A'],
        ['c', ''],
        ['tit', 's'],
        ['add', false],
      ]),
      Object.fromEntries([
        ['l', 'B'],
        ['c', '3'],
      ]),
    ];
    const out = withLeads(rows, [
      { citation: '', cnpq: '', lead: false, name: 'A' },
      { citation: '', cnpq: '', lead: true, name: 'B' },
    ]);
    expect(out.map((r) => Object.keys(r))).toEqual([
      ['l', 'c', 'tit', 'add'],
      ['l', 'c', 'tit'],
    ]);
    expect(out.map((r) => r.tit)).toEqual(['n', 's']);
    expect(withLeads(rows, [{ citation: '', cnpq: '', name: 'A' }])).toBe(rows);
    expect(
      sameAuthors(out, [
        { citation: '', cnpq: '', name: 'A' },
        { citation: '', cnpq: '', name: 'B' },
      ]),
    ).toBe(true);
    expect(
      sameAuthors(out, [
        { citation: '', cnpq: '', lead: true, name: 'A' },
        { citation: '', cnpq: '', lead: false, name: 'B' },
      ]),
    ).toBe(false);
  });

  it('as grades que o conector não monta: a que falta e as preenchidas', () => {
    const grids = [
      { element: 'X', field: 'f_x', label: 'xis', table: 'grid2' },
      { element: 'Y', field: 'f_y', label: 'ípsilon', table: 'grid3' },
    ];
    const table = (id: string, rows: string) =>
      `<table class="grid" id="${id}">\n<thead><tr><th>T</th></tr></thead>\n<tbody>\n${rows}\n</tbody></table>`;
    expect(readOpaque(table('grid2', ''), grids)).toEqual({ missing: 'grid3' });
    // Como na página real: o oculto dentro do corpo vazio não conta como linha.
    expect(
      readOpaque(
        table('grid2', '<INPUT TYPE="hidden" NAME="f_producoes_d" VALUE="">') +
          table('grid3', '<tr><td><span>a</span></td></tr>'),
        grids,
      ),
    ).toEqual({ unsendable: [grids[1]], values: { f_x: '' } });
  });

  it('as grades do projeto como o check() as serializa, da página real (20/10/2026)', () => {
    const t = PRODUCTION_TARGETS.find((x) => x.id === 'projeto')!;
    const page = `<table id="grid2"> <thead><tr><th>Instituição</th></tr></thead> <tbody> <tr> <td>FAPESP_PPPROV<span id="cod_inst_aux">VJMOE00000002</span></td> <td>0000<span>0000;N;</span></td> <td>R$ 10,00<span>026|10,00</span></td> <td>Auxílio Financeiro<span>A</span></td> <td><img src="e.gif" onClick="editarLinhaTabela(this)"><img src="a.gif" onClick="apagaLinhaTabela(this)"></td> </tr> </tbody></table>
<table id="grid3"> <thead><tr><th>Produção</th></tr></thead> <tbody> <tr> <td tabindex="0">Teste do LattesEditor (apagar)<SPAN>34</SPAN></td> <td tabindex="0">2026</td> <td tabindex="0">Participações em eventos</td> </tr> <tr> <td tabindex="0">TESTE EDITOR APAGAR registro-PC-v1 f_titulo<SPAN>39</SPAN></td> <td tabindex="0">2006</td> <td tabindex="0">Software</td> </tr> <INPUT TYPE="hidden" NAME="f_producoes_d" VALUE="34|39"> </tbody></table>
<table id="grid4"> <thead><tr><th>Orientação</th></tr></thead> <tbody> <INPUT TYPE="hidden" NAME="f_orientacoes_d" VALUE=""> </tbody></table>`;
    expect(readOpaque(page, t.opaqueGrids!)).toEqual({
      unsendable: [],
      values: {
        f_inst_l: 'VJMOE00000002|0000;N;|026|10,00|A|@',
        f_orientacoes_l: '',
        f_producoes_l: '34@39@',
      },
    });
  });

  it('o valor do span como o innerHTML o devolve, e as linhas que não se leem', () => {
    const grid = {
      element: 'Y',
      field: 'f_y',
      label: 'ípsilon',
      serialize: { cells: 2, end: '|@' },
      table: 'g',
    };
    const read = (rows: string) =>
      readOpaque(`<table id="g"><tbody>${rows}</tbody></table>`, [grid]);
    expect(
      read(
        '<tr><td><span>a &amp; b&quot;&#39;</span></td><td>x<SPAN>c&nbsp;d\r\ne</SPAN></td></tr>',
      ),
    ).toEqual({ unsendable: [], values: { f_y: 'a &amp; b"\'|c&nbsp;d\ne|@' } });
    for (const rows of [
      '<tr><td><span>a</span></td><td>sem span</td></tr>',
      '<tr><td><span>a</span></td></tr>',
      '<tr><td><span><b>a</b></span></td><td><span>b</span></td></tr>',
      '<tr><td><span>a</span></td><td><span>b</span></td>',
    ]) {
      expect(read(rows)).toEqual({ unsendable: [grid], values: {} });
    }
  });

  it('no plano, só a grade preenchida sem serialização deixa o item à mão', () => {
    const grids = [
      { element: 'X', field: 'f_x', label: 'xis', table: 'grid2' },
      {
        element: 'Y',
        field: 'f_y',
        label: 'ípsilon',
        serialize: { cells: 1, end: '@' },
        table: 'grid3',
      },
    ];
    expect(opaqueByHand(() => true, grids)).toBe(
      'O item tem xis, que o conector não sabe reenviar ao Lattes; alterar este item vai à mão',
    );
    expect(opaqueByHand((g) => g.element === 'Y', grids)).toBeUndefined();
  });
});

describe('projeto: potencial de inovação', () => {
  it('o Não apaga o texto do potencial, como a página', () => {
    const withInnovation = XML.replace(
      'FLAG-POTENCIAL-INOVACAO="NAO"',
      'FLAG-POTENCIAL-INOVACAO="SIM"',
    );
    const original = parseXml(withInnovation).root;
    const working = parseXml(withInnovation).root;
    setAttr(projectOf(working, '1'), 'FLAG-POTENCIAL-INOVACAO', 'NAO');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      ON,
    );
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops[0]).toMatchObject({
      expect: { f_sta_inovacao: 'S' },
      set: { f_sta_inovacao: 'N', f_txt_potencial: '' },
    });
  });
});

describe('projeto no Lattes simulado: potencial de inovação', () => {
  it('o Sim com o texto vai e confere; o Não apaga o texto', async () => {
    const lattes = await lattesFor();
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(projectOf(working, '1'), 'FLAG-POTENCIAL-INOVACAO', 'SIM');
    const changes = diffDocuments(original, working);
    const extras = { [changes[0]!.key]: { f_txt_potencial: 'Um processo novo' } };
    const [yes] = planChanges(
      changes.map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { ...ON, extras },
    ).ops;
    expect(await applyOp(yes!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).at(-1)?.fields).toMatchObject({
      f_sta_inovacao: 'S',
      f_txt_potencial: 'Um processo novo',
    });
  });
});

describe('projeto no Lattes simulado', () => {
  it('nome e situação: grava, confere e deixa a equipe como estava', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto')(root);
      setProject('1', 'SITUACAO', 'CONCLUIDO')(root);
      setProject('1', 'ANO-FIM', '2024')(root);
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const p = projectOf(lattes.state.root, '1');
    expect(getAttr(p, 'NOME-DO-PROJETO')).toBe('Projeto Revisto');
    expect(getAttr(p, 'SITUACAO')).toBe('CONCLUIDO');
    expect(getAttr(p, 'ANO-FIM')).toBe('2024');
    const [post] = postsOf(lattes);
    expect(post).toMatchObject({ proc: 'PKG_PROJETO.FORM' });
    expect(post!.fields).toMatchObject({
      f_autores_l: 'Pessoa Sintética||SINTÉTICA, P.|s@Colega de Exemplo|7|COLEGA, E.|n',
      f_ctr: 'U',
      f_inst_l: '',
      f_orientacoes_l: '',
      f_producoes_l: '',
      F_TPO_SITUACAO: 'C',
    });
    expect(membersOf(lattes.state.root, '1')).toEqual([
      ['Pessoa Sintética', 'SIM'],
      ['Colega de Exemplo', 'NAO'],
    ]);
  });

  it('a natureza: acha o projeto na lista de extensão e grava a nova', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(setProject('2', 'NATUREZA', 'ENSINO'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(projectOf(lattes.state.root, '2'), 'NATUREZA')).toBe('ENSINO');
  });

  it('o Lattes com outro valor: nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(projectOf(lattes.state.root, '1'), 'NUMERO-GRADUACAO', '5');
    const op = onlyOp(setProject('1', 'NUMERO-GRADUACAO', '4'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('o Lattes com um financiador que o editor não tem: vai, e ele fica', async () => {
    const lattes = await lattesFor();
    projectOf(lattes.state.root, '1').children.push(
      element('FINANCIADORES-DO-PROJETO', {}, [
        element('FINANCIADOR-DO-PROJETO', { NATUREZA: 'BOLSA', 'NOME-INSTITUICAO': 'Agência' }),
      ]),
    );
    const op = onlyOp(setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields.f_inst_l).toBe('|0000;N;|026|10,00|B|@');
    expect(
      findIn(projectOf(lattes.state.root, '1'), (el) => el.name === 'FINANCIADOR-DO-PROJETO'),
    ).toBeDefined();
  });

  it('com financiador e produções ligadas: o título vai e as grades voltam iguais', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(setProject('3', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields).toMatchObject({
      f_inst_l: 'V000100000001|0000;N;|026|10,00|A|@',
      f_orientacoes_d: '',
      f_orientacoes_l: '',
      f_producoes_d: '34|39',
      f_producoes_l: '34@39@',
      f_titulo: 'Projeto Revisto',
    });
    const p = projectOf(lattes.state.root, '3');
    expect(getAttr(p, 'NOME-DO-PROJETO')).toBe('Projeto Revisto');
    const links = (name: string, attr: string) =>
      childElements(childElements(p, name)[0]!).map((c) => getAttr(c, attr));
    expect(links('FINANCIADORES-DO-PROJETO', 'NOME-INSTITUICAO')).toEqual(['Agência']);
    expect(links('PRODUCOES-CT-DO-PROJETO', 'SEQUENCIA-PRODUCAO-CT')).toEqual(['34', '39']);
  });

  it('uma linha que não se lê como o check() a serializa: nada é enviado', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/pkg_projeto\.form/i, (html) =>
        html.replace(/<SPAN>39<\/SPAN>/, '39'),
      ),
    });
    const op = onlyOp(setProject('3', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail:
        'O item tem no Lattes produções ligadas, que o conector não sabe reenviar; nada foi enviado',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('com financiador, página sem a tabela dele: nada é enviado', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/pkg_projeto\.form/i, (html) =>
        html.replace('id="grid2"', 'id="outra"'),
      ),
    });
    const op = onlyOp(setProject('3', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'A página do Lattes não tem a grade grid2; nada foi enviado',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('uma produção ligada que some no envio é acusada', async () => {
    const lattes = await lattesFor({
      intercept: faults.afterPost((_req, state) => {
        const prods = childElements(projectOf(state.root, '3'), 'PRODUCOES-CT-DO-PROJETO')[0]!;
        prods.children = childElements(prods).slice(0, 1);
      }),
    });
    const op = onlyOp(setProject('3', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail:
        'Outros campos mudaram no Lattes: produções ligadas, f_producoes_d. Confira no Lattes',
      status: 'divergente',
    });
  });

  it('página sem a tabela de uma grade: nada é enviado', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/pkg_projeto\.form/i, (html) =>
        html.replace('id="grid4"', 'id="outra"'),
      ),
    });
    const op = onlyOp(setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'A página do Lattes não tem a grade grid4; nada foi enviado',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('um financiador que aparece no envio é acusado', async () => {
    const lattes = await lattesFor({
      intercept: faults.afterPost((_req, state) => {
        projectOf(state.root, '1').children.push(
          element('FINANCIADORES-DO-PROJETO', {}, [
            element('FINANCIADOR-DO-PROJETO', { 'NOME-INSTITUICAO': 'Agência' }),
          ]),
        );
      }),
    });
    const op = onlyOp(setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: financiadores. Confira no Lattes',
      status: 'divergente',
    });
  });

  it('a página relida sem uma das grades é divergente', async () => {
    let gets = 0;
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/pkg_projeto\.form/i, (html) => {
        gets += 1;
        return gets > 2 ? html.replace('id="grid3"', 'id="outra"') : html;
      }),
    });
    const op = onlyOp(setProject('1', 'NOME-DO-PROJETO', 'Projeto Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'Depois do envio, a página do item não pôde ser relida; confira no Lattes',
      status: 'divergente',
    });
  });

  it('a equipe: trocar um integrante por outro da lista de autores', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) =>
      setAttr(memberEl(root, '1', '2'), 'NOME-COMPLETO', 'Coautora de Exemplo'),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields.f_autores_l).toBe(
      'Pessoa Sintética||SINTÉTICA, P.|s@Coautora de Exemplo|3|EXEMPLO, C.|n',
    );
    expect(membersOf(lattes.state.root, '1')).toEqual([
      ['Pessoa Sintética', 'SIM'],
      ['Coautora de Exemplo', 'NAO'],
    ]);
  });

  it('a equipe: integrante fora da lista de autores do Lattes fica sem envio', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) =>
      setAttr(memberEl(root, '1', '2'), 'NOME-COMPLETO', 'Pessoa Desconhecida'),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'erro' });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('trocar o coordenador: a primeira grava, a segunda acha pronto', async () => {
    const lattes = await lattesFor();
    const plan = planAfter((root) => {
      setAttr(memberEl(root, '1', '1'), 'FLAG-RESPONSAVEL', 'NAO');
      setAttr(memberEl(root, '1', '2'), 'FLAG-RESPONSAVEL', 'SIM');
    });
    const [first, second] = plan.ops;
    expect(await applyOp(first!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(await applyOp(second!, lattes.port)).toMatchObject({
      detail: 'O Lattes já estava assim; nada foi enviado',
      status: 'conferido',
    });
    expect(postsOf(lattes)).toHaveLength(1);
    expect(membersOf(lattes.state.root, '1')).toEqual([
      ['Pessoa Sintética', 'NAO'],
      ['Colega de Exemplo', 'SIM'],
    ]);
  });

  it('a equipe no Lattes diferente: nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(memberEl(lattes.state.root, '1', '2'), 'NOME-COMPLETO', 'Outra Pessoa');
    const op = onlyOp((root) =>
      setAttr(memberEl(root, '1', '2'), 'NOME-COMPLETO', 'Coautora de Exemplo'),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Equipe',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });
});

const change = (element: string, attrs: string[], kind: Change['kind'] = 'alterado'): Change => ({
  element,
  fields: attrs.map((attr) => ({ after: 'b', attr, before: 'a', label: attr })),
  form: '',
  key: element,
  kind,
  path: [],
});

describe('atuação, atividades e áreas: o motivo de ficar à mão', () => {
  it('no plano, cada uma com o motivo dela', () => {
    expect(
      reasonOf((root) => {
        const a = findIn(root, (el) => el.name === 'ATUACAO-PROFISSIONAL')!;
        setAttr(a, 'NOME-INSTITUICAO', 'Outra Universidade');
      })[0],
    ).toMatch(/A tela da atuação do Lattes não tem: a instituição/);
    expect(
      reasonOf((root) => {
        const d = findIn(root, (el) => el.name === 'DIRECAO-E-ADMINISTRACAO')!;
        setAttr(d, 'CARGO-OU-FUNCAO', 'Direção');
      })[0],
    ).toMatch(/Alterar esta atividade da atuação vai à mão/);
    expect(
      reasonOf((root) => {
        const a = findIn(root, (el) => el.name === 'AREA-DE-ATUACAO')!;
        setAttr(a, 'NOME-DA-AREA-DO-CONHECIMENTO', 'Botânica');
      })[0],
    ).toMatch(/chave r/);
    expect(
      reasonOf((root) => {
        const p = findIn(root, (el) => el.name === 'PARTICIPACAO-EM-PROJETO')!;
        setAttr(p, 'MES-INICIO', '4');
      })[0],
    ).toMatch(/período da sua participação/);
    expect(
      reasonOf((root) => {
        const p = findIn(root, (el) => el.name === 'PARTICIPACAO-EM-PROJETO')!;
        setAttr(p, 'NOME-ORGAO', 'Outro');
      })[0],
    ).toMatch(/não troca o órgão/);
    expect(
      reasonOf((root) => {
        const v = findIn(root, (el) => el.name === 'VINCULOS')!;
        setAttr(v, 'TIPO-DE-VINCULO', 'SERVIDOR_PUBLICO');
      })[0],
    ).toMatch(/não tem: o tipo do vínculo/);
  });

  it('a ordem da atuação, a disciplina e o que não é destes', () => {
    expect(atuacaoByHand(change('ATUACAO-PROFISSIONAL', ['SEQUENCIA-IMPORTANCIA']), [])).toBe(
      'A tela da atuação no Lattes não tem: SEQUENCIA-IMPORTANCIA',
    );
    expect(atuacaoByHand(change('DISCIPLINA', []), [element('ENSINO')])).toMatch(/atividade/);
    expect(atuacaoByHand(change('IDIOMA', ['IDIOMA']), [])).toBeUndefined();
    expect(vinculoByHand(change('VINCULOS', ['ENQUADRAMENTO-FUNCIONAL']))).toMatch(
      /enquadramento da lista/,
    );
    expect(vinculoByHand(change('VINCULOS', ['ANO-FIM']))).toBeUndefined();
  });
});

describe('projeto: financiador', () => {
  const funderOf = (root: XElement) =>
    findIn(projectOf(root, '3'), (el) => el.name === 'FINANCIADOR-DO-PROJETO')!;
  const set = (attr: string, value: string) => (root: XElement) =>
    setAttr(funderOf(root), attr, value);
  const USP = 'Universidade de São Paulo';

  it('a natureza e a instituição vão pela linha; o código e o vazio ficam à mão', () => {
    expect(onlyOp(set('NATUREZA', 'REMUNERACAO'))).toMatchObject({
      funder: { code: '000100000001', nature: { after: 'R', before: 'A' } },
      rows: [{ after: 'Remuneração', name: 'f_inst_l' }],
    });
    expect(onlyOp(set('NOME-INSTITUICAO', USP))).toMatchObject({
      funder: { institution: { after: USP, before: 'Agência' } },
      rows: [{ after: USP, before: 'Agência' }],
    });
    expect(reasonOf(set('NATUREZA', 'NAO_INFORMADO'))[0]).toMatch(/o Lattes pede Auxílio/);
    expect(reasonOf(set('NOME-INSTITUICAO', ' '))[0]).toMatch(/pede a instituição/);
    expect(reasonOf(set('CODIGO-INSTITUICAO', '9'))[0]).toMatch(/sai da busca do Lattes/);
    // A troca no financiador não segura outra mudança do projeto.
    expect(
      planAfter((root) => {
        set('NATUREZA', 'BOLSA')(root);
        setProject('3', 'NOME-DO-PROJETO', 'Outro')(root);
      }).ops,
    ).toHaveLength(2);
  });

  it('a linha da página real: o código com a letra, a busca pelo nome', async () => {
    const html = `<table id="grid2"><tbody> <tr> <td>CNPq<span id="cod_inst_aux">V002200000000</span></td> <td>1234<span>1234;N;</span></td> <td>R$ 100,00<span>026|100,00</span></td> <td>Bolsa<span>B</span></td> <td></td> </tr> </tbody></table>`;
    const search = `<a onclick="seleciona('V002200000000','Conselho Nacional de Desenvolvimento Científico e Tecnológico','CNPq')"></a><a onclick="seleciona('VK71K00000000','CONSELHO NACIONAL DE DESENVOLVIMENTO CIENTIFICO E TECNOLOGICO-CNPQ','X')"></a><a onclick="seleciona('VJJJ600000008','Fundação de Exemplo','FE')"></a>`;
    const posts: string[] = [];
    const port = {
      post: async (proc: string, body: string) => {
        posts.push(`${proc} ${body}`);
        return search;
      },
    } as unknown as LattesPort;
    const path = 'PKG_PROJETO.form?f_cod=K0000000A0&F_SEQ_ATIV=2&F_SEQ_FUNCAO=3&F_SEQ_PROJ=1';
    const grid = PRODUCTION_TARGETS.find((t) => t.id === 'projeto')!.opaqueGrids!;
    const value = (edit: FunderEdit, page = html) => funderValue(port, path, page, grid, edit);
    const code = '002200000000';
    expect(await value({ code, nature: { after: 'C', before: 'B' } })).toEqual({
      field: 'f_inst_l',
      value: 'V002200000000|1234;N;|026|100,00|C|@',
    });
    expect(
      await value({ code, institution: { after: 'Fundação de Exemplo', before: 'CNPq' } }),
    ).toEqual({ field: 'f_inst_l', value: 'VJJJ600000008|1234;N;|026|100,00|B|@' });
    expect(posts.at(-1)).toBe(
      'PKG_PROJETO.PP_LISTA_INST F_CTR=C&F_COD=K0000000A0&F_PGM=INSTFINANC&F_COD_INST=&F_SEQ_FUNCAO=3&F_SEQ_ATIV=2&F_SEQ_PROJ=1&f_nome=Funda%E7%E3o+de+Exemplo',
    );
    // A busca sem uma instituição de mesmo nome, ou com duas, não envia.
    expect(await value({ code, institution: { after: 'Conselho', before: 'CNPq' } })).toMatchObject(
      { status: 'erro' },
    );
    // Já como o editor quer: pelo código novo, numa segunda vez.
    expect(
      await value(
        { code: 'OUTRO', institution: { after: 'Fundação de Exemplo', before: 'x' } },
        html.replace('V002200000000', 'VJJJ600000008'),
      ),
    ).toMatchObject({ status: 'conferido' });
    expect(await value({ code, nature: { after: 'B', before: 'A' } })).toMatchObject({
      status: 'conferido',
    });
    expect(await value({ code, nature: { after: 'A', before: 'C' } })).toMatchObject({
      status: 'divergente',
    });
    expect(await value({ code: 'OUTRO', nature: { after: 'A', before: 'B' } })).toMatchObject({
      status: 'divergente',
    });
    expect(await value({ code, nature: { after: 'A', before: 'B' } }, '')).toMatchObject({
      status: 'divergente',
    });
  });

  it('no Lattes simulado: a natureza e a instituição vão, e a releitura confere a grade', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      set('NATUREZA', 'BOLSA')(root);
      set('NOME-INSTITUICAO', USP)(root);
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).at(-1)!.fields.f_inst_l).toBe('V000000000002|0000;N;|026|10,00|B|@');
    const saved = funderOf(lattes.state.root);
    expect(getAttr(saved, 'NATUREZA')).toBe('BOLSA');
    expect(getAttr(saved, 'NOME-INSTITUICAO')).toBe(USP);
    expect(getAttr(saved, 'CODIGO-INSTITUICAO')).toBe('000000000002');
    // De novo: o Lattes já está assim, e nada mais vai ao formulário.
    const sent = postsOf(lattes).filter((p) => p.proc === 'PKG_PROJETO.FORM').length;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).filter((p) => p.proc === 'PKG_PROJETO.FORM')).toHaveLength(sent);
  });

  it('o Lattes com outra natureza, ou a instituição fora da busca: nada vai', async () => {
    const lattes = await lattesFor();
    setAttr(funderOf(lattes.state.root), 'NATUREZA', 'REMUNERACAO');
    expect(await applyOp(onlyOp(set('NATUREZA', 'BOLSA')), lattes.port)).toMatchObject({
      status: 'divergente',
    });
    expect(
      await applyOp(onlyOp(set('NOME-INSTITUICAO', 'Instituição Inexistente')), lattes.port),
    ).toMatchObject({ status: 'erro' });
    expect(postsOf(lattes).filter((p) => p.proc === 'PKG_PROJETO.FORM')).toEqual([]);
  });
});

describe('projeto: produções e orientações ligadas no Lattes simulado', () => {
  it('tira uma ligação e inclui outra, e a releitura confere as duas grades', async () => {
    const lattes = await lattesFor();
    const prods = (root: XElement) =>
      childElements(projectOf(root, '3'), 'PRODUCOES-CT-DO-PROJETO')[0]!;
    const plan = planAfter((root) => {
      const c = prods(root);
      c.children = childElements(c).slice(1);
      c.children.push(element('PRODUCAO-CT-DO-PROJETO', { 'SEQUENCIA-PRODUCAO-CT': '41' }));
    });
    expect(plan.unsupported).toEqual([]);
    expect(await applyOp(plan.ops[0]!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).at(-1)!.fields).toMatchObject({
      f_orientacoes_d: '41',
      f_orientacoes_l: '41@',
      f_producoes_d: '39',
      f_producoes_l: '39@',
    });
    expect(
      childElements(prods(lattes.state.root)).map((p) => getAttr(p, 'SEQUENCIA-PRODUCAO-CT')),
    ).toEqual(['39', '41']);
    // A segunda operação da mesma fila acha o Lattes já assim.
    const posts = postsOf(lattes).length;
    expect(await applyOp(plan.ops[1]!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)).toHaveLength(posts);
  });
});

describe('projeto: incluir e tirar financiadores', () => {
  const funders = (root: XElement) =>
    childElements(projectOf(root, '3'), 'FINANCIADORES-DO-PROJETO')[0]!;

  it('tirar deixa a linha de fora; incluir acha a instituição pela busca', async () => {
    const lattes = await lattesFor();
    const add = planAfter((root) =>
      funders(root).children.push(
        element('FINANCIADOR-DO-PROJETO', {
          'CODIGO-INSTITUICAO': '',
          NATUREZA: 'BOLSA',
          'NOME-INSTITUICAO': 'Universidade de São Paulo',
          'SEQUENCIA-FINANCIADOR': '2',
        }),
      ),
    );
    expect(add.unsupported).toEqual([]);
    expect(add.ops[0]).toMatchObject({
      funders: { add: [{ letter: 'B', name: 'Universidade de São Paulo' }], remove: [] },
    });
    expect(await applyOp(add.ops[0]!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).at(-1)!.fields.f_inst_l).toBe(
      'V000100000001|0000;N;|026|10,00|A|@V000000000002|;N;|||B|@',
    );
    expect(
      childElements(funders(lattes.state.root)).map((f) => getAttr(f, 'NOME-INSTITUICAO')),
    ).toEqual(['Agência', 'Universidade de São Paulo']);

    const remove = planAfter((root) => {
      funders(root).children = [];
      funders(root).children.push(element('FINANCIADOR-DO-PROJETO', {}));
    });
    expect(remove.ops[0]).toMatchObject({ funders: { remove: ['000100000001'] } });
    expect(await applyOp(remove.ops[0]!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).at(-1)!.fields.f_inst_l).toBe('V000000000002|;N;|||B|@');
  });

  it('natureza fora da lista, sem instituição ou tirar todos: à mão', () => {
    const reason = (attrs: Record<string, string>) =>
      reasonOf((root) => funders(root).children.push(element('FINANCIADOR-DO-PROJETO', attrs)))[0];
    expect(reason({ NATUREZA: 'NAO_INFORMADO', 'NOME-INSTITUICAO': 'X' })).toMatch(/o Lattes pede/);
    expect(reason({ NATUREZA: 'BOLSA' })).toMatch(/sem a instituição/);
    expect(
      reasonOf((root) => {
        const p = projectOf(root, '3');
        p.children = p.children.filter((c) => c !== funders(root));
      })[0],
    ).toMatch(/um de cada vez/);
  });
});
