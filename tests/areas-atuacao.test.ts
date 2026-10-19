// Áreas de atuação pelo conector (src/bridge/areas-atuacao.ts), contra o
// Lattes simulado, que tem a página e o envio no formato lido em 18/10/2026.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { areaCode, type AreasOp } from '../src/bridge/areas-atuacao.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
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
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const area = (seq: string, area: string, sub = '') =>
  `<AREA-DE-ATUACAO SEQUENCIA-AREA-DE-ATUACAO="${seq}" NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_BIOLOGICAS" NOME-DA-AREA-DO-CONHECIMENTO="${area}" NOME-DA-SUB-AREA-DO-CONHECIMENTO="${sub}" NOME-DA-ESPECIALIDADE=""/>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"><AREAS-DE-ATUACAO>${area('1', 'Genética')}${area('2', 'Área Criada Pela Pessoa')}</AREAS-DE-ATUACAO></DADOS-GERAIS></CURRICULO-VITAE>`;

const ON: PlanOptions = { editAreas: true };

const areasOf = (root: XElement) =>
  childElements(
    findIn(root, (e) => e.name === 'AREAS-DE-ATUACAO')!,
    'AREA-DE-ATUACAO',
  );

const names = (root: XElement) =>
  areasOf(root).map((a) =>
    [
      getAttr(a, 'NOME-DA-AREA-DO-CONHECIMENTO'),
      getAttr(a, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO'),
    ].join(' › '),
  );

function planAfter(edit: (root: XElement) => void, options: PlanOptions = ON) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Áreas' })),
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

const toSub = (root: XElement) =>
  setAttr(areasOf(root)[0]!, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO', 'Genética Vegetal');

describe('áreas de atuação: o plano', () => {
  it('uma troca vira a lista inteira, com a de antes', () => {
    const plan = planAfter(toSub);
    expect(plan.unsupported).toEqual([]);
    const op = plan.ops[0] as AreasOp;
    expect(op.kind).toBe('areas-atuacao');
    expect(op.before.map((r) => r.subArea)).toEqual(['', '']);
    expect(op.after.map((r) => r.subArea)).toEqual(['Genética Vegetal', '']);
  });

  it('a área nova e a tirada entram na mesma lista; o antes desfaz as duas', () => {
    const plan = planAfter((root) => {
      const container = findIn(root, (e) => e.name === 'AREAS-DE-ATUACAO')!;
      container.children = container.children.filter((c) => c !== areasOf(root)[1]);
      container.children.push(
        element('AREA-DE-ATUACAO', {
          'NOME-DA-AREA-DO-CONHECIMENTO': 'Botânica',
          'NOME-DA-ESPECIALIDADE': '',
          'NOME-DA-SUB-AREA-DO-CONHECIMENTO': '',
          'NOME-GRANDE-AREA-DO-CONHECIMENTO': 'CIENCIAS_BIOLOGICAS',
          'SEQUENCIA-AREA-DE-ATUACAO': '3',
        }),
      );
    });
    expect(plan.unsupported).toEqual([]);
    for (const op of plan.ops as AreasOp[]) {
      expect(op.before.map((r) => r.area)).toEqual(['Genética', 'Área Criada Pela Pessoa']);
      expect(op.after.map((r) => r.area)).toEqual(['Genética', 'Botânica']);
    }
  });

  it('sem a chave, fica à mão como antes; só a grande área não vai', () => {
    expect(planAfter(toSub, {}).unsupported[0]?.reason).toMatch(/área de atuação vai à mão/);
    const plan = planAfter((root) =>
      setAttr(areasOf(root)[0]!, 'NOME-DA-AREA-DO-CONHECIMENTO', ''),
    );
    expect(plan.unsupported[0]?.reason).toMatch(/só a grande área/);
  });

  it('o código sai da árvore pelos nomes, sem acento nem caixa', () => {
    const tree = [
      {
        b: [{ b: [{ c: '20201001', l: 'Genética Vegetal' }], c: '20200005', l: 'Genética' }],
        c: '20000006',
        l: 'Ciências Biológicas',
      },
    ];
    const row = { area: 'genetica', bigArea: 'CIENCIAS_BIOLOGICAS', specialty: '', subArea: '' };
    expect(areaCode(tree, row)).toBe('20200005');
    expect(areaCode(tree, { ...row, subArea: 'Genética Vegetal' })).toBe('20201001');
    expect(areaCode(tree, { ...row, area: 'Outra' })).toBeUndefined();
  });
});

describe('áreas de atuação: o envio', () => {
  it('grava a lista, mantém a área criada pela pessoa e confere', async () => {
    const sim = await lattes();
    const [op] = planAfter(toSub).ops;
    expect(await applyOp(op!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(names(sim.state.root)).toEqual([
      'Genética › Genética Vegetal',
      'Área Criada Pela Pessoa › ',
    ]);
    const post = postsOf(sim).at(-1)!;
    expect(post.fields).toMatchObject({
      f_area_l: 'Genética Vegetal|20201001@Área Criada Pela Pessoa|99990002',
      f_ctr: 'I',
      f_privacidade: '1@1',
    });
    // A segunda operação da mesma fila acha o Lattes já assim.
    expect(await applyOp(op!, sim.port)).toMatchObject({
      detail: 'O Lattes já estava assim; nada foi enviado',
      status: 'conferido',
    });
  });

  it('o Lattes com outra lista, ou uma área fora da tabela: nada vai', async () => {
    const sim = await lattes();
    setAttr(areasOf(sim.state.root)[1]!, 'NOME-DA-AREA-DO-CONHECIMENTO', 'Outra Criada');
    const [stale] = planAfter(toSub).ops;
    expect(await applyOp(stale!, sim.port)).toMatchObject({ status: 'divergente' });
    const fresh = await lattes();
    const [unknown] = planAfter((root) =>
      setAttr(areasOf(root)[0]!, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO', 'Inexistente'),
    ).ops;
    expect(await applyOp(unknown!, fresh.port)).toMatchObject({
      detail: expect.stringMatching(/fora da tabela/),
      status: 'erro',
    });
    expect(postsOf(fresh)).toEqual([]);
  });
});
