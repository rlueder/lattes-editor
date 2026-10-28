// A atuação nova com atividades: ela vai antes, com o primeiro vínculo, e o
// resto no envio seguinte, já sob o número que o Lattes deu (create.ts,
// acceptCreated em src/model/changes.ts), contra o Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { ALL_ON, planChanges } from '../src/bridge/plan.ts';
import { acceptCreated, diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import { childElements, element, getAttr, walk, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const atuacoes = (root: XElement) => {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && el.name === 'ATUACOES-PROFISSIONAIS') hit = el;
  });
  return hit!;
};

const nova = () =>
  element(
    'ATUACAO-PROFISSIONAL',
    {
      'CODIGO-INSTITUICAO': '000000000001',
      'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
      'SEQUENCIA-ATIVIDADE': '9',
    },
    [
      element('VINCULOS', {
        'ANO-INICIO': '2026',
        'FLAG-VINCULO-EMPREGATICIO': 'SIM',
        'SEQUENCIA-HISTORICO': '1',
        'TIPO-DE-VINCULO': 'CELETISTA',
      }),
      element('ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO', {}, [
        element('DIRECAO-E-ADMINISTRACAO', {
          'ANO-INICIO': '2026',
          'CARGO-OU-FUNCAO': 'Coordenação',
          'CODIGO-ORGAO': '000001000008',
          'FLAG-PERIODO': 'ATUAL',
          'NOME-ORGAO': 'Instituto de Biociências',
          'SEQUENCIA-FUNCAO-ATIVIDADE': '1',
        }),
      ]),
    ],
  );

describe('atuação nova com atividades, em duas rodadas', () => {
  it('a atuação vai com o primeiro vínculo; a atividade, no envio seguinte', async () => {
    open = await withLattesSimulado();
    const original = (await loadCv(DEMO, 'demo.xml')).doc.root;
    const working = structuredClone(original);
    insertInSchemaOrder(lattesSchema, atuacoes(working), nova());

    const plan = () =>
      planChanges(
        diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
        working,
        ALL_ON,
      );
    const first = plan();
    expect(first.unsupported).toEqual([]);
    expect(first.ops.map((o) => o.kind)).toEqual(['criar-atuacao']);
    const [created] = await applyAll(first.ops, open.port);
    expect(created).toMatchObject({ partial: true, status: 'conferido' });
    expect(created!.detail).toMatch(/No próximo envio, depois desta: .*dire/i);

    // Conferida no Lattes: entra no original só com o vínculo.
    const change = diffDocuments(original, working).find((c) => c.kind === 'novo')!;
    expect(acceptCreated(original, working, change, created!.assigned)).toBe(true);
    const accepted = childElements(atuacoes(original)).at(-1)!;
    expect(childElements(accepted).map((c) => c.name)).toEqual(['VINCULOS']);

    const second = plan();
    expect(second.unsupported).toEqual([]);
    expect(second.ops).toMatchObject([
      { kind: 'criar-atividade', natur: '1', seqAtiv: created!.assigned!['SEQUENCIA-ATIVIDADE'] },
    ]);
    const [atividade] = await applyAll(second.ops, open.port);
    expect(atividade).toMatchObject({ status: 'conferido' });
    const saved = childElements(atuacoes(open.state.root)).find(
      (a) => getAttr(a, 'SEQUENCIA-ATIVIDADE') === created!.assigned!['SEQUENCIA-ATIVIDADE'],
    )!;
    expect(childElements(saved).map((c) => c.name)).toContain(
      'ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO',
    );
  });
});
