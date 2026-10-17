import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { type FormacaoOp, LEVEL_FORMS } from '../src/bridge/formacao-edit.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { noUndoReason, sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { applyLinkedAttrs } from '../src/model/linked-attrs.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

// Instituições, cursos e agências com os códigos do Lattes simulado
// (scripts/lattes-simulado/buscas.ts), sem a letra, como a exportação traz.
const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1">
<DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NACIONALIDADE="B">
<FORMACAO-ACADEMICA-TITULACAO>
<GRADUACAO SEQUENCIA-FORMACAO="1" NIVEL="1" TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO="TCC" NOME-DO-ORIENTADOR="Orientadora A" CODIGO-INSTITUICAO="000000000001" NOME-INSTITUICAO="Universidade Federal do Rio Grande do Sul" CODIGO-CURSO="" NOME-CURSO="" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2001" ANO-DE-CONCLUSAO="2004" FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="" TIPO-GRADUACAO="N" CODIGO-INSTITUICAO-GRAD="" NOME-INSTITUICAO-GRAD="" NOME-ORIENTADOR-GRAD="" NOME-CURSO-INGLES=""/>
<ESPECIALIZACAO SEQUENCIA-FORMACAO="2" NIVEL="2" TITULO-DA-MONOGRAFIA="Monografia" NOME-DO-ORIENTADOR="" CODIGO-INSTITUICAO="000000000002" NOME-INSTITUICAO="Universidade de São Paulo" CODIGO-CURSO="" NOME-CURSO="" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2005" ANO-DE-CONCLUSAO="2006" FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="" CARGA-HORARIA="360"/>
<MESTRADO SEQUENCIA-FORMACAO="3" NIVEL="3" CODIGO-INSTITUICAO="000000000001" NOME-INSTITUICAO="Universidade Federal do Rio Grande do Sul" CODIGO-CURSO="00000001" NOME-CURSO="Genética e Biologia Molecular" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2007" ANO-DE-CONCLUSAO="2009" FLAG-BOLSA="SIM" CODIGO-AGENCIA-FINANCIADORA="000000000002" NOME-AGENCIA="Coordenação de Aperfeiçoamento de Pessoal de Nível Superior" ANO-DE-OBTENCAO-DO-TITULO="2009" TITULO-DA-DISSERTACAO-TESE="Dissertação" NOME-COMPLETO-DO-ORIENTADOR="Orientador B" TIPO-MESTRADO="N" NOME-DO-CO-ORIENTADOR="" NUMERO-ID-ORIENTADOR="" ID-OASIS=""/>
<DOUTORADO SEQUENCIA-FORMACAO="4" NIVEL="4" CODIGO-INSTITUICAO="000000000003" NOME-INSTITUICAO="Universidade Estadual de Campinas" CODIGO-CURSO="00000004" NOME-CURSO="Genética e Biologia Molecular" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="2010" ANO-DE-CONCLUSAO="" FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="" ANO-DE-OBTENCAO-DO-TITULO="" TITULO-DA-DISSERTACAO-TESE="Tese" NOME-COMPLETO-DO-ORIENTADOR="Orientadora C" TIPO-DOUTORADO="N" CODIGO-INSTITUICAO-DOUT="" NOME-INSTITUICAO-DOUT="" NOME-ORIENTADOR-DOUT="" NOME-DO-ORIENTADOR-SANDUICHE="" NOME-DO-ORIENTADOR-CO-TUTELA="" CODIGO-INSTITUICAO-SANDUICHE=""/>
<POS-DOUTORADO SEQUENCIA-FORMACAO="5" NIVEL="5" CODIGO-INSTITUICAO="000000000004" NOME-INSTITUICAO="Empresa Brasileira de Pesquisa Agropecuária" ANO-DE-INICIO="2015" ANO-DE-CONCLUSAO="" ANO-DE-OBTENCAO-DO-TITULO="" FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="" STATUS-DO-ESTAGIO="" STATUS-DO-CURSO="EM_ANDAMENTO" TITULO-DO-TRABALHO=""/>
<LIVRE-DOCENCIA SEQUENCIA-FORMACAO="6" NIVEL="6" CODIGO-INSTITUICAO="000000000002" NOME-INSTITUICAO="Universidade de São Paulo" ANO-DE-OBTENCAO-DO-TITULO="2020" TITULO-DO-TRABALHO="Tese de livre-docência"/>
</FORMACAO-ACADEMICA-TITULACAO>
</DADOS-GERAIS></CURRICULO-VITAE>`;

const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function planned(edit: (root: XElement) => void, xml = XML) {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'X' })),
    working,
    { biographicFull: true, biographicOps: true },
  );
}

function onlyOp(edit: (root: XElement) => void): FormacaoOp {
  const plan = planned(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as FormacaoOp;
}

const reasonOf = (edit: (root: XElement) => void) => planned(edit).unsupported[0]?.reason;

const edit =
  (name: string, attrs: Record<string, string>) =>
  (root: XElement): void => {
    const el = byName(root, name);
    for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v);
  };

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withLattesSimulado>[0] = {}) {
  await open?.close();
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
    ...options,
  });
  return open;
}

const inState = (lattes: LattesSimuladoNoTeste, name: string) => byName(lattes.state.root, name);
const posts = (lattes: LattesSimuladoNoTeste) => postsOf(lattes).map((p) => p.proc);
const gets = (lattes: LattesSimuladoNoTeste) =>
  lattes.state.log.filter((l) => l.method === 'GET').map((l) => l.proc.toLowerCase());

describe('formação: os campos de cada nível são os do censo', () => {
  interface CensusForm {
    fields: { name: string }[];
    hidden: string[];
  }
  const captures = ['censo-2026-10-15.json', 'censo-2026-10-15b.json'].map(
    (f) =>
      JSON.parse(readFileSync(`docs/lattes-formularios/${f}`, 'utf8')) as {
        entries: { id: string; page?: { forms?: CensusForm[] } }[];
      },
  );
  it.each(Object.keys(LEVEL_FORMS))('nível %s', (code) => {
    const list = code === '5' || code === '6' ? 'AP' : 'FA';
    const form = captures
      .flatMap((c) => c.entries)
      .find((e) => e.id === `formacao-${list}-${code}` && e.page?.forms?.length)!.page!.forms![0]!;
    const shown = form.fields.map((f) => f.name).filter((n) => n !== 'f_tipo_privacidade');
    expect([...LEVEL_FORMS[code]!.visible].sort()).toEqual(shown.sort());
  });
});

describe('formação: plano', () => {
  it('orientador, coorientador, tipo e ano de obtenção vão direto, com nível e lista para conferir', () => {
    const op = onlyOp(
      edit('MESTRADO', {
        'ANO-DE-OBTENCAO-DO-TITULO': '2010',
        'NOME-COMPLETO-DO-ORIENTADOR': 'Orientador D',
        'NOME-DO-CO-ORIENTADOR': 'Coorientadora E',
        'TIPO-MESTRADO': 'S',
      }),
    );
    expect(op).toMatchObject({
      expect: {
        f_ano_obten: '2009',
        f_coorient: '',
        f_nivel: '3',
        f_orient: 'Orientador B',
        f_tipo: 'FA',
        f_tpo_doutorado: 'N',
      },
      identity: {
        f_ano_ini: ['2007'],
        f_curso_old: ['Genética e Biologia Molecular'],
        f_inst_old: ['Universidade Federal do Rio Grande do Sul'],
      },
      set: {
        f_ano_obten: '2010',
        f_coorient: 'Coorientadora E',
        f_orient: 'Orientador D',
        f_tpo_doutorado: 'S',
      },
    });
    expect(op).not.toHaveProperty('lookups');
    expect(op).not.toHaveProperty('list');
  });

  it('o que o nível não mostra fica à mão, com o nome do nível', () => {
    expect(reasonOf(edit('POS-DOUTORADO', { 'TITULO-DO-TRABALHO': 'Projeto' }))).toBe(
      'O formulário de pós-doutorado do Lattes não tem: Título do trabalho',
    );
    expect(reasonOf(edit('MESTRADO', { 'NOME-CURSO-INGLES': 'Genetics' }))).toMatch(
      /^O formulário de mestrado do Lattes não tem: /,
    );
    expect(reasonOf(edit('MESTRADO', { 'TIPO-MESTRADO': 'C' }))).toBe(
      'Tipo que o Lattes não tem para mestrado: C',
    );
    expect(reasonOf(edit('ESPECIALIZACAO', { 'CARGA-HORARIA': 'vinte' }))).toMatch(
      /^Valor que o formulário de especialização do Lattes não tem: /,
    );
    expect(reasonOf(edit('DOUTORADO', { 'CODIGO-INSTITUICAO-SANDUICHE': '1' }))).toMatch(
      /exportação traz só o código/,
    );
    expect(reasonOf(edit('DOUTORADO', { 'NOME-INSTITUICAO-OUTRA-DOUT': 'Outra' }))).toMatch(
      /^Instituição cadastrada fora da busca/,
    );
    expect(reasonOf(edit('LIVRE-DOCENCIA', { 'NOME-CURSO': 'Curso' }))).toBeDefined();
  });

  it('instituição, curso e agência só com o código novo da busca', () => {
    // Só o nome: o Lattes grava o que a busca devolve.
    expect(reasonOf(edit('MESTRADO', { 'NOME-INSTITUICAO': 'Outra' }))).toMatch(
      /^A instituição só muda pela busca do Lattes/,
    );
    expect(reasonOf(edit('MESTRADO', { 'NOME-CURSO': 'Outro' }))).toMatch(
      /^O curso só muda pela lista de cursos/,
    );
    expect(reasonOf(edit('MESTRADO', { 'NOME-AGENCIA': 'Outra' }))).toMatch(
      /^A agência só muda pela lista de agências/,
    );
    expect(reasonOf(edit('GRADUACAO', { 'NOME-CURSO': 'Biologia' }))).toBe(
      'Curso sem código do Lattes: escolha pela lista de cursos',
    );
    expect(reasonOf(edit('GRADUACAO', { 'NOME-AGENCIA': 'CNPq' }))).toBe(
      'Agência sem código do Lattes: escolha pela lista de agências',
    );
    expect(
      reasonOf(edit('MESTRADO', { 'CODIGO-INSTITUICAO': '', 'NOME-INSTITUICAO': '' })),
    ).toMatch(/^Instituição sem código do Lattes/);
    // A instituição nova pede o curso de novo.
    expect(
      reasonOf(
        edit('MESTRADO', {
          'CODIGO-CURSO': '',
          'CODIGO-INSTITUICAO': '000000000002',
          'NOME-CURSO': '',
          'NOME-INSTITUICAO': 'Universidade de São Paulo',
        }),
      ),
    ).toMatch(/^Com a instituição nova, escolha o curso/);
    expect(reasonOf(edit('MESTRADO', { 'CODIGO-CURSO': '', 'NOME-CURSO': '' }))).toMatch(
      /^Tirar o curso pelo conector/,
    );
    // Bolsa e agência andam juntas.
    expect(reasonOf(edit('MESTRADO', { 'FLAG-BOLSA': 'NAO' }))).toMatch(
      /^Agência informada sem bolsa/,
    );
    expect(reasonOf(edit('GRADUACAO', { 'FLAG-BOLSA': 'SIM' }))).toMatch(/^Bolsa sem a agência/);
    // O nível é o tipo do item.
    expect(reasonOf(edit('MESTRADO', { NIVEL: '4' }))).toMatch(/^O nível é o tipo da formação/);
  });

  it('a busca entra na operação, com as linhas para conferir e sem desfazer', () => {
    const op = onlyOp(
      edit('MESTRADO', {
        'CODIGO-CURSO': '00000003',
        'CODIGO-INSTITUICAO': '000000000002',
        'NOME-CURSO': 'Ecologia',
        'NOME-INSTITUICAO': 'Universidade de São Paulo',
      }),
    );
    expect(op.lookups).toEqual({
      course: '00000003',
      institutions: [
        {
          before: '000000000001',
          code: '000000000002',
          name: 'Universidade de São Paulo',
          slot: 'main',
        },
      ],
    });
    expect(op.identity).toMatchObject({
      f_curso_old: ['Genética e Biologia Molecular'],
      f_inst_old: ['Universidade Federal do Rio Grande do Sul'],
    });
    expect(opRows(op).map((r) => [r.before, r.after])).toEqual([
      ['Universidade Federal do Rio Grande do Sul', 'Universidade de São Paulo'],
      ['Genética e Biologia Molecular', 'Ecologia'],
    ]);
    const entry = { ...sentEntry(op, '1', 1), id: 3 };
    expect(noUndoReason(op)).toMatch(/pela busca do Lattes/);
    expect(undoOp(entry)).toBeUndefined();
  });
});

describe('formação: a extensão sem a capacidade nova', () => {
  const lookupEdit = edit('MESTRADO', {
    'CODIGO-AGENCIA-FINANCIADORA': '000000000003',
    'NOME-AGENCIA': 'Fundação de Amparo à Pesquisa do Estado de São Paulo',
  });

  it('o plano deixa à mão o que pede a busca, o pós-doutorado e a livre-docência', () => {
    const plan = (e: (root: XElement) => void) => {
      const original = parseXml(XML).root;
      const working = parseXml(XML).root;
      e(working);
      return planChanges(
        diffDocuments(original, working).map((change) => ({ change, itemTitle: 'X' })),
        working,
        { biographicOps: true },
      );
    };
    for (const e of [lookupEdit, edit('POS-DOUTORADO', { 'ANO-DE-CONCLUSAO': '2017' })]) {
      expect(plan(e).unsupported.map((u) => u.reason)).toEqual([
        expect.stringMatching(/pedem a extensão do conector atualizada$/),
      ]);
    }
    // O resto da formação segue como antes.
    expect(plan(edit('MESTRADO', { 'NOME-DO-CO-ORIENTADOR': 'X' })).ops).toHaveLength(1);
  });

  it('a extensão com a chave desligada recusa sem enviar', async () => {
    const lattes = await lattesFor();
    const gates = { editEvento: true, lists: new Set<never>() };
    expect(await applyOp(onlyOp(lookupEdit), lattes.port, gates)).toMatchObject({
      detail: expect.stringMatching(/^Esta extensão não grava instituição/),
      status: 'erro',
    });
    expect(lattes.state.log).toEqual([]);
  });
});

describe('formação no Lattes simulado', () => {
  it('mestrado: orientador, coorientador e tipo gravados e conferidos', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      edit('MESTRADO', {
        'NOME-COMPLETO-DO-ORIENTADOR': 'Orientador D',
        'NOME-DO-CO-ORIENTADOR': 'Coorientadora E',
        'TIPO-MESTRADO': 'S',
      }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(posts(lattes)).toEqual(['pkg_formacao.FORM']);
    const el = inState(lattes, 'MESTRADO');
    expect(getAttr(el, 'NOME-COMPLETO-DO-ORIENTADOR')).toBe('Orientador D');
    expect(getAttr(el, 'NOME-DO-CO-ORIENTADOR')).toBe('Coorientadora E');
    expect(getAttr(el, 'TIPO-MESTRADO')).toBe('S');
    expect(getAttr(el, 'CODIGO-AGENCIA-FINANCIADORA')).toBe('000000000002');
  });

  it('mestrado: instituição e curso novos pelas buscas', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      edit('MESTRADO', {
        'CODIGO-CURSO': '00000003',
        'CODIGO-INSTITUICAO': '000000000002',
        'NOME-CURSO': 'Ecologia',
        'NOME-INSTITUICAO': 'Universidade de São Paulo',
      }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(gets(lattes)).toEqual(expect.arrayContaining(['prc_inst_form', 'prc_curso_form']));
    const el = inState(lattes, 'MESTRADO');
    expect(getAttr(el, 'CODIGO-INSTITUICAO')).toBe('000000000002');
    expect(getAttr(el, 'NOME-INSTITUICAO')).toBe('Universidade de São Paulo');
    expect(getAttr(el, 'CODIGO-CURSO')).toBe('00000003');
    expect(getAttr(el, 'NOME-CURSO')).toBe('Ecologia');
    const sent = postsOf(lattes)[0]!.fields;
    expect(sent).toMatchObject({
      f_cod_inst: 'V000000000002',
      f_cod_inst2: '',
      f_cod_curso: '00000003',
    });
    // Os desabilitados não vão, como num envio do navegador.
    expect(sent).not.toHaveProperty('f_inst');
    expect(sent).not.toHaveProperty('f_curso');
  });

  it('mestrado: agência trocada pela lista, e tirada junto com a bolsa', async () => {
    const lattes = await lattesFor();
    const swap = onlyOp(
      edit('MESTRADO', {
        'CODIGO-AGENCIA-FINANCIADORA': '000000000003',
        'NOME-AGENCIA': 'Fundação de Amparo à Pesquisa do Estado de São Paulo',
      }),
    );
    expect(await applyOp(swap, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(gets(lattes)).toContain('prc_agencia');
    expect(getAttr(inState(lattes, 'MESTRADO'), 'NOME-AGENCIA')).toBe(
      'Fundação de Amparo à Pesquisa do Estado de São Paulo',
    );
    const none = await lattesFor();
    const off = onlyOp(
      edit('MESTRADO', {
        'CODIGO-AGENCIA-FINANCIADORA': '',
        'FLAG-BOLSA': 'NAO',
        'NOME-AGENCIA': '',
      }),
    );
    expect(off).toMatchObject({
      expect: { F_BOLSA: 'S', f_agencia: '000000000002' },
      set: { F_BOLSA: 'N' },
    });
    expect(await applyOp(off, none.port)).toMatchObject({ status: 'conferido' });
    const el = inState(none, 'MESTRADO');
    expect(getAttr(el, 'FLAG-BOLSA')).toBe('NAO');
    expect(getAttr(el, 'CODIGO-AGENCIA-FINANCIADORA')).toBe('');
    expect(gets(none)).not.toContain('prc_agencia');
  });

  it('agência só com o nome sai junto com a bolsa', async () => {
    const xml = XML.replace(
      'FLAG-BOLSA="NAO" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="" STATUS-DO-ESTAGIO=""',
      'FLAG-BOLSA="SIM" CODIGO-AGENCIA-FINANCIADORA="" NOME-AGENCIA="Fundação de Amparo" STATUS-DO-ESTAGIO=""',
    );
    const lattes = await lattesFor({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xml}`),
    });
    const plan = planned((root) => {
      const el = byName(root, 'POS-DOUTORADO');
      setAttr(el, 'FLAG-BOLSA', 'NAO');
      expect(applyLinkedAttrs(el, 'FLAG-BOLSA')).toEqual(['NOME-AGENCIA']);
    }, xml);
    expect(plan.unsupported).toEqual([]);
    const op = plan.ops[0] as FormacaoOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const el = inState(lattes, 'POS-DOUTORADO');
    expect(getAttr(el, 'FLAG-BOLSA')).toBe('NAO');
    expect(getAttr(el, 'NOME-AGENCIA')).toBe('');
  });

  it('doutorado: instituição e orientador do sanduíche', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      edit('DOUTORADO', {
        'CODIGO-INSTITUICAO-DOUT': '000000000001',
        'NOME-INSTITUICAO-DOUT': 'Universidade Federal do Rio Grande do Sul',
        'NOME-ORIENTADOR-DOUT': 'Orientador F',
        'TIPO-DOUTORADO': 'S',
      }),
    );
    expect(op.lookups?.institutions).toEqual([
      expect.objectContaining({ before: '', code: '000000000001', slot: 'dout' }),
    ]);
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const sent = postsOf(lattes)[0]!.fields;
    expect(sent).toMatchObject({ f_cod_inst_dout: 'V000000000001', f_orient_dout: 'Orientador F' });
    const el = inState(lattes, 'DOUTORADO');
    expect(getAttr(el, 'CODIGO-INSTITUICAO-DOUT')).toBe('000000000001');
    expect(getAttr(el, 'NOME-INSTITUICAO-DOUT')).toBe('Universidade Federal do Rio Grande do Sul');
    expect(getAttr(el, 'NOME-ORIENTADOR-DOUT')).toBe('Orientador F');
    expect(getAttr(el, 'TIPO-DOUTORADO')).toBe('S');
    // A instituição principal ficou como estava.
    expect(getAttr(el, 'CODIGO-INSTITUICAO')).toBe('000000000003');
  });

  it('pós-doutorado e livre-docência, pela lista f_tipo=AP; instituição com letra M', async () => {
    const lattes = await lattesFor();
    const pos = onlyOp(
      edit('POS-DOUTORADO', {
        'ANO-DE-CONCLUSAO': '2017',
        'CODIGO-INSTITUICAO': '000000000002',
        'NOME-INSTITUICAO': 'Universidade de São Paulo',
        'STATUS-DO-CURSO': 'CONCLUIDO',
      }),
    );
    expect(pos).toMatchObject({ expect: { f_nivel: '5', f_tipo: 'AP' }, list: 'AP' });
    expect(await applyOp(pos, lattes.port)).toMatchObject({ status: 'conferido' });
    const el = inState(lattes, 'POS-DOUTORADO');
    expect(getAttr(el, 'ANO-DE-CONCLUSAO')).toBe('2017');
    expect(getAttr(el, 'STATUS-DO-CURSO')).toBe('CONCLUIDO');
    expect(getAttr(el, 'CODIGO-INSTITUICAO')).toBe('000000000002');
    // Antes era a Embrapa, com M: o código estava em f_cod_inst2, e o novo vai em f_cod_inst.
    expect(postsOf(lattes)[0]!.fields).toMatchObject({
      f_cod_inst: 'V000000000002',
      f_cod_inst2: '',
    });
    const ld = onlyOp(
      edit('LIVRE-DOCENCIA', {
        'ANO-DE-OBTENCAO-DO-TITULO': '2021',
        'TITULO-DO-TRABALHO': 'Outra tese',
      }),
    );
    expect(await applyOp(ld, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(inState(lattes, 'LIVRE-DOCENCIA'), 'TITULO-DO-TRABALHO')).toBe('Outra tese');
    // Sem a lista AP no menu.
    const noMenu = { ...lattes.port, menuHtml: () => '<p>menu</p>' };
    expect(await applyOp(ld, noMenu)).toMatchObject({
      detail: 'Pós-doutorado e livre-docência não encontrados no menu do Lattes',
      status: 'erro',
    });
  });

  it('graduação e especialização: tipo, orientador do sanduíche e carga horária', async () => {
    const lattes = await lattesFor();
    const grad = onlyOp(
      edit('GRADUACAO', { 'NOME-ORIENTADOR-GRAD': 'Orientador G', 'TIPO-GRADUACAO': 'S' }),
    );
    expect(await applyOp(grad, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(inState(lattes, 'GRADUACAO'), 'NOME-ORIENTADOR-GRAD')).toBe('Orientador G');
    const esp = onlyOp(edit('ESPECIALIZACAO', { 'CARGA-HORARIA': '420' }));
    expect(await applyOp(esp, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(inState(lattes, 'ESPECIALIZACAO'), 'CARGA-HORARIA')).toBe('420');
  });

  it('para antes de enviar quando o Lattes não está como o editor espera', async () => {
    // O orientador de antes não é o do Lattes.
    const lattes = await lattesFor();
    setAttr(inState(lattes, 'MESTRADO'), 'NOME-COMPLETO-DO-ORIENTADOR', 'Outra pessoa');
    const orient = onlyOp(edit('MESTRADO', { 'NOME-COMPLETO-DO-ORIENTADOR': 'Orientador D' }));
    expect(await applyOp(orient, lattes.port)).toMatchObject({
      detail: expect.stringMatching(/Orientador/),
      status: 'divergente',
    });
    // A instituição de antes não é a do Lattes: nem a busca roda.
    const inst = onlyOp(
      edit('MESTRADO', {
        'CODIGO-CURSO': '00000003',
        'CODIGO-INSTITUICAO': '000000000002',
        'NOME-CURSO': 'Ecologia',
        'NOME-INSTITUICAO': 'Universidade de São Paulo',
      }),
    );
    const other = await lattesFor();
    setAttr(inState(other, 'MESTRADO'), 'CODIGO-INSTITUICAO', '000000000003');
    expect(await applyOp(inst, other.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Instituição',
      status: 'divergente',
    });
    expect(gets(other)).not.toContain('prc_inst_form');
    // Curso que a lista da instituição não tem.
    const noCourse = onlyOp(
      edit('MESTRADO', {
        'CODIGO-CURSO': '00000009',
        'CODIGO-INSTITUICAO': '000000000002',
        'NOME-CURSO': 'Inexistente',
        'NOME-INSTITUICAO': 'Universidade de São Paulo',
      }),
    );
    const third = await lattesFor();
    expect(await applyOp(noCourse, third.port)).toMatchObject({
      detail: 'Curso não encontrado na lista do Lattes (0 achados)',
      status: 'erro',
    });
    // Instituição que a busca não acha e agência fora da lista.
    const noInst = onlyOp(
      edit('DOUTORADO', {
        'CODIGO-INSTITUICAO-DOUT': '000000000099',
        'NOME-INSTITUICAO-DOUT': 'Nenhuma',
      }),
    );
    expect(await applyOp(noInst, third.port)).toMatchObject({
      detail: 'Instituição não encontrada na busca do Lattes (0 resultados com o código)',
      status: 'erro',
    });
    const noAgency = onlyOp(
      edit('MESTRADO', {
        'CODIGO-AGENCIA-FINANCIADORA': '000000000099',
        'NOME-AGENCIA': 'Nenhuma',
      }),
    );
    expect(await applyOp(noAgency, third.port)).toMatchObject({
      detail: 'Agência não encontrada na lista do Lattes (0 achadas)',
      status: 'erro',
    });
    for (const l of [lattes, other, third]) expect(posts(l)).toEqual([]);
  });

  it('sessão que cai na busca para a fila como sessão, sem enviar', async () => {
    const op = onlyOp(
      edit('MESTRADO', {
        'CODIGO-AGENCIA-FINANCIADORA': '000000000003',
        'NOME-AGENCIA': 'Fundação de Amparo à Pesquisa do Estado de São Paulo',
      }),
    );
    // Menu, lista e formulário passam; a lista de agências volta no login.
    const lattes = await lattesFor({ intercept: faults.logonAtGet(3) });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'sessao' });
    expect(posts(lattes)).toEqual([]);
  });
});
