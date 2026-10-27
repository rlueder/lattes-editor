// O projeto novo com equipe, financiador, produção ligada e órgão
// (create-projeto-extras.ts), contra o Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { ALL_ON, planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { childElements, element, getAttr, setAttr, walk, type XElement } from '../src/model/xml.ts';
import {
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));
const UFRGS = '000000000001';

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

function atuacao1(root: XElement): XElement {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '1') {
      hit = el;
    }
  });
  return hit!;
}

const projetoNovo = (owner: string) =>
  element('ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO', {}, [
    element(
      'PARTICIPACAO-EM-PROJETO',
      {
        'ANO-INICIO': '2026',
        'CODIGO-ORGAO': '000001000008',
        'NOME-ORGAO': 'Instituto de Biociências',
        'SEQUENCIA-FUNCAO-ATIVIDADE': '20',
      },
      [
        element(
          'PROJETO-DE-PESQUISA',
          {
            'ANO-INICIO': '2026',
            NATUREZA: 'PESQUISA',
            'NOME-DO-PROJETO': 'Projeto com equipe',
            'SEQUENCIA-PROJETO': '20',
            SITUACAO: 'EM_ANDAMENTO',
          },
          [
            element('EQUIPE-DO-PROJETO', {}, [
              element('INTEGRANTES-DO-PROJETO', {
                'FLAG-RESPONSAVEL': 'SIM',
                'NOME-COMPLETO': owner,
                'ORDEM-DE-INTEGRACAO': '1',
              }),
              element('INTEGRANTES-DO-PROJETO', {
                'FLAG-RESPONSAVEL': 'NAO',
                'NOME-COMPLETO': 'Coautora de Exemplo',
                'NOME-PARA-CITACAO': 'EXEMPLO, C.',
                'ORDEM-DE-INTEGRACAO': '2',
              }),
            ]),
            element('FINANCIADORES-DO-PROJETO', {}, [
              element('FINANCIADOR-DO-PROJETO', {
                NATUREZA: 'BOLSA',
                'NOME-INSTITUICAO': 'Universidade de São Paulo',
                'SEQUENCIA-FINANCIADOR': '1',
              }),
            ]),
            element('PRODUCOES-CT-DO-PROJETO', {}, [
              element('PRODUCAO-CT-DO-PROJETO', { 'SEQUENCIA-PRODUCAO-CT': '4' }),
            ]),
          ],
        ),
      ],
    ),
  ]);

describe('projeto novo com equipe, financiador e produção ligada', () => {
  it('vai pela inclusão com as grades, e a releitura confere', async () => {
    open = await withLattesSimulado();
    setAttr(atuacao1(open.state.root), 'CODIGO-INSTITUICAO', UFRGS);
    const original = (await loadCv(DEMO, 'demo.xml')).doc.root;
    setAttr(atuacao1(original), 'CODIGO-INSTITUICAO', UFRGS);
    const working = structuredClone(original);
    const owner = getAttr(childElements(working, 'DADOS-GERAIS')[0]!, 'NOME-COMPLETO') ?? '';
    atuacao1(working).children.push(projetoNovo(owner));
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
      working,
      ALL_ON,
    );
    expect(plan.unsupported).toEqual([]);
    const [r] = await applyAll(plan.ops, open.port);
    expect(r).toMatchObject({ status: 'conferido' });
    expect(postsOf(open).at(-1)!.fields).toMatchObject({
      f_codorgao: '000001000008',
      f_inst_l: 'V000000000002|;N;|||B|@',
      f_producoes_d: '4',
      f_producoes_l: '4@',
    });
    let projeto: XElement | undefined;
    walk(open.state.root, (el) => {
      if (
        el.name === 'PROJETO-DE-PESQUISA' &&
        getAttr(el, 'NOME-DO-PROJETO') === 'Projeto com equipe'
      ) {
        projeto = el;
      }
    });
    const team = childElements(childElements(projeto!, 'EQUIPE-DO-PROJETO')[0]!);
    expect(team.map((m) => getAttr(m, 'NOME-COMPLETO'))).toEqual([owner, 'Coautora de Exemplo']);
    expect(
      childElements(childElements(projeto!, 'FINANCIADORES-DO-PROJETO')[0]!).map((f) =>
        getAttr(f, 'NOME-INSTITUICAO'),
      ),
    ).toEqual(['Universidade de São Paulo']);
  });
});
