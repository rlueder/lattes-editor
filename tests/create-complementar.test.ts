// Inclusão de formação complementar (create-complementar.ts): o plano a partir
// do XML e os dois passos do FORM2 no Lattes simulado, com instituição, curso,
// agência e grades pelas buscas, e a releitura dos dois passos.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { LATTES_CONTRACT } from '../src/bridge/contract.ts';
import {
  CREATE_COMPL_ENABLED,
  type CreateComplementarOp,
  planCreateComplementar,
} from '../src/bridge/create-complementar.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { ALL_ON } from '../src/bridge/plan.ts';
import { type Change, diffDocuments } from '../src/model/changes.ts';
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

const MBA: Record<string, string> = {
  'ANO-DE-CONCLUSAO': '2020',
  'ANO-DE-INICIO': '2019',
  'ANO-DE-OBTENCAO-DO-TITULO': '2020',
  'CARGA-HORARIA': '360',
  'CODIGO-AGENCIA-FINANCIADORA': '000000000002',
  'CODIGO-CURSO': '00000002',
  'CODIGO-INSTITUICAO': '000000000001',
  'FLAG-BOLSA': 'SIM',
  NIVEL: 'E',
  'NOME-AGENCIA': 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior',
  'NOME-COMPLETO-DO-ORIENTADOR': 'Helena Vieira',
  'NOME-CURSO': 'Botânica',
  'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
  'SEQUENCIA-FORMACAO': '30',
  'STATUS-DO-CURSO': 'CONCLUIDO',
  'TITULO-DA-MONOGRAFIA': 'Gestão de herbários',
};

const change = (attrs: Record<string, string>, name = 'MBA'): Change => ({
  element: name,
  fields: Object.entries(attrs).map(([attr, after]) => ({
    after,
    attr,
    before: '',
    label: `rótulo de ${attr}`,
  })),
  form: 'Formação complementar',
  key: `CURRICULO-VITAE/DADOS-COMPLEMENTARES[#0]/FORMACAO-COMPLEMENTAR[#0]/${name}[SEQUENCIA-FORMACAO=30]`,
  kind: 'novo',
  path: [],
});

const plan = (attrs: Record<string, string>, name = 'MBA', kids: XElement[] = []) =>
  planCreateComplementar(change(attrs, name), element(name, attrs, kids), 'Formação complementar');

const container = (root: XElement) => {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && el.name === 'DADOS-COMPLEMENTARES') hit = el;
  });
  if (!hit) {
    hit = element('DADOS-COMPLEMENTARES', {});
    insertInSchemaOrder(lattesSchema, root, hit);
  }
  let fc = childElements(hit, 'FORMACAO-COMPLEMENTAR')[0];
  if (!fc) {
    fc = element('FORMACAO-COMPLEMENTAR', {});
    insertInSchemaOrder(lattesSchema, hit, fc);
  }
  return fc;
};

describe('planejar a inclusão de uma formação complementar', () => {
  it('ligada, com o formulário no contrato', () => {
    expect(CREATE_COMPL_ENABLED).toBe(true);
    expect(LATTES_CONTRACT.forms['criar-complementar']).toBeDefined();
  });

  it('separa os campos dos dois passos e deixa fora o que o Lattes não tem', () => {
    const op = plan({ ...MBA, 'NOME-CURSO-INGLES': 'Botany', 'NOME-ORGAO': 'Instituto' });
    expect(op).toMatchObject({
      agencyCode: '000000000002',
      courseCode: '00000002',
      institutionCode: '000000000001',
      kind: 'criar-complementar',
      left: ['rótulo de NOME-CURSO-INGLES', 'rótulo de NOME-ORGAO'],
      level: 'E',
      set: { f_carga: '360', F_STATUS: 'S' },
      step2: {
        f_ano_fim: '2020',
        f_ano_ini: '2019',
        f_ano_obten: '2020',
        F_BOLSA: 'S',
        f_orient: 'Helena Vieira',
        f_titulo: 'Gestão de herbários',
      },
    });
  });

  it('recusa com o motivo o que o check() do Lattes não aceitaria', () => {
    const reason = (attrs: Record<string, string>, name = 'MBA') =>
      (plan(attrs, name) as { reason?: string }).reason;
    expect(reason({ ...MBA, 'CODIGO-INSTITUICAO': '' })).toMatch(/sem código/);
    expect(reason({ ...MBA, 'CODIGO-INSTITUICAO': '', 'NOME-INSTITUICAO': '' })).toMatch(
      /exige a instituição/,
    );
    expect(reason({ ...MBA, 'CODIGO-CURSO': '' })).toMatch(/exige o curso/);
    expect(reason({ ...MBA, 'CODIGO-AGENCIA-FINANCIADORA': '' })).toMatch(/Agência sem código/);
    expect(reason({ ...MBA, 'CARGA-HORARIA': '' })).toMatch(/carga horária/);
    expect(reason({ ...MBA, 'CARGA-HORARIA': '12h' })).toMatch(/sem correspondência/);
    expect(reason({ ...MBA, 'STATUS-DO-CURSO': '' })).toMatch(/situação/);
    expect(reason({ ...MBA, 'FLAG-BOLSA': 'NAO' })).toMatch(/Com bolsa Não/);
    expect(reason({ ...MBA, 'ANO-DE-INICIO': '19' })).toMatch(/sem correspondência/);
    // Em Outros, a instituição é dispensada.
    const outros = plan(
      {
        'CARGA-HORARIA': '20',
        'CODIGO-CURSO': '00000002',
        NIVEL: 'Y',
        'NOME-CURSO': 'Botânica',
        'STATUS-DO-CURSO': 'EM_ANDAMENTO',
      },
      'OUTROS',
    ) as CreateComplementarOp;
    expect(outros).toMatchObject({ institutionCode: '', level: 'Y', set: { F_STATUS: 'N' } });
  });
});

describe('incluir a formação complementar no Lattes simulado', () => {
  it('dois passos, com as buscas e as grades, e a releitura confere', async () => {
    open = await withLattesSimulado();
    const original = (await loadCv(DEMO, 'demo.xml')).doc.root;
    const working = structuredClone(original);
    const mba = element('MBA', MBA, [element('PALAVRAS-CHAVE', { 'PALAVRA-CHAVE-1': 'herbário' })]);
    insertInSchemaOrder(lattesSchema, container(working), mba);
    const planned = planChanges(
      diffDocuments(original, working).map((c) => ({ change: c, itemTitle: '' })),
      working,
      ALL_ON,
    );
    expect(planned.unsupported).toEqual([]);
    expect(planned.ops.map((o) => o.kind)).toEqual(['criar-complementar']);

    const [result] = await applyAll(planned.ops, open.port);
    expect(result).toMatchObject({ status: 'conferido' });
    const created = childElements(container(open.state.root), 'MBA');
    expect(created).toHaveLength(1);
    const saved = created[0]!;
    expect(result!.assigned).toEqual({
      'SEQUENCIA-FORMACAO': getAttr(saved, 'SEQUENCIA-FORMACAO'),
    });
    for (const attr of [
      'ANO-DE-INICIO',
      'ANO-DE-CONCLUSAO',
      'CARGA-HORARIA',
      'STATUS-DO-CURSO',
      'TITULO-DA-MONOGRAFIA',
      'NOME-COMPLETO-DO-ORIENTADOR',
      'FLAG-BOLSA',
      'NOME-CURSO',
    ]) {
      expect(getAttr(saved, attr), attr).toBe(MBA[attr]);
    }
    expect(getAttr(saved, 'CODIGO-INSTITUICAO')).toBe('000000000001');
    expect(getAttr(saved, 'CODIGO-AGENCIA-FINANCIADORA')).toBe('000000000002');
    expect(getAttr(childElements(saved, 'PALAVRAS-CHAVE')[0]!, 'PALAVRA-CHAVE-1')).toBe('herbário');

    // De novo: o Lattes já tem uma igual, e nada vai.
    const [again] = await applyAll(planned.ops, open.port);
    expect(again).toMatchObject({ status: 'divergente' });
    expect(again!.detail).toMatch(/já tem essa formação complementar/);
    expect(childElements(container(open.state.root), 'MBA')).toHaveLength(1);
  });

  it('sem a capacidade da extensão, fica à mão', () => {
    const before = parseDemo();
    const after = structuredClone(before);
    insertInSchemaOrder(lattesSchema, container(after), element('MBA', MBA));
    const entries = diffDocuments(before, after).map((c) => ({ change: c, itemTitle: '' }));
    const planned = planChanges(entries, after, { ...ALL_ON, createComplementar: false });
    expect(planned.ops).toEqual([]);
    expect(planned.unsupported[0]?.reason).toMatch(/Formação complementar nova/);
  });
});

function parseDemo(): XElement {
  return element('CURRICULO-VITAE', { 'NUMERO-IDENTIFICADOR': '1' }, [
    element('DADOS-GERAIS', { 'NOME-COMPLETO': 'Ana' }),
  ]);
}
