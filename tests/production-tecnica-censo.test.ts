import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { ARTISTICA_TARGETS } from '../src/bridge/production/targets/artistica.ts';
import {
  checkbox,
  oneOf,
  slashDate,
} from '../src/bridge/production/targets/comum-tecnica-artistica.ts';
import { TECNICA_TARGETS } from '../src/bridge/production/targets/tecnica.ts';
import type { FieldMap } from '../src/bridge/production/types.ts';
import { CENSUS_TARGETS } from '../src/census/targets-production.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { childElements, getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

interface CensusField {
  name: string;
  options?: { label: string; value: string }[] | string;
}
interface CensusForm {
  action: string;
  fields: CensusField[];
  hidden: string[];
  name: string;
}
const census = JSON.parse(
  readFileSync('docs/lattes-formularios/censo-2026-10-15.json', 'utf8'),
) as {
  entries: { id: string; page?: { forms: CensusForm[] } }[];
  lists: Record<string, { value: string }[]>;
};

const TARGETS = [...TECNICA_TARGETS, ...ARTISTICA_TARGETS];
const mapOf = (m: FieldMap | string): FieldMap => (typeof m === 'string' ? { field: m } : m);

describe('as especificações técnicas e artísticas conferem com o censo de 15/10/2026', () => {
  it.each(TARGETS.map((t) => [t.id, t] as const))('%s', (_id, t) => {
    // O id de cada especificação é o da entrada do censo.
    const entry = census.entries.find((e) => e.id === t.id);
    const target = CENSUS_TARGETS.find((e) => e.id === t.id);
    expect(entry && target).toBeTruthy();
    const form = entry!.page!.forms.find((f) => f.name === t.form.name)!;
    expect(form.action).toBe(t.form.action);
    expect(target!.list?.proc.toLowerCase()).toBe(t.list.proc.toLowerCase());
    expect(target!.list?.params).toEqual(t.list.params ?? {});
    expect(target!.locate.kind === 'fixed' && target!.locate.proc.toLowerCase()).toBe(
      t.list.formProc.toLowerCase(),
    );
    for (const g of t.grids) expect(form.hidden).toContain(g);

    for (const [key, m] of Object.entries(t.fields)) {
      const { field, toForm } = mapOf(m);
      // f_ref: o censo de 15/10/2026 não o registrou em formulário nenhum (comum-tecnica-artistica.ts).
      if (field === 'f_ref') continue;
      const captured = form.fields.find((f) => f.name === field);
      expect(captured ?? form.hidden.includes(field), `${t.id}: ${field}`).toBeTruthy();
      const options =
        typeof captured?.options === 'string' ? census.lists[captured.options] : captured?.options;
      if (!toForm || !options) continue;
      const values = new Set(options.map((o) => o.value));
      const [child, attr] = key.split('@') as [string, string];
      const spec = lattesSchema.elements[child]!.attributes.find((a) => a.name === attr)!;
      for (const v of spec.enum ?? []) {
        const out = toForm(v);
        if (out) expect(values, `${t.id}: ${key} ${v} → ${out}`).toContain(out);
      }
    }
  });
});

describe('as conversões das produções técnicas e artísticas', () => {
  it('caixa de marcar, lista pelo rótulo e data', () => {
    expect([checkbox('SIM'), checkbox('NAO'), checkbox(''), checkbox('talvez')]).toEqual([
      'S',
      '',
      '',
      undefined,
    ]);
    const unit = oneOf(['horas', 'dias']);
    expect([unit('Horas'), unit(''), unit('meses')]).toEqual(['horas', '', undefined]);
    expect([slashDate('04042019'), slashDate(''), slashDate('2019')]).toEqual([
      '04/04/2019',
      '',
      undefined,
    ]);
  });
});

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-TECNICA>
<SOFTWARE SEQUENCIA-PRODUCAO="40"><DADOS-BASICOS-DO-SOFTWARE TITULO-DO-SOFTWARE="Programa de Exemplo" ANO="2012"/></SOFTWARE>
<PRODUTO-TECNOLOGICO SEQUENCIA-PRODUCAO="41"><DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO TIPO-PRODUTO="PILOTO" NATUREZA="APARELHO" TITULO-DO-PRODUTO="Aparelho de Exemplo" ANO="2013" MEIO-DE-DIVULGACAO="IMPRESSO"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/></PRODUTO-TECNOLOGICO>
<DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>
<CURSO-DE-CURTA-DURACAO-MINISTRADO SEQUENCIA-PRODUCAO="42"><DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO TITULO="Curso de Exemplo" ANO="2014"/><DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO UNIDADE="dias"/></CURSO-DE-CURTA-DURACAO-MINISTRADO>
<ORGANIZACAO-DE-EVENTO SEQUENCIA-PRODUCAO="43"><DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO TITULO="Mostra de Exemplo" ANO="2015"/><DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO FLAG-EVENTO-ITINERANTE="NAO"/></ORGANIZACAO-DE-EVENTO>
<PROGRAMA-DE-RADIO-OU-TV SEQUENCIA-PRODUCAO="44"><DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV TITULO="Entrevista de Exemplo" ANO="2016"/><DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV EMISSORA="Rádio" DATA-DA-APRESENTACAO="01032016"/></PROGRAMA-DE-RADIO-OU-TV>
</DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>
</PRODUCAO-TECNICA>
<OUTRA-PRODUCAO><PRODUCAO-ARTISTICA-CULTURAL>
<ARTES-CENICAS SEQUENCIA-PRODUCAO="45"><DADOS-BASICOS-DE-ARTES-CENICAS NATUREZA="TEATRAL" TITULO="Peça de Exemplo" ANO="2017"/><DETALHAMENTO-DE-ARTES-CENICAS DATA-ESTREIA="04042017" DATA-ENCERRAMENTO="04062017" TIPO-DE-EVENTO="Temporada"/></ARTES-CENICAS>
<MUSICA SEQUENCIA-PRODUCAO="46"><DADOS-BASICOS-DA-MUSICA NATUREZA="COMPOSICAO" TITULO="Peça de Exemplo" ANO="2017"/><DETALHAMENTO-DA-MUSICA FLAG-INEDITISMO-DA-OBRA=""/></MUSICA>
<SONOPLASTIA SEQUENCIA-PRODUCAO="47"><DADOS-BASICOS-DE-SONOPLASTIA TITULO="Trilha de Exemplo" ANO="2018"/></SONOPLASTIA>
</PRODUCAO-ARTISTICA-CULTURAL></OUTRA-PRODUCAO>
</CURRICULO-VITAE>`;

const bySeq = (root: XElement, seq: string) =>
  findIn(root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!;
const part = (root: XElement, seq: string, prefix: string) =>
  childElements(bySeq(root, seq)).find((c) => c.name.startsWith(prefix))!;

function planAfter(edit: (root: XElement) => void) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    { editProduction: true },
  );
}

const reasonOf = (edit: (root: XElement) => void) => {
  const plan = planAfter(edit);
  expect(plan.ops).toEqual([]);
  return plan.unsupported.map((u) => u.reason);
};

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

/** Planeja, grava no Lattes simulado e devolve o POST e a parte relida do item. */
async function send(seq: string, prefix: string, attr: string, value: string) {
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  const plan = planAfter((root) => setAttr(part(root, seq, prefix), attr, value));
  expect(plan.unsupported).toEqual([]);
  expect(await applyOp(plan.ops[0] as ProductionOp, open.port)).toMatchObject({
    status: 'conferido',
  });
  return {
    fields: postsOf(open)[0]!.fields,
    saved: getAttr(part(open.state.root, seq, prefix), attr),
  };
}

describe('valores convertidos, no Lattes simulado', () => {
  it('o tipo e a natureza do produto vão pelo código da opção', async () => {
    const tipo = await send('41', 'DADOS-BASICOS', 'TIPO-PRODUTO', 'PROTOTIPO');
    expect(tipo).toMatchObject({ fields: { F_COD_PROD: '223' }, saved: 'PROTOTIPO' });
    const natureza = await send('41', 'DADOS-BASICOS', 'NATUREZA', 'EQUIPAMENTO');
    expect(natureza).toMatchObject({ fields: { F_SUB_PROD: '14' }, saved: 'EQUIPAMENTO' });
  });

  it('a unidade do curso vai com a grafia da opção', async () => {
    const out = await send('42', 'DETALHAMENTO', 'UNIDADE', 'Horas');
    expect(out.fields.f_unidade).toBe('horas');
  });

  it('itinerante marcado vai S; a data de estreia vai dd/mm/aaaa', async () => {
    const flag = await send('43', 'DETALHAMENTO', 'FLAG-EVENTO-ITINERANTE', 'SIM');
    expect(flag).toMatchObject({ fields: { f_itinerante: 'S' }, saved: 'SIM' });
    const date = await send('45', 'DETALHAMENTO', 'DATA-ESTREIA', '05042017');
    expect(date).toMatchObject({ fields: { f_dta_ini: '05/04/2017' }, saved: '05042017' });
  });

  it('música e artes cênicas no mesmo formulário: cada uma pelo item dela', async () => {
    const out = await send('46', 'DETALHAMENTO', 'FLAG-INEDITISMO-DA-OBRA', 'SIM');
    expect(out).toMatchObject({ fields: { f_inedito: 'S' }, saved: 'SIM' });
    expect(postsOf(open!)[0]!.proc).toBe('PKG_ARTE_NOVA.FORM');
  });
});

describe('o que fica à mão, com o motivo', () => {
  it('programa de computador: o título vai pelo motor', () => {
    const plan = planAfter((root) =>
      setAttr(part(root, '40', 'DADOS-BASICOS'), 'TITULO-DO-SOFTWARE', 'Outro programa'),
    );
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops[0]).toMatchObject({
      set: { f_titulo: 'Outro programa' },
      target: 'registro-PC',
    });
  });

  it('tipo artístico sem formulário no censo', () => {
    const reasons = reasonOf((root) =>
      setAttr(part(root, '47', 'DADOS-BASICOS'), 'TITULO', 'Outra trilha'),
    );
    expect(reasons[0]).toMatch(/não achou no Lattes o formulário deste tipo/);
  });

  it('campo oculto ou ambíguo no formulário do tipo', () => {
    expect(
      reasonOf((root) =>
        setAttr(part(root, '45', 'DETALHAMENTO'), 'DATA-ENCERRAMENTO', '05062017'),
      ),
    ).toEqual(['O formulário deste tipo no Lattes não tem: Data encerramento']);
    expect(reasonOf((root) => setAttr(part(root, '44', 'DETALHAMENTO'), 'EMISSORA', 'TV'))).toEqual(
      ['O formulário deste tipo no Lattes não tem: Emissora'],
    );
  });

  it('valor sem opção no formulário: meio WEB, unidade e tipo de evento fora da lista', () => {
    expect(
      reasonOf((root) => setAttr(part(root, '41', 'DADOS-BASICOS'), 'MEIO-DE-DIVULGACAO', 'WEB')),
    ).toEqual(['Valor sem correspondência no formulário do Lattes: Meio de divulgação']);
    expect(
      reasonOf((root) => setAttr(part(root, '42', 'DETALHAMENTO'), 'UNIDADE', 'meses')),
    ).toHaveLength(1);
    expect(
      reasonOf((root) => setAttr(part(root, '45', 'DETALHAMENTO'), 'TIPO-DE-EVENTO', 'Gala')),
    ).toHaveLength(1);
  });
});
