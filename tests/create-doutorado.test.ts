// Doutorado novo com o tipo, os orientadores dos blocos e a outra instituição
// pela busca com f_sta_outra=S (create-formacao.ts), no Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { ALL_ON, planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import { element, getAttr, walk, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const find = (root: XElement, test: (el: XElement) => boolean) => {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && test(el)) hit = el;
  });
  return hit;
};

const SANDUICHE: Record<string, string> = {
  'ANO-DE-INICIO': '2016',
  'CODIGO-CURSO': '00000003',
  'CODIGO-INSTITUICAO': '000000000002',
  'CODIGO-INSTITUICAO-DOUT': '000000000003',
  'NOME-CURSO': 'Ecologia',
  'NOME-DO-ORIENTADOR-SANDUICHE': 'Clara Mendes',
  'NOME-INSTITUICAO': 'Universidade de São Paulo',
  'NOME-INSTITUICAO-DOUT': 'Universidade Estadual de Campinas',
  'NOME-ORIENTADOR-DOUT': 'Paulo Reis',
  'SEQUENCIA-FORMACAO': '40',
  'STATUS-DO-CURSO': 'EM_ANDAMENTO',
  'TIPO-DOUTORADO': 'S',
};

async function plan(attrs: Record<string, string>) {
  const original = (await loadCv(DEMO, 'demo.xml')).doc.root;
  const working = structuredClone(original);
  const fa = find(working, (e) => e.name === 'FORMACAO-ACADEMICA-TITULACAO')!;
  // Tira o doutorado da exportação, para o novo não parecer duplicata.
  fa.children = fa.children.filter((c) => c.kind !== 'element' || c.name !== 'DOUTORADO');
  const base = structuredClone(working);
  insertInSchemaOrder(lattesSchema, fa, element('DOUTORADO', attrs));
  const entries = diffDocuments(base, working).map((change) => ({ change, itemTitle: '' }));
  return planChanges(entries, working, ALL_ON);
}

describe('doutorado sanduíche novo', () => {
  it('leva o tipo, os orientadores e a instituição do doutorado pela busca', async () => {
    open = await withLattesSimulado();
    const old = find(open.state.root, (e) => e.name === 'DOUTORADO');
    if (old) {
      walk(open.state.root, (e) => {
        e.children = e.children.filter((c) => c !== old);
      });
    }
    const { ops, unsupported } = await plan(SANDUICHE);
    expect(unsupported).toEqual([]);
    expect(ops[0]).toMatchObject({
      doutInstitution: { code: '000000000003' },
      kind: 'criar-formacao',
      set: { f_orient_dout: 'Paulo Reis', f_orient_dout_sw: 'Clara Mendes', f_tpo_doutorado: 'S' },
    });
    const [r] = await applyAll(ops, open.port);
    expect(r).toMatchObject({ status: 'conferido' });
    const saved = find(open.state.root, (e) => e.name === 'DOUTORADO')!;
    expect(getAttr(saved, 'TIPO-DOUTORADO')).toBe('S');
    expect(getAttr(saved, 'NOME-DO-ORIENTADOR-SANDUICHE')).toBe('Clara Mendes');
    expect(getAttr(saved, 'CODIGO-INSTITUICAO-DOUT')).toBe('000000000003');
  });

  it('o tipo fora das opções e a instituição sem código ficam com o motivo', async () => {
    const wrong = await plan({ ...SANDUICHE, 'TIPO-DOUTORADO': 'X' });
    expect(wrong.unsupported[0]?.reason).toMatch(/sem correspondência/);
    const noCode = await plan({ ...SANDUICHE, 'CODIGO-INSTITUICAO-DOUT': '' });
    expect(noCode.unsupported[0]?.reason).toMatch(/doutorado sem código/);
  });
});
