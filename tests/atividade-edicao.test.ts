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
    ).toMatch(/busca de órgãos/);
    expect(
      plan((root) => setAttr(estagio(root), 'ANO-INICIO', '2001'), { editAtividades: false })
        .unsupported[0]?.reason,
    ).toMatch(/atividade da atuação vai à mão/);
  });

  it('ensino, pesquisa e treinamento ficam à mão: a grade deles não foi lida', () => {
    const xml = XML.replace(
      /<ATIVIDADES-DE-ESTAGIO>.*<\/ATIVIDADES-DE-ESTAGIO>/,
      '<ATIVIDADES-DE-ENSINO><ENSINO SEQUENCIA-FUNCAO-ATIVIDADE="1" FLAG-PERIODO="ANTERIOR" ANO-INICIO="2002" ANO-FIM="2004"/></ATIVIDADES-DE-ENSINO>',
    );
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    setAttr(
      findIn(working, (e) => e.name === 'ENSINO')!,
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

  it('a grade de descrições como o check() a monta', () => {
    expect(
      specFromRows([
        { c: '1', l: 'Uma' },
        { c: '0', l: 'Nova' },
      ]),
    ).toBe('1@1?Uma!2@0?Nova!3@?!4@?!5@?!6@?!7@?!8@?!');
  });
});

describe('atividade: o envio', () => {
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
});
