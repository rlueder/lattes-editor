// Atividades novas das naturezas com órgão (create-cargo.ts), incluídas numa
// atuação que já está no Lattes, contra o Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp } from '../src/bridge/apply.ts';
import { DESCRIPTION_UNREAD } from '../src/bridge/create-atividade.ts';
import { ORGAN_BY_HAND } from '../src/bridge/create-cargo.ts';
import { ALL_ON, OLD_EXTENSION, planChanges, planOptionsFor } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import {
  childElements,
  element,
  getAttr,
  setAttr,
  walk,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import {
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));
/** A instituição com órgãos no simulado (scripts/lattes-simulado/buscas.ts). */
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

async function start() {
  open = await withLattesSimulado();
  setAttr(atuacao1(open.state.root), 'CODIGO-INSTITUICAO', UFRGS);
  return open;
}

const ORGAN = { 'CODIGO-ORGAO': '000001000008', 'NOME-ORGAO': 'Instituto de Biociências' };

const direcao = (attrs: Record<string, string> = {}) =>
  element('ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO', {}, [
    element('DIRECAO-E-ADMINISTRACAO', {
      'ANO-INICIO': '2021',
      'CARGO-OU-FUNCAO': 'Coordenação do curso',
      'FLAG-PERIODO': 'ATUAL',
      'SEQUENCIA-FUNCAO-ATIVIDADE': '91',
      ...ORGAN,
      ...attrs,
    }),
  ]);

const pesquisa = (linha: Record<string, string> = {}) =>
  element('ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO', {}, [
    element(
      'PESQUISA-E-DESENVOLVIMENTO',
      { 'ANO-INICIO': '2022', 'SEQUENCIA-FUNCAO-ATIVIDADE': '92', ...ORGAN },
      [
        element('LINHA-DE-PESQUISA', {
          'SEQUENCIA-LINHA': '1',
          'TITULO-DA-LINHA-DE-PESQUISA': 'Genética de populações',
          ...linha,
        }),
      ],
    ),
  ]);

async function plan(edit: (doc: XDocument) => void, options = ALL_ON, fromExtension = false) {
  const original = await loadCv(DEMO, 'demo.xml');
  setAttr(atuacao1(original.doc.root), 'CODIGO-INSTITUICAO', UFRGS);
  const working = structuredClone(original.doc);
  edit(working);
  const entries = diffDocuments(original.doc.root, working.root).map((change) => ({
    change,
    itemTitle: '',
  }));
  return planChanges(entries, working.root, options, fromExtension);
}

describe('atividade nova com órgão: o plano', () => {
  it('a descrição numa linha, o período e o órgão escolhido na lista', async () => {
    const { ops, unsupported } = await plan((doc) => atuacao1(doc.root).children.push(direcao()));
    expect(unsupported).toEqual([]);
    expect(ops[0]).toMatchObject({
      kind: 'criar-atividade',
      natur: '1',
      organ: { code: '000001000008' },
      set: {
        f_ano_ini: '2021',
        f_espec_l: expect.stringMatching(/^1@0\?Coordenação do curso!2@\?!/),
        f_status: 'S',
      },
    });
  });

  it('as linhas de pesquisa e os treinamentos vão na grade; a unidade leva o órgão de cima', async () => {
    const unit = { 'CODIGO-UNIDADE': '000001001004', 'NOME-UNIDADE': 'Departamento de Genética' };
    const p = await plan((doc) => {
      const item = pesquisa();
      for (const [k, v] of Object.entries(unit)) setAttr(childElements(item)[0]!, k, v);
      atuacao1(doc.root).children.push(item);
    });
    expect(p.ops[0]).toMatchObject({
      natur: '2',
      organ: { code: '000001001004', parent: '000001000008' },
      set: { f_espec_l: expect.stringMatching(/^1@0\?Genética de populações!/) },
    });
    const t = await plan((doc) =>
      atuacao1(doc.root).children.push(
        element('ATIVIDADES-DE-TREINAMENTO-MINISTRADO', {}, [
          element(
            'TREINAMENTO-MINISTRADO',
            { 'ANO-INICIO': '2023', 'SEQUENCIA-FUNCAO-ATIVIDADE': '93', ...ORGAN },
            [
              element('TREINAMENTO', { 'SEQUENCIA-ESPECIFICACAO': '1' }, [
                { kind: 'text', value: 'Oficina de R' },
              ]),
            ],
          ),
        ]),
      ),
    );
    expect(t.ops[0]).toMatchObject({
      natur: '8',
      set: { f_espec_l: expect.stringMatching(/^1@0\?Oficina de R!/) },
    });
  });

  it('sem órgão, sem descrição, com objetivo da linha ou sem a capacidade: à mão', async () => {
    const reason = async (item: XElement) =>
      (await plan((doc) => atuacao1(doc.root).children.push(item))).unsupported[0]?.reason;
    expect(await reason(direcao({ 'CODIGO-ORGAO': '', 'NOME-ORGAO': '' }))).toBe(ORGAN_BY_HAND);
    expect(await reason(direcao({ 'CODIGO-ORGAO': '' }))).toMatch(/escolha pela lista do Lattes/);
    expect(await reason(direcao({ 'CARGO-OU-FUNCAO': '' }))).toMatch(/ao menos uma descrição/);
    expect(await reason(direcao({ 'CARGO-OU-FUNCAO': 'a@b' }))).toMatch(/separador/);
    const english = await plan((doc) =>
      atuacao1(doc.root).children.push(direcao({ 'CARGO-OU-FUNCAO-INGLES': 'Head' })),
    );
    expect(english.ops[0]).toMatchObject({ left: [expect.stringMatching(/ingl/i)] });
    expect(await reason(pesquisa({ 'OBJETIVOS-LINHA-DE-PESQUISA': 'Estudar' }))).toMatch(
      /tela de linhas de pesquisa depois de criar/,
    );
    const old = planOptionsFor(['incluir-itens']);
    const fromOld = await plan((doc) => atuacao1(doc.root).children.push(direcao()), old, true);
    expect(fromOld.unsupported[0]?.reason).toBe(OLD_EXTENSION);
  });
});

describe('atividade nova com órgão no Lattes simulado', () => {
  it('abre o formulário da natureza, escolhe o órgão na janela e confere', async () => {
    const lattes = await start();
    const { ops } = await plan((doc) => atuacao1(doc.root).children.push(direcao()));
    const [r] = await applyAll(ops, lattes.port);
    expect(r).toMatchObject({ status: 'conferido' });
    expect(r!.detail).toBe(
      `${DESCRIPTION_UNREAD} (atividade ${r!.assigned!['SEQUENCIA-FUNCAO-ATIVIDADE']})`,
    );
    const post = postsOf(lattes).at(-1)!;
    expect(post.fields).toMatchObject({
      f_codorgao: '000001000008',
      f_ctr: 'I',
      f_natur_ativ: '1',
      f_orgao_old: 'Instituto de Biociências',
    });
    const novo = childElements(
      childElements(atuacao1(lattes.state.root), 'ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO')[0]!,
    ).at(-1)!;
    expect(getAttr(novo, 'CARGO-OU-FUNCAO')).toBe('Coordenação do curso');
    expect(getAttr(novo, 'CODIGO-ORGAO')).toBe('000001000008');
    // De novo: a mesma natureza e o mesmo início já estão lá.
    expect(await applyOp(ops[0]!, lattes.port)).toMatchObject({ status: 'divergente' });
  });

  it('órgão fora da janela da instituição: nada vai', async () => {
    const lattes = await start();
    const { ops } = await plan((doc) =>
      atuacao1(doc.root).children.push(direcao({ 'CODIGO-ORGAO': '000009000009' })),
    );
    const posts = lattes.state.log.filter((l) => l.method === 'POST').length;
    expect(await applyOp(ops[0]!, lattes.port)).toMatchObject({ status: 'erro' });
    expect(lattes.state.log.filter((l) => l.method === 'POST').length).toBe(posts);
  });
});
