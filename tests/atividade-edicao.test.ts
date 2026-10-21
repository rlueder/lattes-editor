// Alterar uma atividade de uma atuação (src/bridge/edit-atividade.ts), contra
// o Lattes simulado, com a página de edição como a real foi lida em 19/10/2026.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { specFromRows } from '../src/bridge/edit-atividade.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"><ATUACOES-PROFISSIONAIS>
<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="000300000995" NOME-INSTITUICAO="Empresa" SEQUENCIA-ATIVIDADE="1">
<VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2002"/>
<ATIVIDADES-DE-ESTAGIO><ESTAGIO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" MES-INICIO="10" ANO-INICIO="2002" MES-FIM="10" ANO-FIM="2004" CODIGO-ORGAO="000300000995" NOME-ORGAO="Empresa" ESTAGIO-REALIZADO="Estágio (design)"/></ATIVIDADES-DE-ESTAGIO>
</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`;

const estagio = (root: XElement) => findIn(root, (e) => e.name === 'ESTAGIO')!;

function plan(edit: (root: XElement) => void, options = { editAtividades: true }) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
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

async function lattes() {
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

describe('atividade: o plano', () => {
  it('período e descrição viram a operação; o atual limpa o fim', () => {
    const { ops, unsupported } = plan((root) => {
      setAttr(estagio(root), 'ESTAGIO-REALIZADO', 'Estágio em design');
      setAttr(estagio(root), 'FLAG-PERIODO', 'ATUAL');
    });
    expect(unsupported).toEqual([]);
    expect(ops[0]).toMatchObject({
      description: { after: 'Estágio em design', before: 'Estágio (design)' },
      kind: 'atividade',
      natur: '5',
      seqAtiv: '1',
      seqFuncao: '1',
      set: { f_ano_fim: '', f_mes_fim: '', f_status: 'S' },
    });
  });

  it('o órgão fica à mão, e sem a chave tudo fica', () => {
    expect(
      plan((root) => setAttr(estagio(root), 'NOME-ORGAO', 'Outra')).unsupported[0]?.reason,
    ).toMatch(/lista do Lattes/);
    expect(
      plan((root) => setAttr(estagio(root), 'ANO-INICIO', '2001'), { editAtividades: false })
        .unsupported[0]?.reason,
    ).toMatch(/atividade da atuação vai à mão/);
  });

  it('pesquisa e treinamento ficam à mão: a grade deles não foi lida na edição', () => {
    const xml = XML.replace(
      /<ATIVIDADES-DE-ESTAGIO>.*<\/ATIVIDADES-DE-ESTAGIO>/,
      '<ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO><PESQUISA-E-DESENVOLVIMENTO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" ANO-INICIO="2002" ANO-FIM="2004"/></ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO>',
    );
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    setAttr(
      findIn(working, (e) => e.name === 'PESQUISA-E-DESENVOLVIMENTO')!,
      'ANO-FIM',
      '2005',
    );
    const { ops, unsupported } = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
    expect(ops).toEqual([]);
    expect(unsupported[0]?.reason).toMatch(/ainda não foi lido/);
  });

  it('a descrição apagada fica à mão: o Lattes exige uma', () => {
    const { ops, unsupported } = plan((root) => setAttr(estagio(root), 'ESTAGIO-REALIZADO', ''));
    expect(ops).toEqual([]);
    expect(unsupported[0]?.reason).toMatch(/exige a descrição/);
  });

  it('a grade de descrições como o check() a monta', () => {
    expect(
      specFromRows([
        { c: '1', l: 'Uma' },
        { c: '0', l: 'Nova' },
      ]),
    ).toBe('1@1?Uma!2@0?Nova!3@?!4@?!5@?!6@?!7@?!8@?!');
  });
});

const ENSINO_XML = XML.replace(
  /<ATIVIDADES-DE-ESTAGIO>.*<\/ATIVIDADES-DE-ESTAGIO>/,
  '<ATIVIDADES-DE-ENSINO><ENSINO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" MES-INICIO="02" ANO-INICIO="2002" MES-FIM="03" ANO-FIM="2004" TIPO-ENSINO="OUTRO"><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Disciplina um</DISCIPLINA><DISCIPLINA SEQUENCIA-ESPECIFICACAO="2">Disciplina dois</DISCIPLINA></ENSINO></ATIVIDADES-DE-ENSINO>',
);

const ORGAN_XML = XML.replace(
  'CODIGO-INSTITUICAO="000300000995"',
  'CODIGO-INSTITUICAO="000000000001"',
).replace(
  'CODIGO-ORGAO="000300000995" NOME-ORGAO="Empresa"',
  'CODIGO-ORGAO="000002000004" NOME-ORGAO="Instituto de Informática"',
);

describe('atividade: o envio', () => {
  it('o órgão novo vai pela janela de órgãos da atividade, com o código', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${ORGAN_XML}`),
    });
    const original = parseXml(ORGAN_XML).root;
    const working = parseXml(ORGAN_XML).root;
    setAttr(estagio(working), 'CODIGO-ORGAO', '000001000008');
    setAttr(estagio(working), 'NOME-ORGAO', 'Instituto de Biociências');
    const { ops, unsupported } = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
    expect(unsupported).toEqual([]);
    expect(await applyOp(ops[0]!, open.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(estagio(open.state.root), 'CODIGO-ORGAO')).toBe('000001000008');
    expect(postsOf(open).at(-1)!.fields.f_codorgao).toBe('000001000008');
  });

  it('a unidade vai com o órgão de cima, e a releitura confere o código dela', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${ORGAN_XML}`),
    });
    const original = parseXml(ORGAN_XML).root;
    const working = parseXml(ORGAN_XML).root;
    setAttr(estagio(working), 'CODIGO-ORGAO', '000001000008');
    setAttr(estagio(working), 'NOME-ORGAO', 'Instituto de Biociências');
    setAttr(estagio(working), 'CODIGO-UNIDADE', '000001001004');
    setAttr(estagio(working), 'NOME-UNIDADE', 'Departamento de Genética');
    const { ops, unsupported } = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
    expect(unsupported).toEqual([]);
    expect(await applyOp(ops[0]!, open.port)).toMatchObject({ status: 'conferido' });
    const saved = estagio(open.state.root);
    expect(getAttr(saved, 'CODIGO-UNIDADE')).toBe('000001001004');
    expect(getAttr(saved, 'NOME-UNIDADE')).toBe('Departamento de Genética');
    expect(getAttr(saved, 'CODIGO-ORGAO')).toBe('000001000008');
  });

  it('o órgão fora da janela, ou outro no Lattes: nada vai', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${ORGAN_XML}`),
    });
    const opFor = (code: string) => {
      const original = parseXml(ORGAN_XML).root;
      const working = parseXml(ORGAN_XML).root;
      setAttr(estagio(working), 'CODIGO-ORGAO', code);
      setAttr(estagio(working), 'NOME-ORGAO', 'Outro');
      return planChanges(
        diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
        working,
        { editAtividades: true },
      ).ops[0]!;
    };
    expect(await applyOp(opFor('999999999999'), open.port)).toMatchObject({ status: 'erro' });
    // Outro órgão no Lattes: a página devolve o código dele, e é ele que confere.
    setAttr(estagio(open.state.root), 'CODIGO-ORGAO', '000009000001');
    expect(await applyOp(opFor('000001000008'), open.port)).toMatchObject({
      status: 'divergente',
    });
    expect(postsOf(open)).toEqual([]);
  });

  it('o período do ensino vai, e as disciplinas voltam como estavam', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${ENSINO_XML}`),
    });
    const original = parseXml(ENSINO_XML).root;
    const working = parseXml(ENSINO_XML).root;
    const ensino = (root: XElement) => findIn(root, (e) => e.name === 'ENSINO')!;
    setAttr(ensino(working), 'ANO-FIM', '2005');
    const { ops, unsupported } = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
    expect(unsupported).toEqual([]);
    expect(await applyOp(ops[0]!, open.port)).toMatchObject({ status: 'conferido' });
    const saved = ensino(open.state.root);
    expect(getAttr(saved, 'ANO-FIM')).toBe('2005');
    expect(
      saved.children.flatMap((c) =>
        c.kind === 'element'
          ? [c.children.map((t) => (t.kind === 'text' ? t.value : '')).join('')]
          : [],
      ),
    ).toEqual(['Disciplina um', 'Disciplina dois']);
  });

  it('grava a descrição na mesma linha e o período, e confere', async () => {
    const sim = await lattes();
    const { ops } = plan((root) => {
      setAttr(estagio(root), 'ESTAGIO-REALIZADO', 'Estágio em design');
      setAttr(estagio(root), 'ANO-INICIO', '2001');
    });
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(estagio(sim.state.root), 'ESTAGIO-REALIZADO')).toBe('Estágio em design');
    expect(getAttr(estagio(sim.state.root), 'ANO-INICIO')).toBe('2001');
    expect(postsOf(sim).at(-1)!.fields.f_espec_l).toMatch(/^1@1\?Estágio em design!2@\?!/);
  });

  it('o Lattes com outra descrição: nada vai', async () => {
    const sim = await lattes();
    setAttr(estagio(sim.state.root), 'ESTAGIO-REALIZADO', 'Mudou no Lattes');
    const { ops } = plan((root) => setAttr(estagio(root), 'ESTAGIO-REALIZADO', 'Outra'));
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(sim)).toEqual([]);
  });

  it('o Lattes sem descrição, e o editor com uma: nada vai', async () => {
    const sim = await lattes();
    setAttr(estagio(sim.state.root), 'ESTAGIO-REALIZADO', '');
    const { ops } = plan((root) => setAttr(estagio(root), 'ESTAGIO-REALIZADO', 'Outra'));
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(sim)).toEqual([]);
  });
});
