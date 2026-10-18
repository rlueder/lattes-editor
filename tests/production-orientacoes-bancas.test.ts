import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { type ProductionOp } from '../src/bridge/production/plan.ts';
import { ORIENTACOES_BANCAS_TARGETS } from '../src/bridge/production/targets/orientacoes-bancas.ts';
import type { FieldMap } from '../src/bridge/production/types.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import {
  childElements,
  element,
  getAttr,
  parseXml,
  setAttr,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<OUTRA-PRODUCAO><ORIENTACOES-CONCLUIDAS>
<ORIENTACOES-CONCLUIDAS-PARA-MESTRADO SEQUENCIA-PRODUCAO="41"><DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO NATUREZA="Dissertação de mestrado" TIPO="ACADEMICO" TITULO="Orientação de Exemplo" ANO="2021" PAIS="Brasil" IDIOMA="Português" HOME-PAGE="" FLAG-RELEVANCIA="NAO" DOI="" TITULO-INGLES=""/><DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO TIPO-DE-ORIENTACAO="ORIENTADOR_PRINCIPAL" NOME-DO-ORIENTADO="Aluna de Exemplo" NOME-DA-INSTITUICAO="Universidade de Exemplo" FLAG-BOLSA="SIM" NOME-DA-AGENCIA="Agência de Exemplo"/></ORIENTACOES-CONCLUIDAS-PARA-MESTRADO>
<OUTRAS-ORIENTACOES-CONCLUIDAS SEQUENCIA-PRODUCAO="42"><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NATUREZA="INICIACAO_CIENTIFICA" TITULO="Iniciação de Exemplo" ANO="2019" PAIS="Brasil" IDIOMA="Português" FLAG-RELEVANCIA="NAO"/><DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NOME-DO-ORIENTADO="Bolsista de Exemplo" FLAG-BOLSA="SIM"/></OUTRAS-ORIENTACOES-CONCLUIDAS>
</ORIENTACOES-CONCLUIDAS></OUTRA-PRODUCAO>
<DADOS-COMPLEMENTARES>
<ORIENTACOES-EM-ANDAMENTO><ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO SEQUENCIA-PRODUCAO="43"><DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO NATUREZA="Tese de doutorado" TITULO-DO-TRABALHO="Tese de Exemplo" ANO="2022" PAIS="Brasil" IDIOMA="Português"/><DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO TIPO-DE-ORIENTACAO="ORIENTADOR_PRINCIPAL" NOME-DO-ORIENTANDO="Doutorando de Exemplo" FLAG-BOLSA="NAO"/></ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO></ORIENTACOES-EM-ANDAMENTO>
<PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO>
<PARTICIPACAO-EM-BANCA-DE-MESTRADO SEQUENCIA-PRODUCAO="44"><DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO NATUREZA="Dissertação" TIPO="ACADEMICO" TITULO="Banca de Exemplo" ANO="2020" PAIS="Brasil" IDIOMA="Português"/><DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO NOME-DO-CANDIDATO="Candidata de Exemplo" NOME-INSTITUICAO="Universidade de Exemplo"/><PARTICIPANTE-BANCA NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA="Pessoa Sintética" NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA="SINTÉTICA, P." ORDEM-PARTICIPANTE="1"/><PARTICIPANTE-BANCA NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA="Paulo de Exemplo" NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA="EXEMPLO, P." ORDEM-PARTICIPANTE="2"/></PARTICIPACAO-EM-BANCA-DE-MESTRADO>
<PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO SEQUENCIA-PRODUCAO="45"><DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO NATUREZA="Exame de qualificação de mestrado" TITULO="Banca de Exemplo" ANO="2020" PAIS="Brasil" IDIOMA="Português"/><DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO NOME-DO-CANDIDATO="Candidata de Exemplo"/><PARTICIPANTE-BANCA NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA="Pessoa Sintética" NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA="SINTÉTICA, P." ORDEM-PARTICIPANTE="1"/></PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO>
</PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO>
<PARTICIPACAO-EM-BANCA-JULGADORA><BANCA-JULGADORA-PARA-CONCURSO-PUBLICO SEQUENCIA-PRODUCAO="46"><DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO NATUREZA="Concurso público" TITULO="Concurso de Exemplo" ANO="2023" PAIS="Brasil" IDIOMA="Português"/><DETALHAMENTO-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO NOME-INSTITUICAO="Universidade de Exemplo"/><PARTICIPANTE-BANCA NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA="Pessoa Sintética" NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA="SINTÉTICA, P." ORDEM-PARTICIPANTE="1"/></BANCA-JULGADORA-PARA-CONCURSO-PUBLICO></PARTICIPACAO-EM-BANCA-JULGADORA>
</DADOS-COMPLEMENTARES></CURRICULO-VITAE>`;

const bySeq = (root: XElement, seq: string) =>
  findIn(root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!;

const partOf = (root: XElement, seq: string, prefix: string) =>
  childElements(bySeq(root, seq)).find((c) => c.name.startsWith(prefix))!;

const set = (seq: string, prefix: string, attrs: Record<string, string>) => (root: XElement) => {
  const part = partOf(root, seq, prefix);
  for (const [k, v] of Object.entries(attrs)) setAttr(part, k, v);
};

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

function onlyOp(edit: (root: XElement) => void): ProductionOp {
  const plan = planAfter(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as ProductionOp;
}

const reasonOf = (edit: (root: XElement) => void) => {
  const plan = planAfter(edit);
  expect(plan.ops).toEqual([]);
  return plan.unsupported.map((u) => u.reason).join(' | ');
};

const participants = (root: XElement, seq: string) =>
  childElements(bySeq(root, seq), 'PARTICIPANTE-BANCA').map((p) =>
    getAttr(p, 'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA'),
  );

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

describe('orientações e bancas: as especificações contra o censo', () => {
  type CensusField = { name: string; options?: { value: string }[] | string };
  type CensusForm = { action: string; fields: CensusField[]; hidden: string[]; name: string };
  const census = JSON.parse(
    readFileSync('docs/lattes-formularios/censo-2026-10-15.json', 'utf8'),
  ) as { entries: { id: string; page?: { forms: CensusForm[] }; path?: string }[] };
  const lists = JSON.parse(readFileSync('docs/lattes-listas/captura-2026-10-13.json', 'utf8')) as {
    forms: Record<string, { form: string; list: string; texts: string[] }>;
  };
  // A entrada do censo do formulário (o mesmo procedimento e o f_tipo da lista).
  const formOf = (t: (typeof ORIENTACOES_BANCAS_TARGETS)[number]) =>
    census.entries
      .filter(
        (e) =>
          (e.path ?? '').split('?')[0]!.toLowerCase() === t.list.formProc.toLowerCase() &&
          Object.entries(t.list.params ?? {}).every(([k, v]) =>
            (e.path ?? '').includes(`${k}=${v}`),
          ),
      )
      .flatMap((e) => e.page?.forms ?? [])
      .find((f) => f.name === t.form.name)!;

  it('cada campo, cada natureza e cada opção estão no formulário capturado', () => {
    for (const t of ORIENTACOES_BANCAS_TARGETS) {
      const form = formOf(t);
      expect(form.action).toBe(t.form.action);
      const params = Object.entries(t.list.params ?? {}).map(([k, v]) => `${k}=${v}`);
      const listed = Object.values(lists.forms).find(
        (f) =>
          f.form.split('?')[0]!.toLowerCase() === t.list.formProc.toLowerCase() &&
          params.every((p) => f.form.includes(p)),
      )!;
      const names = new Set([
        ...form.fields.map((f) => f.name),
        ...form.hidden,
        ...listed.texts.map((x) => x.split(':')[0]),
      ]);
      const maps = Object.values(t.fields).map((m): FieldMap =>
        typeof m === 'string' ? { field: m } : m,
      );
      for (const { field } of maps) expect(names, `${t.id}: ${field}`).toContain(field);
      for (const g of t.grids) expect(form.hidden).toContain(g);
      const nature = form.fields.find((f) => f.name === 'F_COD_PROD')!.options as {
        value: string;
      }[];
      for (const v of t.nature?.values ?? []) expect(nature.map((o) => o.value)).toContain(v);
      // A lista e os parâmetros dela, como no menu capturado.
      expect(listed.list.toLowerCase()).toContain(t.list.proc);
      for (const p of params) expect(listed.list).toContain(p);
    }
  });

  it('as opções dos rádios e listas saem dos valores do censo', () => {
    for (const t of ORIENTACOES_BANCAS_TARGETS) {
      const form = formOf(t);
      for (const [key, m] of Object.entries(t.fields)) {
        if (typeof m === 'string' || !m.toForm) continue;
        const [child, attr] = key.split('@') as [string, string];
        const spec = lattesSchema.elements[child]!.attributes.find((a) => a.name === attr)!;
        const options = form.fields.find((f) => f.name === m.field)?.options;
        if (!spec.enum || !Array.isArray(options)) continue;
        const values = options.map((o) => o.value);
        for (const v of spec.enum) {
          const out = m.toForm(v);
          if (out) expect(values, `${key} ${v}`).toContain(out);
        }
      }
    }
  });

  it('todo atributo ligado ou à mão existe no XSD, e nenhum é as duas coisas', () => {
    for (const t of ORIENTACOES_BANCAS_TARGETS) {
      for (const key of [...Object.keys(t.fields), ...Object.keys(t.manual ?? {})]) {
        const [child, attr] = key.split('@') as [string, string];
        expect(
          lattesSchema.elements[child]?.attributes.map((a) => a.name),
          key,
        ).toContain(attr);
        expect(lattesSchema.elements[t.element]!.children.map((c) => c.name)).toContain(child);
      }
      for (const key of Object.keys(t.manual ?? {})) expect(t.fields).not.toHaveProperty(key);
    }
  });
});

describe('orientações: plano', () => {
  it('título de uma orientação concluída de mestrado vira a operação', () => {
    const op = onlyOp(set('41', 'DADOS-BASICOS', { TITULO: 'Orientação Revista' }));
    expect(op).toMatchObject({
      match: { title: 'Orientação de Exemplo', year: '2021' },
      set: { f_titulo: 'Orientação Revista' },
      target: 'orientacao-concluida-mestrado',
    });
  });

  it('instituição, agência e natureza ficam à mão, com o motivo', () => {
    // Nome digitado sem o código: o Lattes não tem onde gravá-lo.
    expect(reasonOf(set('41', 'DETALHAMENTO', { 'NOME-DA-INSTITUICAO': 'Outra' }))).toMatch(
      /escolha a instituição pela lista do Lattes/,
    );
    expect(reasonOf(set('41', 'DETALHAMENTO', { 'NOME-DA-AGENCIA': 'Outra' }))).toMatch(
      /escolha a agência pela lista do Lattes/,
    );
    expect(reasonOf(set('41', 'DADOS-BASICOS', { NATUREZA: 'Outra' }))).toMatch(
      /natureza muda o tipo do item/,
    );
    expect(reasonOf(set('41', 'DADOS-BASICOS', { DOI: '10.1/x' }))).toMatch(
      /O formulário deste tipo no Lattes não tem: DOI/,
    );
  });
});

describe('orientações no Lattes simulado', () => {
  it('orientando, bolsa e papel de uma orientação concluída: grava e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      set('41', 'DETALHAMENTO', {
        'FLAG-BOLSA': 'NAO',
        'NOME-DO-ORIENTADO': 'Aluna Revista',
        'TIPO-DE-ORIENTACAO': 'CO_ORIENTADOR',
      }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const [post] = postsOf(lattes);
    expect(post).toMatchObject({ proc: 'PKG_ORIENT.FORM' });
    expect(post!.fields).toMatchObject({
      F_BOLSA: 'N',
      f_ctr: 'U',
      f_nme_orient: 'Aluna Revista',
      f_tpo_orient: 'C',
    });
    const detail = partOf(lattes.state.root, '41', 'DETALHAMENTO');
    expect(getAttr(detail, 'NOME-DO-ORIENTADO')).toBe('Aluna Revista');
    expect(getAttr(detail, 'TIPO-DE-ORIENTACAO')).toBe('CO_ORIENTADOR');
    expect(getAttr(detail, 'FLAG-BOLSA')).toBe('NAO');
  });

  it('outra orientação concluída (iniciação científica), pela mesma lista', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(set('42', 'DADOS-BASICOS', { ANO: '2018' }));
    expect(op.target).toBe('orientacao-concluida-outra');
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(partOf(lattes.state.root, '42', 'DADOS-BASICOS'), 'ANO')).toBe('2018');
  });

  it('orientação em andamento: a lista f_tipo=A e o título do trabalho', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(set('43', 'DADOS-BASICOS', { 'TITULO-DO-TRABALHO': 'Tese Revista' }));
    expect(op.target).toBe('orientacao-andamento-doutorado');
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields).toMatchObject({ f_titulo: 'Tese Revista' });
    const basics = partOf(lattes.state.root, '43', 'DADOS-BASICOS');
    expect(getAttr(basics, 'TITULO-DO-TRABALHO')).toBe('Tese Revista');
  });

  it('o Lattes com outro orientando: nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(partOf(lattes.state.root, '41', 'DETALHAMENTO'), 'NOME-DO-ORIENTADO', 'Outra Pessoa');
    const op = onlyOp(set('41', 'DETALHAMENTO', { 'NOME-DO-ORIENTADO': 'Aluna Revista' }));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Nome do orientado',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });
});

describe('bancas: plano', () => {
  it('a citação e o CPF de um participante ficam à mão; o nome vai', () => {
    expect(
      reasonOf((root) => {
        const p = childElements(bySeq(root, '44'), 'PARTICIPANTE-BANCA')[1]!;
        setAttr(p, 'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA', 'OUTRA, P.');
      }),
    ).toMatch(/A grade de participantes da banca do Lattes não leva/);
    const op = onlyOp((root) => {
      const p = childElements(bySeq(root, '44'), 'PARTICIPANTE-BANCA')[1]!;
      setAttr(p, 'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA', 'Coautora de Exemplo');
    });
    expect(op).toMatchObject({
      authors: { after: [{ name: 'Pessoa Sintética' }, { name: 'Coautora de Exemplo' }] },
      rows: [{ label: 'Participantes da banca', name: 'f_autores_l' }],
      target: 'banca-trabalho-mestrado',
    });
  });

  it('a instituição da banca julgadora fica à mão, com o motivo', () => {
    expect(reasonOf(set('46', 'DETALHAMENTO', { 'NOME-INSTITUICAO': 'Outra' }))).toMatch(
      /escolha a instituição pela lista do Lattes/,
    );
  });
});

describe('bancas no Lattes simulado', () => {
  it('tipo do mestrado: grava e confere, com os participantes como estavam', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      set('44', 'DADOS-BASICOS', { TIPO: 'PROFISSIONALIZANTE' })(root);
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const [post] = postsOf(lattes);
    expect(post).toMatchObject({ proc: 'PKG_BANCA_TRAB.FORM' });
    expect(post!.fields).toMatchObject({
      f_autores_l: 'Pessoa Sintética||SINTÉTICA, P.@Paulo de Exemplo||EXEMPLO, P.',
      f_sub_prod: '35 ',
    });
    expect(getAttr(partOf(lattes.state.root, '44', 'DADOS-BASICOS'), 'TIPO')).toBe(
      'PROFISSIONALIZANTE',
    );
    expect(participants(lattes.state.root, '44')).toEqual(['Pessoa Sintética', 'Paulo de Exemplo']);
    // A qualificação com o mesmo título e ano ficou como estava.
    expect(postsOf(lattes)).toHaveLength(1);
    expect(getAttr(partOf(lattes.state.root, '45', 'DETALHAMENTO'), 'NOME-DO-CANDIDATO')).toBe(
      'Candidata de Exemplo',
    );
  });

  it('tirar um participante: a grade vai sem ele, e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      const item = bySeq(root, '44');
      item.children = item.children.filter(
        (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-PARTICIPANTE') === '2'),
      );
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(participants(lattes.state.root, '44')).toEqual(['Pessoa Sintética']);
  });

  it('pôr um participante que está na lista de autores do Lattes', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      bySeq(root, '46').children.push(
        element('PARTICIPANTE-BANCA', {
          'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA': 'Coautora de Exemplo',
          'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA': 'EXEMPLO, C.',
          'ORDEM-PARTICIPANTE': '2',
        }),
      );
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]).toMatchObject({ proc: 'PKG_BANCA_JULG.FORM' });
    expect(participants(lattes.state.root, '46')).toEqual([
      'Pessoa Sintética',
      'Coautora de Exemplo',
    ]);
  });

  it('o Lattes com outros participantes: nada é enviado', async () => {
    const lattes = await lattesFor();
    const item = bySeq(lattes.state.root, '44');
    item.children = item.children.filter(
      (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-PARTICIPANTE') === '2'),
    );
    const op = onlyOp(set('44', 'DETALHAMENTO', { 'NOME-DO-CANDIDATO': 'Candidata Revista' }));
    // Os campos conferem; a grade vai como o Lattes a tem.
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const removal = onlyOp((root) => {
      const it44 = bySeq(root, '44');
      it44.children = it44.children.filter(
        (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-PARTICIPANTE') === '1'),
      );
    });
    expect(await applyOp(removal, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Participantes da banca',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toHaveLength(1);
  });

  it('só a qualificação no Lattes, com o título e o ano da banca de mestrado: nada é enviado', async () => {
    const lattes = await lattesFor();
    const container = findIn(
      lattes.state.root,
      (el) => el.name === 'PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO',
    )!;
    container.children = container.children.filter(
      (c) => !(c.kind === 'element' && c.name === 'PARTICIPACAO-EM-BANCA-DE-MESTRADO'),
    );
    const op = onlyOp(set('44', 'DETALHAMENTO', { 'NOME-DO-CANDIDATO': 'Candidata Revista' }));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não tem um item com esse título e esse ano; nada foi enviado',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('a natureza num rádio marcado e desabilitado também separa os tipos', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/PKG_BANCA_TRAB\.form/i, (html) =>
        html.replace(
          /<input type="text" name="F_COD_PROD" value="(\w+)">/,
          '<input type="radio" name="F_COD_PROD" value="A12"><input type="radio" name="F_COD_PROD" value="$1" checked disabled>',
        ),
      ),
    });
    const op = onlyOp(set('44', 'DETALHAMENTO', { 'NOME-DO-CANDIDATO': 'Candidata Revista' }));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    // Desabilitado, o rádio não vai no envio: a página foi mesmo trocada.
    expect(postsOf(lattes)[0]!.fields).not.toHaveProperty('F_COD_PROD');
    expect(getAttr(partOf(lattes.state.root, '44', 'DETALHAMENTO'), 'NOME-DO-CANDIDATO')).toBe(
      'Candidata Revista',
    );
  });

  it('sem o campo da natureza, o título e o ano decidem', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/PKG_BANCA_JULG\.form/i, (html) =>
        html.replace(/<input type="text" name="F_COD_PROD" value="\w+">/, ''),
      ),
    });
    const op = onlyOp(set('46', 'DADOS-BASICOS', { TITULO: 'Concurso Revisto' }));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields).not.toHaveProperty('F_COD_PROD');
    expect(getAttr(partOf(lattes.state.root, '46', 'DADOS-BASICOS'), 'TITULO')).toBe(
      'Concurso Revisto',
    );
  });
});

describe('instituição, curso e agência pelas buscas do Lattes (Fase 2)', () => {
  const UFRGS = { 'CODIGO-INSTITUICAO': '000000000001' };
  const lookupsPlan = (edit: (root: XElement) => void, productionLookups = true) => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    edit(working);
    return planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true, productionLookups },
    );
  };
  const orientationPick = set('41', 'DETALHAMENTO', {
    ...UFRGS,
    'CODIGO-AGENCIA-FINANCIADORA': '000000000001',
    'CODIGO-CURSO': '00000001',
    'NOME-DA-AGENCIA': 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
    'NOME-DA-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
    'NOME-DO-CURSO': 'Genética e Biologia Molecular',
  });

  it('a escolha na lista vira a busca na hora de gravar, com o código de antes', () => {
    const plan = lookupsPlan(orientationPick);
    expect(plan.unsupported).toEqual([]);
    const op = plan.ops[0] as ProductionOp;
    expect(op.lookups).toEqual({
      agency: {
        before: '',
        code: '000000000001',
        name: 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
      },
      course: { before: '', code: '00000001' },
      institution: {
        before: '',
        code: '000000000001',
        name: 'Universidade Federal do Rio Grande do Sul',
      },
    });
  });

  it('extensão sem as buscas: fica à mão, nunca vai sem os ocultos', () => {
    const plan = lookupsPlan(orientationPick, false);
    expect(plan.ops).toEqual([]);
    expect(plan.unsupported[0]?.reason).toMatch(/buscas do Lattes/);
  });

  it('orientação: grava instituição, curso e agência pelos ocultos e confere', async () => {
    const lattes = await lattesFor();
    const op = lookupsPlan(orientationPick).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const [post] = postsOf(lattes);
    expect(post).toMatchObject({ proc: 'PKG_ORIENT.FORM' });
    expect(post!.fields.f_cod_inst).toBe('V000000000001');
    expect(post!.fields.f_cod_inst2).toBe('');
    expect(post!.fields.f_agencia).toBe('000000000001');
    const detail = partOf(lattes.state.root, '41', 'DETALHAMENTO');
    expect(getAttr(detail, 'NOME-DA-INSTITUICAO')).toBe(
      'Universidade Federal do Rio Grande do Sul',
    );
    expect(getAttr(detail, 'NOME-DO-CURSO')).toBe('Genética e Biologia Molecular');
  });

  it('código que a busca não acha: nada é enviado', async () => {
    const lattes = await lattesFor();
    const op = lookupsPlan(
      set('46', 'DETALHAMENTO', {
        'CODIGO-INSTITUICAO': '999999999999',
        'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
      }),
    ).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'erro' });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('banca julgadora: só a instituição, que grava e confere', async () => {
    const lattes = await lattesFor();
    const op = lookupsPlan(
      set('46', 'DETALHAMENTO', {
        'CODIGO-INSTITUICAO': '000000000002',
        'NOME-INSTITUICAO': 'Universidade de São Paulo',
      }),
    ).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const detail = partOf(lattes.state.root, '46', 'DETALHAMENTO');
    expect(getAttr(detail, 'NOME-INSTITUICAO')).toBe('Universidade de São Paulo');
  });
});
