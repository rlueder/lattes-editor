// O que a passada de 29/10/2026 pelos projetos e licenças do Lattes real
// mostrou (docs/lattes_internals.md, seção 27): os campos só de tela de cada
// natureza, o projeto com potencial de inovação nas duas listas, o tipo da
// licença de volta do formulário, o CNPJ que só grava com o código da empresa
// e o rádio do projeto de ensino, que o Lattes põe em Sim com uma ação
// inovadora marcada.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp, type LattesPort } from '../src/bridge/apply.ts';
import { loadCvFromLattes, type LoadPort } from '../src/bridge/load/loader.ts';
import { readPages } from '../src/bridge/load/pages.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { COMPANY_LOOKUP, resolveCompany, unmasked } from '../src/bridge/production/company.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { TEACHING_INNOVATION } from '../src/bridge/production/targets/projetos.ts';
import { fromForm } from '../src/bridge/refresh/from-form.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { element, getAttr, parseXml, setAttr, walk, type XElement } from '../src/model/xml.ts';
import { licenseToForm } from '../src/schema/license-types.ts';
import { screenTableFor } from '../src/schema/screen-fields.ts';
import {
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const project = (seq: string, nature: string, name: string, flag = 'NAO') =>
  `<PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCAO-ATIVIDADE="${seq}" FLAG-PERIODO="ATUAL" ANO-INICIO="2020" NOME-ORGAO="Instituto"><PROJETO-DE-PESQUISA SEQUENCIA-PROJETO="${seq}" ANO-INICIO="2020" ANO-FIM="" NOME-DO-PROJETO="${name}" SITUACAO="EM_ANDAMENTO" NATUREZA="${nature}" FLAG-POTENCIAL-INOVACAO="${flag}"><EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO NOME-COMPLETO="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-INTEGRACAO="1" FLAG-RESPONSAVEL="SIM" NRO-ID-CNPQ=""/></EQUIPE-DO-PROJETO></PROJETO-DE-PESQUISA></PARTICIPACAO-EM-PROJETO>`;

const licence = (type: string, year: string) =>
  `<LICENCA TIPO-LICENCA="${type}" FORMATO-DATA-INICIO-LICENCA="DDMMAAAA" DATA-INICIO-LICENCA="1001${year}" FORMATO-DATA-FIM-LICENCA="DDMMAAAA" DATA-FIM-LICENCA="1003${year}"/>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1234567890123456"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética" NOME-EM-CITACOES-BIBLIOGRAFICAS="SINTÉTICA, P.">
<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="001000000998" NOME-INSTITUICAO="Universidade de Exemplo" SEQUENCIA-ATIVIDADE="1" SEQUENCIA-IMPORTANCIA="1">
<VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="CELETISTA" ANO-INICIO="2011" FLAG-VINCULO-EMPREGATICIO="SIM"/>
<ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
${project('1', 'PESQUISA', 'Projeto com Inovação', 'SIM')}
${project('2', 'EXTENSAO', 'Projeto de Extensão')}
${project('3', 'ENSINO', 'Projeto de Ensino')}
</ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS>
<LICENCAS>${licence('MATERNIDADE', '2001')}${licence('PATERNIDADE', '2002')}${licence('ADOCAO', '2003')}</LICENCAS>
</DADOS-GERAIS></CURRICULO-VITAE>`;

const ON: PlanOptions = { editProduction: true };

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattes() {
  await open?.close();
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

const all = (root: XElement, name: string) => {
  const out: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) out.push(el);
  });
  return out;
};

const projectOf = (root: XElement, seq: string) =>
  all(root, 'PROJETO-DE-PESQUISA').find((p) => getAttr(p, 'SEQUENCIA-PROJETO') === seq)!;

function plan(edit: (root: XElement) => void, extras = {}) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const changes = diffDocuments(original, working);
  return planChanges(
    changes.map((change) => ({ change, itemTitle: 'Item' })),
    working,
    { ...ON, extras: Object.fromEntries(changes.map((c) => [c.key, extras])) },
  );
}

const loadPort = (sim: LattesSimuladoNoTeste): LoadPort => ({
  menu: async () => sim.port.menuHtml(),
  pages: (paths) =>
    readPages({ get: (p) => sim.port.get(p), post: (p, body) => sim.port.post(p, body) }, paths),
  readForm: sim.port.readForm,
});

describe('os campos só de tela que valem para a natureza do projeto', () => {
  const projeto = (nature: string) => element('PROJETO-DE-PESQUISA', { NATUREZA: nature });

  it('o projeto que não é de ensino fica sem as caixas, que a página traz como o oculto X', () => {
    const table = Object.keys(screenTableFor(projeto('PESQUISA')));
    expect(table).toEqual(expect.arrayContaining(['tela:f_tpo_pesq_emp', 'tela:f_cnpj_empresa']));
    expect(table).not.toEqual(expect.arrayContaining(['tela:f_tematica']));
    expect(table.filter((a) => /f_tematica|f_tpo_acao_inov|f_tpo_cooperacao/.test(a))).toEqual([]);
  });

  it('o projeto de ensino fica com as caixas e sem os dados da empresa', () => {
    const table = Object.keys(screenTableFor(projeto('ENSINO')));
    expect(table).toEqual(
      expect.arrayContaining(['tela:f_tematica', 'tela:f_tpo_acao_inov', 'tela:f_tpo_cooperacao']),
    );
    expect(table.filter((a) => /empresa|f_txt_setor/.test(a))).toEqual([]);
  });
});

describe('o tipo da licença de volta do formulário', () => {
  it('M, P e A voltam como MATERNIDADE, PATERNIDADE e ADOCAO', () => {
    const map = { field: 'f_tipo_licenca', toForm: licenseToForm };
    expect(['M', 'P', 'A'].map((v) => fromForm('LICENCA', 'TIPO-LICENCA', map, v))).toEqual([
      'MATERNIDADE',
      'PATERNIDADE',
      'ADOCAO',
    ]);
    expect(fromForm('LICENCA', 'TIPO-LICENCA', map, 'Z')).toBeUndefined();
  });
});

describe('carregar do Lattes simulado: projetos e licenças', () => {
  it('o projeto com potencial de inovação, também na lista de inovação, entra uma vez', async () => {
    const sim = await lattes();
    const menu = await sim.port.menuHtml();
    expect(menu).toMatch(/pkg_projeto\.lista\?f_cod_tipo=P&(amp;)?f_sta_inovacao=S/);
    const result = await loadCvFromLattes(loadPort(sim));
    expect(result.stopped).toBeUndefined();
    const loaded = result.doc!.root;
    const names = all(loaded, 'PROJETO-DE-PESQUISA').map((p) => getAttr(p, 'NOME-DO-PROJETO'));
    expect(names.sort()).toEqual([
      'Projeto com Inovação',
      'Projeto de Ensino',
      'Projeto de Extensão',
    ]);
  });

  it('cada projeto só com os campos só de tela da natureza dele', async () => {
    const sim = await lattes();
    const loaded = (await loadCvFromLattes(loadPort(sim))).doc!.root;
    const screen = (seq: string) =>
      projectOf(loaded, seq)
        .attrs.filter((a) => a.name.startsWith('tela:'))
        .map((a) => a.name);
    for (const seq of ['1', '2']) {
      expect(
        screen(seq).filter((a) => /f_tematica|f_tpo_acao_inov|f_tpo_cooperacao/.test(a)),
      ).toEqual([]);
    }
    expect(screen('3').filter((a) => /empresa|f_txt_setor/.test(a))).toEqual([]);
    expect(getAttr(projectOf(loaded, '2'), 'tela:f_tematica')).toBeUndefined();
  });

  it('as licenças voltam com o tipo, também os que o XSD não enumera', async () => {
    const sim = await lattes();
    const loaded = (await loadCvFromLattes(loadPort(sim))).doc!.root;
    expect(all(loaded, 'LICENCA').map((l) => getAttr(l, 'TIPO-LICENCA'))).toEqual([
      'MATERNIDADE',
      'PATERNIDADE',
      'ADOCAO',
    ]);
  });
});

describe('a empresa do projeto pelo CNPJ', () => {
  const port = (reply: string, seen: string[] = []): LattesPort =>
    ({
      get: async (path: string) => {
        seen.push(path);
        return reply;
      },
    }) as unknown as LattesPort;

  it('a consulta vai sem a máscara, e o código volta para f_cod_inst_empresa', async () => {
    const seen: string[] = [];
    const reply = '{"cod":"EMP000000001" ,"nome":"Empresa Exemplo Ltda" ,"email":""}';
    expect(await resolveCompany('11.222.333/0001-81', port(reply, seen))).toEqual({
      check: { f_cod_inst_empresa: null },
      set: { f_cod_inst_empresa: 'EMP000000001' },
    });
    expect(seen).toEqual([`${COMPANY_LOOKUP}?p_cnpj=11222333000181`]);
    expect(unmasked(' 11.222.333/0001-81 ')).toBe('11222333000181');
  });

  it('sem empresa, resposta que não é JSON, e o CNPJ apagado', async () => {
    const empty = '{"cod":"" ,"nome":"" ,"email":""}';
    expect(await resolveCompany('11222333000181', port(empty))).toMatchObject({
      detail: expect.stringMatching(/CNPJ inválido/),
    });
    expect(await resolveCompany('11222333000181', port('<html>'))).toMatchObject({
      detail: expect.stringMatching(/não respondeu/),
    });
    const seen: string[] = [];
    expect(await resolveCompany('', port(empty, seen))).toEqual({
      check: {},
      set: { f_cod_inst_empresa: '' },
    });
    expect(seen).toEqual([]);
  });

  it('no Lattes simulado, o CNPJ vai com o código e grava; sem empresa, nada vai', async () => {
    const sim = await lattes();
    const [op] = plan((root) => {
      setAttr(projectOf(root, '2'), 'tela:f_tpo_pesq_emp', 'S');
      setAttr(projectOf(root, '2'), 'tela:f_cnpj_empresa', '11.222.333/0001-81');
    }).ops;
    expect(await applyOp(op!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim).at(-1)?.fields).toMatchObject({
      f_cnpj_empresa: '11.222.333/0001-81',
      f_cod_inst_empresa: 'EMP000000001',
    });
    expect(sim.state.formOnly(projectOf(sim.state.root, '2')).f_cnpj_empresa).toBe(
      '11.222.333/0001-81',
    );

    const posts = postsOf(sim).length;
    const [unknown] = plan((root) => {
      setAttr(projectOf(root, '2'), 'tela:f_cnpj_empresa', '99.999.999/9999-99');
    }).ops;
    expect(await applyOp(unknown!, sim.port)).toMatchObject({
      detail: expect.stringMatching(/CNPJ inválido/),
      status: 'erro',
    });
    expect(postsOf(sim)).toHaveLength(posts);
  });
});

describe('o projeto de ensino: ações inovadoras e o rádio', () => {
  it('ações marcadas com Não ficam à mão, com o motivo', () => {
    const planned = plan((root) => setAttr(projectOf(root, '3'), 'tela:f_tpo_acao_inov', 'GR,GD'));
    expect(planned.ops).toEqual([]);
    expect(planned.unsupported.map((u) => u.reason)).toEqual([TEACHING_INNOVATION]);
  });

  it('o Sim vai sem o texto do potencial, e as ações com ele', async () => {
    const sim = await lattes();
    const planned = plan((root) => {
      setAttr(projectOf(root, '3'), 'FLAG-POTENCIAL-INOVACAO', 'SIM');
      setAttr(projectOf(root, '3'), 'tela:f_tpo_acao_inov', 'GR,GD');
    });
    expect(planned.unsupported).toEqual([]);
    const op = planned.ops[0] as ProductionOp;
    expect(op.set).toMatchObject({ f_sta_inovacao: 'S', f_tpo_acao_inov: 'GR,GD' });
    expect(op.set).not.toHaveProperty('f_txt_potencial');
    expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(projectOf(sim.state.root, '3'), 'FLAG-POTENCIAL-INOVACAO')).toBe('SIM');
  });

  it('fora do ensino, o Sim continua pedindo o texto do potencial', () => {
    const planned = plan((root) => setAttr(projectOf(root, '2'), 'FLAG-POTENCIAL-INOVACAO', 'SIM'));
    expect(planned.ops).toEqual([]);
    expect(planned.unsupported[0]?.reason).toMatch(/escreva no editor qual é o potencial/);
  });
});
