// Licença nova (create-licenca.ts): a data de nascimento ou adoção vem do
// DATA-NASCIMENTO-ADOCAO, que a exportação traz (29/10/2026); as regras do
// check() da página e a inclusão no Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { BIRTH_ASK } from '../src/bridge/create-licenca.ts';
import { ALL_ON, planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import { childElements, element, getAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const LICENCA = {
  'DATA-FIM-LICENCA': '30072025',
  'DATA-INICIO-LICENCA': '01032025',
  'FORMATO-DATA-FIM-LICENCA': 'DDMMAAAA',
  'FORMATO-DATA-INICIO-LICENCA': 'DDMMAAAA',
  'TIPO-LICENCA': 'MATERNIDADE',
};

async function plan(attrs: Record<string, string> = LICENCA, birth?: string) {
  const original = (await loadCv(DEMO, 'demo.xml')).doc.root;
  const working = structuredClone(original);
  const general = childElements(working, 'DADOS-GERAIS')[0]!;
  let box = childElements(general, 'LICENCAS')[0];
  if (!box) {
    box = element('LICENCAS', {});
    insertInSchemaOrder(lattesSchema, general, box);
  }
  const lic: XElement = element('LICENCA', {
    ...attrs,
    ...(birth === undefined ? {} : { 'DATA-NASCIMENTO-ADOCAO': birth.replace(/\//g, '') }),
  });
  box.children.push(lic);
  const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
  return planChanges(entries, working, ALL_ON);
}

describe('licença nova', () => {
  it('sem a data de nascimento ou adoção, fica à mão', async () => {
    expect((await plan()).unsupported[0]?.reason).toBe(BIRTH_ASK);
  });

  it('as regras do check(): início depois do nascimento, até 180 dias, tipo', async () => {
    const reason = async (attrs: Record<string, string>, birth: string) =>
      (await plan(attrs, birth)).unsupported[0]?.reason;
    expect(await reason(LICENCA, '10/03/2025')).toMatch(/depois do nascimento/);
    expect(await reason({ ...LICENCA, 'DATA-FIM-LICENCA': '30122025' }, '01/03/2025')).toMatch(
      /até 180 dias/,
    );
    expect(await reason(LICENCA, '31022025')).toMatch(/dd\/mm\/aaaa/);
    expect(await reason({ ...LICENCA, 'TIPO-LICENCA': '' }, '01/03/2025')).toMatch(/tipo/);
  });

  it('vai pelo formulário com a data do XML, confere e a guarda no XML', async () => {
    open = await withLattesSimulado();
    const { ops, unsupported } = await plan(LICENCA, '28/02/2025');
    expect(unsupported).toEqual([]);
    expect(ops[0]).toMatchObject({
      form: 'licenca',
      kind: 'criar-dado',
      set: { f_dta_inicio: '01/03/2025', f_dta_nasc_adoc: '28/02/2025', f_tipo_licenca: 'M' },
    });
    const [r] = await applyAll(ops, open.port);
    expect(r).toMatchObject({ status: 'conferido' });
    const box = childElements(childElements(open.state.root, 'DADOS-GERAIS')[0]!, 'LICENCAS')[0]!;
    const saved = childElements(box, 'LICENCA').at(-1)!;
    expect(getAttr(saved, 'DATA-INICIO-LICENCA')).toBe('01032025');
    expect(getAttr(saved, 'TIPO-LICENCA')).toBe('MATERNIDADE');
    expect(getAttr(saved, 'DATA-NASCIMENTO-ADOCAO')).toBe('28022025');
    // De novo: o mesmo tipo e início já estão lá.
    const [again] = await applyAll(ops, open.port);
    expect(again).toMatchObject({ status: 'divergente' });
    expect(again!.detail).toMatch(/já tem essa licença/);
  });
});
