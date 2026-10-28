// Alterar uma atividade de uma atuação (src/bridge/edit-atividade.ts), contra
// o Lattes simulado, com a página de edição como a real foi lida em 19/10/2026.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { specFromRows } from '../src/bridge/edit-atividade.ts';
import { encodeLatin1Form, setPairs, successfulPairs } from '../src/bridge/form.ts';
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

  it('pesquisa e treinamento: o período vai, e a grade volta como estava', async () => {
    const xml = XML.replace(
      /<ATIVIDADES-DE-ESTAGIO>.*<\/ATIVIDADES-DE-ESTAGIO>/,
      '<ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO><PESQUISA-E-DESENVOLVIMENTO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" ANO-INICIO="2002" ANO-FIM="2004" CODIGO-ORGAO="000300000995" NOME-ORGAO="Empresa"><LINHA-DE-PESQUISA SEQUENCIA-LINHA="1" TITULO-DA-LINHA-DE-PESQUISA="Interfaces" OBJETIVOS-LINHA-DE-PESQUISA="Estudar interfaces"/></PESQUISA-E-DESENVOLVIMENTO></ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO>' +
        '<ATIVIDADES-DE-TREINAMENTO-MINISTRADO><TREINAMENTO-MINISTRADO SEQUENCIA-FUNCAO-ATIVIDADE="2" FLAG-PERIODO="ANTERIOR" ANO-INICIO="2003" ANO-FIM="2003" CODIGO-ORGAO="000300000995" NOME-ORGAO="Empresa"><TREINAMENTO SEQUENCIA-ESPECIFICACAO="1">Oficina de design</TREINAMENTO></TREINAMENTO-MINISTRADO></ATIVIDADES-DE-TREINAMENTO-MINISTRADO>',
    );
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xml}`),
    });
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    const pd = (root: XElement) => findIn(root, (e) => e.name === 'PESQUISA-E-DESENVOLVIMENTO')!;
    const tr = (root: XElement) => findIn(root, (e) => e.name === 'TREINAMENTO-MINISTRADO')!;
    setAttr(pd(working), 'ANO-FIM', '2005');
    setAttr(tr(working), 'ANO-FIM', '2004');
    const { ops, unsupported } = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
    expect(unsupported).toEqual([]);
    expect(ops).toHaveLength(2);
    for (const op of ops) {
      expect(await applyOp(op, open.port)).toMatchObject({ status: 'conferido' });
    }
    expect(getAttr(pd(open.state.root), 'ANO-FIM')).toBe('2005');
    const line = findIn(pd(open.state.root), (e) => e.name === 'LINHA-DE-PESQUISA')!;
    expect(getAttr(line, 'TITULO-DA-LINHA-DE-PESQUISA')).toBe('Interfaces');
    expect(getAttr(line, 'OBJETIVOS-LINHA-DE-PESQUISA')).toBe('Estudar interfaces');
    expect(getAttr(tr(open.state.root), 'ANO-FIM')).toBe('2004');
    expect(findIn(tr(open.state.root), (e) => e.name === 'TREINAMENTO')).toBeDefined();
    expect(postsOf(open).map((p) => p.fields.f_espec_l)).toEqual([
      '1@1?Interfaces!2@?!3@?!4@?!5@?!6@?!7@?!8@?!',
      '1@1?Oficina de design!2@?!3@?!4@?!5@?!6@?!7@?!8@?!',
    ]);
  });

  it('o simulado grava a grade de linhas de pesquisa como chegou', async () => {
    const xml = XML.replace(
      /<ATIVIDADES-DE-ESTAGIO>.*<\/ATIVIDADES-DE-ESTAGIO>/,
      '<ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO><PESQUISA-E-DESENVOLVIMENTO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" ANO-INICIO="2002" ANO-FIM="2004" CODIGO-ORGAO="000300000995" NOME-ORGAO="Empresa">' +
        '<LINHA-DE-PESQUISA SEQUENCIA-LINHA="1" TITULO-DA-LINHA-DE-PESQUISA="Sai" OBJETIVOS-LINHA-DE-PESQUISA="Objetivo A"/>' +
        '<LINHA-DE-PESQUISA SEQUENCIA-LINHA="3" TITULO-DA-LINHA-DE-PESQUISA="Fica" OBJETIVOS-LINHA-DE-PESQUISA="Objetivo B"/>' +
        '</PESQUISA-E-DESENVOLVIMENTO></ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO>',
    );
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xml}`),
    });
    const path = `PKG_ATIV.cargo?f_cod=${open.state.code}&f_natur_ativ=2&f_seq_ativ=1&f_codinst=D000300000995&f_seq_funcao=1`;
    const html = await open.port.get(path);
    const pairs = successfulPairs(open.port.readForm(html, 'GN_ATIV_CARGO')!);
    // A linha 3 renomeada, uma nova (c 0) e um c repetido no mesmo envio.
    const grid = '1@3?Renomeada!2@0?Nova!3@3?Repetida!4@?!5@?!6@?!7@?!8@?!';
    await open.port.post('PKG_ATIV.cargo', encodeLatin1Form(setPairs(pairs, { f_espec_l: grid })));
    const pd = findIn(open.state.root, (e) => e.name === 'PESQUISA-E-DESENVOLVIMENTO')!;
    const lines = pd.children
      .filter((c): c is XElement => c.kind === 'element')
      .map((l) => [
        getAttr(l, 'SEQUENCIA-LINHA'),
        getAttr(l, 'TITULO-DA-LINHA-DE-PESQUISA'),
        getAttr(l, 'OBJETIVOS-LINHA-DE-PESQUISA'),
      ]);
    expect(lines).toEqual([
      ['3', 'Renomeada', 'Objetivo B'],
      ['4', 'Nova', undefined],
      ['5', 'Repetida', undefined],
    ]);
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

  it('sem o código na volta, a unidade confere pelo texto que a página mostra', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${ORGAN_XML}`),
    });
    const original = parseXml(ORGAN_XML).root;
    const working = parseXml(ORGAN_XML).root;
    setAttr(estagio(working), 'CODIGO-ORGAO', '000001000008');
    setAttr(estagio(working), 'NOME-ORGAO', 'Instituto de Biociências');
    setAttr(estagio(working), 'CODIGO-UNIDADE', '000001001004');
    setAttr(estagio(working), 'NOME-UNIDADE', 'Departamento de Genética');
    const { ops } = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
    // Uma página que, depois do envio, devolve o oculto vazio e só "/Unidade".
    let posted = false;
    const port = {
      ...open.port,
      get: async (path: string) => {
        const html = await open!.port.get(path);
        return posted ? html.replace(/(name="f_codorgao" value=")[^"]*/, '$1') : html;
      },
      post: async (path: string, body: string) => {
        posted = true;
        return open!.port.post(path, body);
      },
    };
    expect(await applyOp(ops[0]!, port)).toMatchObject({ status: 'conferido' });
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

/** Ensino de pós-graduação numa instituição com cursos no simulado (buscas.ts). */
const TEACH_XML = ENSINO_XML.replace(
  'CODIGO-INSTITUICAO="000300000995"',
  'CODIGO-INSTITUICAO="000000000001"',
).replace(
  'TIPO-ENSINO="OUTRO"',
  'TIPO-ENSINO="POS-GRADUACAO" CODIGO-CURSO="00000001" NOME-CURSO="Genética e Biologia Molecular"',
);

describe('ensino: nível e curso', () => {
  const ensino = (root: XElement) => findIn(root, (e) => e.name === 'ENSINO')!;
  const planTeach = (edit: (el: XElement) => void, xml = TEACH_XML) => {
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    edit(ensino(working));
    return planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Atividade' })),
      working,
      { editAtividades: true },
    );
  };

  it('o curso novo da lista vai pelo código; só o nome, ou o nível sem curso, à mão', () => {
    const { ops, unsupported } = planTeach((el) => {
      setAttr(el, 'CODIGO-CURSO', '00000002');
      setAttr(el, 'NOME-CURSO', 'Botânica');
    });
    expect(unsupported).toEqual([]);
    expect(ops[0]).toMatchObject({
      course: { code: '00000002' },
      expect: { f_curso: 'Genética e Biologia Molecular' },
    });
    expect(planTeach((el) => setAttr(el, 'NOME-CURSO', 'Outro')).unsupported[0]?.reason).toMatch(
      /escolha pela lista do Lattes/,
    );
    expect(
      planTeach((el) => setAttr(el, 'TIPO-ENSINO', 'ENSINO-MEDIO')).unsupported[0]?.reason,
    ).toMatch(/não aceita curso neste nível/);
    expect(
      planTeach((el) => setAttr(el, 'TIPO-ENSINO', 'GRADUACAO'), ENSINO_XML).unsupported[0]?.reason,
    ).toMatch(/exige o curso neste nível/);
    // Outro nível com curso: o curso vai de novo, pela lista do nível novo.
    expect(planTeach((el) => setAttr(el, 'TIPO-ENSINO', 'GRADUACAO')).ops[0]).toMatchObject({
      course: { code: '00000001' },
      expect: { f_nivel: '402' },
      set: { f_nivel: '401' },
    });
  });

  it('no Lattes simulado: o curso sai da lista, grava e confere pelo texto', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${TEACH_XML}`),
    });
    // O link da atuação com a letra V, como a busca de cursos do simulado a quer.
    const atuacao = findIn(open.state.root, (e) => e.name === 'ATUACAO-PROFISSIONAL')!;
    setAttr(atuacao, 'CODIGO-INSTITUICAO', 'V000000000001');
    const { ops } = planTeach((el) => {
      setAttr(el, 'CODIGO-CURSO', '00000002');
      setAttr(el, 'NOME-CURSO', 'Botânica');
    });
    expect(await applyOp(ops[0]!, open.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(open).at(-1)!.fields).toMatchObject({ f_cod_curso: '00000002' });
    expect(getAttr(ensino(open.state.root), 'NOME-CURSO')).toBe('Botânica');
    // De novo, com o Lattes já em outro curso que o de antes do editor: nada vai.
    const missing = planTeach((el) => {
      setAttr(el, 'CODIGO-CURSO', '99999999');
      setAttr(el, 'NOME-CURSO', 'Fantasia');
    }).ops[0]!;
    const posts = postsOf(open).length;
    expect(await applyOp(missing, open.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(open)).toHaveLength(posts);
  });
});
