// Áreas do conhecimento e setores de atividade de produções e formações, e as
// grades da formação que todo envio leva (production/item-lists.ts,
// formacao-grids.ts), contra o Lattes simulado.

import { afterEach, describe, expect, it } from 'vitest';

import { storedGrids } from '../scripts/lattes-simulado/grades.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { readKeywords, setKeywords } from '../src/model/production.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import { element, getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética">
<FORMACAO-ACADEMICA-TITULACAO>
<MESTRADO SEQUENCIA-FORMACAO="3" NIVEL="3" CODIGO-INSTITUICAO="000000000001" NOME-INSTITUICAO="Universidade Federal do Rio Grande do Sul" CODIGO-CURSO="00000001" NOME-CURSO="Genética e Biologia Molecular" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2007" ANO-DE-CONCLUSAO="2009" FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="" ANO-DE-OBTENCAO-DO-TITULO="2009" TITULO-DA-DISSERTACAO-TESE="Dissertação" NOME-COMPLETO-DO-ORIENTADOR="Orientador B" TIPO-MESTRADO="N" NOME-DO-CO-ORIENTADOR=""><PALAVRAS-CHAVE PALAVRA-CHAVE-1="genética" PALAVRA-CHAVE-2="" PALAVRA-CHAVE-3="" PALAVRA-CHAVE-4="" PALAVRA-CHAVE-5="" PALAVRA-CHAVE-6=""/></MESTRADO>
</FORMACAO-ACADEMICA-TITULACAO></DADOS-GERAIS>
<PRODUCAO-TECNICA>
<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="31"><DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="ELABORACAO_DE_PROJETO" TITULO-DO-TRABALHO-TECNICO="Sistema de Exemplo" ANO="2005"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/></TRABALHO-TECNICO>
</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

const OPTIONS: PlanOptions = { biographicFull: true, biographicOps: true, editProduction: true };
const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function opsAfter(edit: (root: XElement) => void) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const plan = planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    OPTIONS,
  );
  expect(plan.unsupported).toEqual([]);
  return plan.ops;
}

const addArea = (item: string, area: string) => (root: XElement) => {
  const el = byName(root, item);
  insertInSchemaOrder(
    lattesSchema,
    el,
    element('AREAS-DO-CONHECIMENTO', {}, [
      element('AREA-DO-CONHECIMENTO-1', {
        'NOME-DA-AREA-DO-CONHECIMENTO': area,
        'NOME-DA-ESPECIALIDADE': '',
        'NOME-DA-SUB-AREA-DO-CONHECIMENTO': '',
        'NOME-GRANDE-AREA-DO-CONHECIMENTO': 'CIENCIAS_BIOLOGICAS',
      }),
    ]),
  );
};

const addSetor = (item: string, setor: string) => (root: XElement) => {
  insertInSchemaOrder(
    lattesSchema,
    byName(root, item),
    element('SETORES-DE-ATIVIDADE', {
      'SETOR-DE-ATIVIDADE-1': setor,
      'SETOR-DE-ATIVIDADE-2': '',
      'SETOR-DE-ATIVIDADE-3': '',
    }),
  );
};

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

describe('áreas e setores de uma produção', () => {
  it('a área nova sai da árvore do menu, e o setor da lista de setores', async () => {
    const sim = await lattes();
    const [area] = opsAfter(addArea('TRABALHO-TECNICO', 'Genética'));
    expect(await applyOp(area!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim).at(-1)!.fields.f_area_l).toBe('Genética|20200005');
    const [setor] = opsAfter(addSetor('TRABALHO-TECNICO', 'Alimentação'));
    expect(await applyOp(setor!, sim.port)).toMatchObject({ status: 'conferido' });
    const post = postsOf(sim).at(-1)!.fields;
    expect(post.f_setor_l).toBe('Alimentação|420228');
    // A área gravada antes vai de volta como estava.
    expect(post.f_area_l).toBe('Genética|20200005');
    expect(storedGrids(byName(sim.state.root, 'TRABALHO-TECNICO')).setores).toMatchObject([
      { c: '420228', l: 'Alimentação' },
    ]);
  });

  it('a área fora da árvore e do item: nada vai', async () => {
    const sim = await lattes();
    const [op] = opsAfter(addArea('TRABALHO-TECNICO', 'Inexistente'));
    expect(await applyOp(op!, sim.port)).toMatchObject({ status: 'erro' });
    expect(postsOf(sim)).toEqual([]);
  });
});

describe('palavras-chave, áreas e setores de uma formação', () => {
  it('a palavra nova vai pela grade da formação', async () => {
    const sim = await lattes();
    const [op] = opsAfter((root) =>
      setKeywords(lattesSchema, byName(root, 'MESTRADO'), ['genética', 'evolução']),
    );
    expect(op).toMatchObject({ kind: 'formacao', seq: '3' });
    expect(await applyOp(op!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(readKeywords(byName(sim.state.root, 'MESTRADO'))).toEqual(['genética', 'evolução']);
  });

  it('outra troca na formação manda as palavras de volta, sem apagá-las', async () => {
    const sim = await lattes();
    const [op] = opsAfter((root) => setAttr(byName(root, 'MESTRADO'), 'ANO-DE-CONCLUSAO', '2010'));
    expect(await applyOp(op!, sim.port)).toMatchObject({ status: 'conferido' });
    const mestrado = byName(sim.state.root, 'MESTRADO');
    expect(getAttr(mestrado, 'ANO-DE-CONCLUSAO')).toBe('2010');
    expect(readKeywords(mestrado)).toEqual(['genética']);
    expect(postsOf(sim).at(-1)!.fields.f_plv_l).toBe('genética|1');
  });

  it('o setor da formação, pela lista de setores', async () => {
    const sim = await lattes();
    const [op] = opsAfter(addSetor('MESTRADO', 'Alojamento'));
    expect(await applyOp(op!, sim.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(sim).at(-1)!.fields.f_setor_l).toBe('Alojamento|420225');
  });
});
