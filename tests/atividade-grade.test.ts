// As linhas da grade de uma atividade que já está no Lattes
// (atividade-grade.ts): disciplinas, treinamentos e linhas de pesquisa
// incluídas, tiradas ou renomeadas, e o formulário da linha de pesquisa nova
// (linha-detalhes.ts), contra o Lattes simulado.

import { afterEach, describe, expect, it } from 'vitest';

import { applyAll } from '../src/bridge/apply.ts';
import { rowsToSend } from '../src/bridge/atividade-grade.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { ALL_ON, planChanges, planOptionsFor } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { element, getAttr, parseXml, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const ATUACAO = (inner: string) =>
  `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"><ATUACOES-PROFISSIONAIS>
<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="000300000995" NOME-INSTITUICAO="Empresa" SEQUENCIA-ATIVIDADE="1">
<VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2002"/>${inner}
</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`;

const ENSINO = ATUACAO(
  '<ATIVIDADES-DE-ENSINO><ENSINO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ATUAL" TIPO-ENSINO="EXTENSAO" ANO-INICIO="2010">' +
    '<DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Álgebra</DISCIPLINA>' +
    '<DISCIPLINA SEQUENCIA-ESPECIFICACAO="2">Cálculo</DISCIPLINA>' +
    '</ENSINO></ATIVIDADES-DE-ENSINO>',
);

const PESQUISA = ATUACAO(
  '<ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO><PESQUISA-E-DESENVOLVIMENTO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" ANO-INICIO="2002" ANO-FIM="2004" CODIGO-ORGAO="000300000995" NOME-ORGAO="Empresa">' +
    '<LINHA-DE-PESQUISA SEQUENCIA-LINHA="1" TITULO-DA-LINHA-DE-PESQUISA="Interfaces" OBJETIVOS-LINHA-DE-PESQUISA="Estudar interfaces"/>' +
    '</PESQUISA-E-DESENVOLVIMENTO></ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO>',
);

const find = (root: XElement, name: string) => findIn(root, (e) => e.name === name)!;
const kids = (el: XElement, name: string) =>
  el.children.filter((c): c is XElement => c.kind === 'element' && c.name === name);
const textOf = (el: XElement) =>
  el.children.map((c) => (c.kind === 'text' ? c.value : '')).join('');

function plan(xml: string, edit: (root: XElement) => void, options = ALL_ON) {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
    working,
    options,
  );
}

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattes(xml: string) {
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xml}`),
  });
  return open;
}

describe('grade da atividade: o plano', () => {
  it('as mudanças da mesma atividade viram a mesma grade', () => {
    const { ops, unsupported } = plan(ENSINO, (root) => {
      const ensino = find(root, 'ENSINO');
      const [algebra, calculo] = kids(ensino, 'DISCIPLINA');
      ensino.children = ensino.children.filter((c) => c !== algebra);
      calculo!.children = [{ kind: 'text', value: 'Cálculo I' }];
      ensino.children.push(
        element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': '9' }, [
          { kind: 'text', value: 'Geometria' },
        ]),
      );
    });
    expect(unsupported).toEqual([]);
    expect(ops).toHaveLength(3);
    for (const op of ops) {
      expect(op).toMatchObject({
        activityRows: {
          after: ['Cálculo I', 'Geometria'],
          before: ['Cálculo', 'Álgebra'],
          renamed: expect.arrayContaining([['Cálculo', 'Cálculo I']]),
        },
        kind: 'atividade',
        natur: '4',
        seqFuncao: '1',
      });
    }
    expect(opRows(ops[0]!)[0]).toMatchObject({
      after: 'Cálculo I; Geometria',
      label: 'Disciplinas',
    });
  });

  it('o que o Lattes não aceitaria, e a extensão sem a capacidade', () => {
    const drop = (root: XElement) => {
      const ensino = find(root, 'ENSINO');
      ensino.children = ensino.children.filter(
        (c) => c.kind !== 'element' || c.name !== 'DISCIPLINA',
      );
    };
    expect(plan(ENSINO, drop).unsupported[0]?.reason).toMatch(/ao menos uma linha/);
    const sep = plan(ENSINO, (root) => {
      kids(find(root, 'ENSINO'), 'DISCIPLINA')[0]!.children = [{ kind: 'text', value: 'A@B' }];
    });
    expect(sep.unsupported[0]?.reason).toMatch(/separador/);
    const old = plan(
      ENSINO,
      (root) =>
        find(root, 'ENSINO').children.push(
          element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': '3' }, [
            { kind: 'text', value: 'Nova' },
          ]),
        ),
      planOptionsFor(['alterar-atividades']),
    );
    expect(old.unsupported[0]?.reason).toMatch(/Linhas da atividade/);
  });

  it('a grade a mandar: mantém o c, a nova com 0, a que sai em f_exc', () => {
    const page = [
      { c: '1', l: 'Álgebra' },
      { c: '2', l: 'Cálculo' },
    ];
    const rows = { after: ['Cálculo I', 'Geometria'], before: ['Álgebra', 'Cálculo'] };
    expect(rowsToSend(page, { ...rows, renamed: [['Cálculo', 'Cálculo I']] })).toEqual({
      exc: '1?',
      wanted: [
        { c: '2', l: 'Cálculo I' },
        { c: '0', l: 'Geometria' },
      ],
    });
    expect(rowsToSend(page, { after: ['algebra', 'calculo'], before: [], renamed: [] })).toBe(
      'feito',
    );
    expect(rowsToSend(page, { after: ['X'], before: ['Y'], renamed: [] })).toBe('divergente');
  });
});

describe('grade da atividade no Lattes simulado', () => {
  it('disciplinas incluídas, tiradas e renomeadas num envio só', async () => {
    const sim = await lattes(ENSINO);
    const { ops } = plan(ENSINO, (root) => {
      const ensino = find(root, 'ENSINO');
      const [algebra, calculo] = kids(ensino, 'DISCIPLINA');
      ensino.children = ensino.children.filter((c) => c !== algebra);
      calculo!.children = [{ kind: 'text', value: 'Cálculo I' }];
      ensino.children.push(
        element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': '9' }, [
          { kind: 'text', value: 'Geometria' },
        ]),
      );
    });
    const results = await applyAll(ops, sim.port);
    expect(results.map((r) => r.status)).toEqual(['conferido', 'conferido', 'conferido']);
    // Só o primeiro envia; os outros acham o Lattes já como depois.
    const posts = postsOf(sim).filter((p) => p.fields.f_espec_l !== undefined);
    expect(posts.map((p) => [p.fields.f_espec_l, p.fields.f_exc])).toEqual([
      ['1@2?Cálculo I!2@0?Geometria!3@?!4@?!5@?!6@?!7@?!8@?!', '1?'],
    ]);
    const saved = kids(find(sim.state.root, 'ENSINO'), 'DISCIPLINA').map(textOf);
    expect(saved).toEqual(['Cálculo I', 'Geometria']);
  });

  it('a linha de pesquisa nova entra pela grade e leva os objetivos pelo formulário dela', async () => {
    const sim = await lattes(PESQUISA);
    const { ops, unsupported } = plan(PESQUISA, (root) =>
      find(root, 'PESQUISA-E-DESENVOLVIMENTO').children.push(
        element('LINHA-DE-PESQUISA', {
          'FLAG-LINHA-DE-PESQUISA-ATIVA': 'SIM',
          'OBJETIVOS-LINHA-DE-PESQUISA': 'Medir usabilidade',
          'SEQUENCIA-LINHA': '7',
          'TITULO-DA-LINHA-DE-PESQUISA': 'Acessibilidade',
        }),
      ),
    );
    expect(unsupported).toEqual([]);
    const [r] = await applyAll(ops, sim.port);
    expect(r).toMatchObject({ status: 'conferido' });
    const lines = kids(find(sim.state.root, 'PESQUISA-E-DESENVOLVIMENTO'), 'LINHA-DE-PESQUISA').map(
      (l) => [
        getAttr(l, 'TITULO-DA-LINHA-DE-PESQUISA'),
        getAttr(l, 'OBJETIVOS-LINHA-DE-PESQUISA'),
        getAttr(l, 'FLAG-LINHA-DE-PESQUISA-ATIVA'),
      ],
    );
    expect(lines).toEqual([
      ['Interfaces', 'Estudar interfaces', undefined],
      ['Acessibilidade', 'Medir usabilidade', 'SIM'],
    ]);
  });

  it('a grade do Lattes diferente da de antes: nada vai', async () => {
    const sim = await lattes(PESQUISA);
    const linha = find(sim.state.root, 'LINHA-DE-PESQUISA');
    linha.attrs = linha.attrs.map((a) =>
      a.name === 'TITULO-DA-LINHA-DE-PESQUISA' ? { ...a, value: 'Outra' } : a,
    );
    const { ops } = plan(PESQUISA, (root) =>
      find(root, 'PESQUISA-E-DESENVOLVIMENTO').children.push(
        element('LINHA-DE-PESQUISA', {
          'SEQUENCIA-LINHA': '7',
          'TITULO-DA-LINHA-DE-PESQUISA': 'Acessibilidade',
        }),
      ),
    );
    const [r] = await applyAll(ops, sim.port);
    expect(r).toMatchObject({ status: 'divergente' });
    expect(r!.detail).toMatch(/linhas da atividade/);
    expect(postsOf(sim).filter((p) => p.fields.f_espec_l !== undefined)).toEqual([]);
  });
});
