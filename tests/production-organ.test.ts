// Órgão e unidade do projeto pela janela de órgãos (production/organ.ts),
// contra o Lattes simulado, que tem a janela no formato lido em 18/10/2026.

import { afterEach, describe, expect, it } from 'vitest';

import { PARTICIPATION_PERIOD } from '../src/bridge/atuacao-by-hand.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { applyProduction } from '../src/bridge/production/apply.ts';
import { organText } from '../src/bridge/production/organ.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética" NOME-EM-CITACOES-BIBLIOGRAFICAS="SINTÉTICA, P.">
<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="000000000001" NOME-INSTITUICAO="Universidade Federal do Rio Grande do Sul" SEQUENCIA-ATIVIDADE="1" SEQUENCIA-IMPORTANCIA="1">
<VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="CELETISTA" ENQUADRAMENTO-FUNCIONAL="" MES-INICIO="01" ANO-INICIO="2011" MES-FIM="" ANO-FIM="" CARGA-HORARIA-SEMANAL="40" FLAG-DEDICACAO-EXCLUSIVA="NAO" FLAG-VINCULO-EMPREGATICIO="SIM"/>
<ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
<PARTICIPACAO-EM-PROJETO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ATUAL" MES-INICIO="3" ANO-INICIO="2020" MES-FIM="" ANO-FIM="" CODIGO-ORGAO="000001000008" NOME-ORGAO="Instituto de Biociências" CODIGO-UNIDADE="" NOME-UNIDADE=""><PROJETO-DE-PESQUISA SEQUENCIA-PROJETO="1" ANO-INICIO="2020" ANO-FIM="" NOME-DO-PROJETO="Projeto de Exemplo" SITUACAO="EM_ANDAMENTO" NATUREZA="PESQUISA" DESCRICAO-DO-PROJETO="Descrição" DESCRICAO-DO-PROJETO-INGLES="" NOME-DO-PROJETO-INGLES="" FLAG-POTENCIAL-INOVACAO="NAO" IDENTIFICADOR-PROJETO=""><EQUIPE-DO-PROJETO><INTEGRANTES-DO-PROJETO NOME-COMPLETO="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-INTEGRACAO="1" FLAG-RESPONSAVEL="SIM" NRO-ID-CNPQ=""/></EQUIPE-DO-PROJETO></PROJETO-DE-PESQUISA></PARTICIPACAO-EM-PROJETO>
</ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO>
</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`;

const ON: PlanOptions = { editProduction: true, projectOrgan: true };

const participation = (root: XElement) =>
  findIn(root, (el) => el.name === 'PARTICIPACAO-EM-PROJETO')!;

const unit = (code: string, name: string) => (root: XElement) => {
  setAttr(participation(root), 'CODIGO-UNIDADE', code);
  setAttr(participation(root), 'NOME-UNIDADE', name);
};

const organ = (code: string, name: string) => (root: XElement) => {
  for (const [a, v] of [
    ['CODIGO-ORGAO', code],
    ['NOME-ORGAO', name],
    ['CODIGO-UNIDADE', ''],
    ['NOME-UNIDADE', ''],
  ] as const) {
    setAttr(participation(root), a, v);
  }
};

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

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattes() {
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

describe('órgão do projeto: o plano', () => {
  it('a unidade escolhida vira uma alteração do projeto, com o órgão de cima', () => {
    const plan = planAfter(unit('000001001004', 'Departamento de Genética'));
    expect(plan.unsupported).toEqual([]);
    const op = plan.ops[0] as ProductionOp;
    expect(op).toMatchObject({
      kind: 'producao',
      match: { title: 'Projeto de Exemplo', year: '2020' },
      organ: { before: '000001000008', code: '000001001004', parent: '000001000008' },
      set: {},
      target: 'projeto',
    });
    expect(op.rows[0]).toMatchObject({
      after: 'Instituto de Biociências/ Departamento de Genética',
      before: 'Instituto de Biociências',
    });
  });

  it('outro órgão, sem unidade, vai sem o de cima', () => {
    const op = planAfter(organ('000002000004', 'Instituto de Informática')).ops[0] as ProductionOp;
    expect(op.organ).toEqual({
      before: '000001000008',
      beforeText: 'Instituto de Biociências',
      code: '000002000004',
    });
  });

  it('nome sem código, órgão vazio e o período ficam à mão, com o motivo', () => {
    const reasons = (edit: (root: XElement) => void, options?: PlanOptions) =>
      planAfter(edit, options).unsupported.map((u) => u.reason);
    expect(reasons((r) => setAttr(participation(r), 'NOME-ORGAO', 'Outro'))).toEqual([
      'Órgão e unidade: escolha pela lista do Lattes, que grava o código junto',
    ]);
    expect(reasons(organ('', ''))[0]).toMatch(/não fica vazio/);
    expect(reasons((r) => setAttr(participation(r), 'ANO-INICIO', '2019'))).toEqual([
      PARTICIPATION_PERIOD,
    ]);
    // Uma extensão sem a janela de órgãos: o motivo de antes.
    expect(
      reasons(unit('000001001004', 'Departamento de Genética'), { editProduction: true })[0],
    ).toMatch(/busca de órgão/);
  });

  it('o texto da janela junta órgão e unidade', () => {
    expect(organText('A', 'B')).toBe('A/\nB');
    expect(organText('A', '')).toBe('A');
  });
});

describe('órgão do projeto: o envio', () => {
  it('grava a unidade pela janela de órgãos e confere na releitura', async () => {
    const sim = await lattes();
    const op = planAfter(unit('000001001004', 'Departamento de Genética')).ops[0]!;
    const r = await applyProduction(op as ProductionOp, sim.port, { projectOrgan: true });
    expect(r).toMatchObject({ status: 'conferido' });
    const p = participation(sim.state.root);
    expect([
      getAttr(p, 'CODIGO-ORGAO'),
      getAttr(p, 'CODIGO-UNIDADE'),
      getAttr(p, 'NOME-UNIDADE'),
    ]).toEqual(['000001000008', '000001001004', 'Departamento de Genética']);
    // O que foi: o código da unidade e o texto da janela; a página relida mostra o texto.
    expect(postsOf(sim).at(-1)?.fields).toMatchObject({
      f_codorgao: '000001001004',
      f_codorgao2: '',
      // A quebra de linha vai como o formulário a codifica.
      f_orgao_old: expect.stringMatching(
        /^Instituto de Biociências\/\r?\nDepartamento de Genética$/,
      ),
    });
    // O resto do projeto ficou como estava.
    const projeto = findIn(sim.state.root, (el) => el.name === 'PROJETO-DE-PESQUISA')!;
    expect(getAttr(projeto, 'NOME-DO-PROJETO')).toBe('Projeto de Exemplo');
  });

  it('código que a janela não tem não vai; o Lattes com outro órgão também não', async () => {
    const sim = await lattes();
    const missing = planAfter(unit('000001009999', 'Inexistente')).ops[0]!;
    expect(
      await applyProduction(missing as ProductionOp, sim.port, { projectOrgan: true }),
    ).toMatchObject({
      detail: expect.stringMatching(/não encontrado/),
      status: 'erro',
    });
    // A página de alteração só mostra o texto do órgão: é ele que se confere.
    setAttr(participation(sim.state.root), 'CODIGO-ORGAO', '000002000004');
    setAttr(participation(sim.state.root), 'NOME-ORGAO', 'Instituto de Informática');
    const stale = planAfter(unit('000001001004', 'Departamento de Genética')).ops[0]!;
    expect(
      await applyProduction(stale as ProductionOp, sim.port, { projectOrgan: true }),
    ).toMatchObject({ status: 'divergente' });
    expect(getAttr(participation(sim.state.root), 'CODIGO-UNIDADE')).toBe('');
  });
});
