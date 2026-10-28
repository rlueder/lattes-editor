import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr } from '../src/model/xml.ts';
import { availabilityToForm } from '../src/schema/availability.ts';
import { outOfList, typedChoices } from '../src/schema/typed-choices.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const TYPES = [
  ['PRODUTO-TECNOLOGICO', 'DETALHAMENTO-DO-PRODUTO-TECNOLOGICO'],
  ['PROCESSOS-OU-TECNICAS', 'DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS'],
  ['RELATORIO-DE-PESQUISA', 'DETALHAMENTO-DO-RELATORIO-DE-PESQUISA'],
  ['TRABALHO-TECNICO', 'DETALHAMENTO-DO-TRABALHO-TECNICO'],
] as const;

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe('disponibilidade: códigos do XML e opções do formulário', () => {
  it.each([
    ['RESTRITA', 'Restrita'],
    ['IRRESTRITA', 'Irrestrita'],
    ['NAO_INFORMADO', ''],
    ['Restrita', 'Restrita'],
    ['Irrestrita', 'Irrestrita'],
    ['', ''],
    ['qualquer texto', undefined],
  ])('%s → %s', (value, expected) => {
    expect(availabilityToForm(value!)).toBe(expected);
  });

  it.each(TYPES)(
    '%s oferece códigos canônicos e preserva o valor desconhecido',
    (_type, detail) => {
      const el = parseXml(`<${detail} DISPONIBILIDADE="desconhecida"/>`).root;
      expect(typedChoices(el, 'DISPONIBILIDADE')?.map((c) => c.value)).toEqual([
        'RESTRITA',
        'IRRESTRITA',
        'NAO_INFORMADO',
      ]);
      expect(outOfList(el, 'DISPONIBILIDADE')).toBe(true);
      expect(getAttr(el, 'DISPONIBILIDADE')).toBe('desconhecida');
      expect(typedChoices(el, 'FINALIDADE')).toBeUndefined();
    },
  );

  it('não impõe a lista a um elemento de outro tipo', () => {
    expect(typedChoices(parseXml('<DADOS-GERAIS/>').root, 'DISPONIBILIDADE')).toBeUndefined();
  });
});

describe.each(TYPES)('%s: disponibilidade pelo conector', (type, detail) => {
  it.each([
    ['NAO_INFORMADO', 'RESTRITA', 'Restrita'],
    ['RESTRITA', 'IRRESTRITA', 'Irrestrita'],
    ['IRRESTRITA', 'NAO_INFORMADO', ''],
  ])('%s para %s: envia a opção, relê e preserva o restante', async (before, after, sent) => {
    const target = PRODUCTION_TARGETS.find((t) => t.element === type)!;
    const item = `<${type} SEQUENCIA-PRODUCAO="100"><${target.title.child} ${target.title.attr}="Item sintético" ANO="2020"/><${detail} DISPONIBILIDADE="${before}"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/></${type}>`;
    const body =
      type === 'RELATORIO-DE-PESQUISA'
        ? `<DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>${item}</DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>`
        : item;
    const xml = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/><PRODUCAO-TECNICA>${body}</PRODUCAO-TECNICA></CURRICULO-VITAE>`;
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    setAttr(
      findIn(working, (e) => e.name === detail)!,
      'DISPONIBILIDADE',
      after!,
    );
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item sintético' })),
      working,
      { editProduction: true },
    );
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops).toHaveLength(1);
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>${xml}`),
    });
    expect(await applyOp(plan.ops[0]!, open.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(open)).toHaveLength(1);
    expect(postsOf(open)[0]!.fields.f_disp).toBe(sent);
    expect(
      getAttr(
        findIn(open.state.root, (e) => e.name === detail)!,
        'DISPONIBILIDADE',
      ),
    ).toBe(after);
    expect(
      getAttr(
        findIn(open.state.root, (e) => e.name === target.title.child)!,
        target.title.attr,
      ),
    ).toBe('Item sintético');
    expect(
      getAttr(
        findIn(open.state.root, (e) => e.name === 'AUTORES')!,
        'NOME-COMPLETO-DO-AUTOR',
      ),
    ).toBe('Pessoa Sintética');
  });
});
