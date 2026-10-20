// Alterar patentes e registros pelo motor de produção
// (src/bridge/production/targets/registros.ts), contra o Lattes simulado, que
// tem as grades de depositantes e a de datas da patente como a edição real as
// trouxe em 19/10/2026 (scripts/lattes-simulado/registro-grades.ts).

import { afterEach, describe, expect, it } from 'vitest';

import { seedHolder, storedHolders } from '../scripts/lattes-simulado/registro-grades.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { yearFromDate } from '../src/bridge/production/targets/registros-paginas.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const AUTHOR = `<AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-TECNICA>
<PATENTE SEQUENCIA-PRODUCAO="7"><DADOS-BASICOS-DA-PATENTE TITULO="Uma patente" ANO-DESENVOLVIMENTO="2005" PAIS="Brasil"/><DETALHAMENTO-DA-PATENTE FINALIDADE="antes"><REGISTRO-OU-PATENTE TIPO-PATENTE="PRIVILEGIO_DE_INOVACAO_PI" CODIGO-DO-REGISTRO-OU-PATENTE="BR1" DATA-PEDIDO-DE-DEPOSITO="10032005" INSTITUICAO-DEPOSITO-REGISTRO="INPI"/></DETALHAMENTO-DA-PATENTE>${AUTHOR}</PATENTE>
<DESENHO-INDUSTRIAL SEQUENCIA-PRODUCAO="8"><DADOS-BASICOS-DO-DESENHO-INDUSTRIAL TITULO="Um desenho" ANO-DESENVOLVIMENTO="2005" PAIS="Brasil"/><DETALHAMENTO-DO-DESENHO-INDUSTRIAL FINALIDADE="antes" INSTITUICAO-FINANCIADORA="x"><REGISTRO-OU-PATENTE TIPO-PATENTE="DESENHO_INDUSTRIAL_DI" CODIGO-DO-REGISTRO-OU-PATENTE="DI1" DATA-PEDIDO-DE-DEPOSITO="10012005" INSTITUICAO-DEPOSITO-REGISTRO="INPI"/></DETALHAMENTO-DO-DESENHO-INDUSTRIAL>${AUTHOR}</DESENHO-INDUSTRIAL>
<MARCA SEQUENCIA-PRODUCAO="9"><DADOS-BASICOS-DA-MARCA TITULO="Uma marca" ANO-DESENVOLVIMENTO="2005" PAIS="Brasil"/><DETALHAMENTO-DA-MARCA NATUREZA="Figurativa"><REGISTRO-OU-PATENTE TIPO-PATENTE="MARCA_REGISTRADA_DE_PRODUTO_MPD" CODIGO-DO-REGISTRO-OU-PATENTE="MR1" INSTITUICAO-DEPOSITO-REGISTRO="INPI"/></DETALHAMENTO-DA-MARCA>${AUTHOR}</MARCA>
</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function opsAfter(edit: (root: XElement) => void): ProductionOp[] {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const plan = planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    { editProduction: true },
  );
  expect(plan.unsupported).toEqual([]);
  return plan.ops as ProductionOp[];
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

describe('patente', () => {
  it('título, finalidade e data de depósito vão, e o depositante fica', async () => {
    const sim = await lattes();
    seedHolder(byName(sim.state.root, 'PATENTE'), 'Depositante Sintético', 'SINTÉTICO, D.', '14');
    const ops = opsAfter((root) => {
      setAttr(byName(root, 'DADOS-BASICOS-DA-PATENTE'), 'TITULO', 'Outra patente');
      setAttr(byName(root, 'DETALHAMENTO-DA-PATENTE'), 'FINALIDADE', 'depois');
      setAttr(
        findIn(byName(root, 'PATENTE'), (e) => e.name === 'REGISTRO-OU-PATENTE')!,
        'DATA-PEDIDO-DE-DEPOSITO',
        '11032006',
      );
    });
    for (const op of ops)
      expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    const patent = byName(sim.state.root, 'PATENTE');
    expect(getAttr(byName(patent, 'DADOS-BASICOS-DA-PATENTE'), 'TITULO')).toBe('Outra patente');
    expect(getAttr(byName(patent, 'REGISTRO-OU-PATENTE'), 'DATA-PEDIDO-DE-DEPOSITO')).toBe(
      '11032006',
    );
    expect(storedHolders(patent)).toEqual(['Depositante Sintético']);
    const post = postsOf(sim).at(-1)!.fields;
    expect(post.f_depositante_pessoa_l).toBe('Depositante Sintético|14|SINTÉTICO, D.|N');
    expect(post.f_dados_grid_datas).toMatch(/<id>1<\/id>\r?\n\t<contato>Depósito<\/contato>/);
  });

  it('o ano não vai: sai da data de depósito', () => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(byName(working, 'DADOS-BASICOS-DA-PATENTE'), 'ANO-DESENVOLVIMENTO', '2004');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true },
    );
    expect(plan.unsupported[0]?.reason).toMatch(/não tem campo para o ano/);
  });
});

describe('registros', () => {
  it('desenho industrial: o envio leva o ano que a página tira da data', async () => {
    const sim = await lattes();
    const ops = opsAfter((root) =>
      setAttr(byName(root, 'DADOS-BASICOS-DO-DESENHO-INDUSTRIAL'), 'TITULO', 'Outro desenho'),
    );
    const r = await applyOp(ops[0]!, sim.port);
    expect(r.detail).toBe('Gravado e conferido no Lattes');
    expect(postsOf(sim).at(-1)!.fields.f_ano).toBe('2005');
  });

  it('marca: sem grade de depositantes na página, a natureza e o tipo vão', async () => {
    const sim = await lattes();
    const ops = opsAfter((root) => {
      setAttr(byName(root, 'DETALHAMENTO-DA-MARCA'), 'NATUREZA', 'Nominativa');
      setAttr(
        findIn(byName(root, 'MARCA'), (e) => e.name === 'REGISTRO-OU-PATENTE')!,
        'TIPO-PATENTE',
        'MARCA_REGISTRADA_DE_SERVICO_MSV',
      );
    });
    for (const op of ops)
      expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim).at(-1)!.fields).toMatchObject({ f_natureza: 'Nominativa', f_tipo: 'MSV' });
  });
});

describe('o ano que a página tira da data de depósito', () => {
  const page = (input: string) => `<script>\n  dc.f_ano.value = anoDep;\n</script>${input}`;

  it('acha a data em qualquer ordem de atributos', () => {
    expect(
      yearFromDate(page('<input value="11/03/2006" type="text" name="f_dta_dep">'), {}),
    ).toEqual({
      f_ano: '2006',
    });
    expect(yearFromDate(page('<input name="f_dta_dep" value="11/03/2006">'), {})).toEqual({
      f_ano: '2006',
    });
    expect(yearFromDate(page(''), { f_dta_dep: '01/02/2010' })).toEqual({ f_ano: '2010' });
  });

  it('sem a data, nada vai; e a página sem anoDep não pede o ano', () => {
    expect(yearFromDate(page('<input name="f_dta_dep" value="">'), {})).toBeUndefined();
    expect(yearFromDate('<input name="f_dta_dep" value="">', {})).toEqual({});
  });
});
