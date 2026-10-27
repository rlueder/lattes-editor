import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { planNatureSwap } from '../src/bridge/production/nature.ts';
import { type ProductionOp } from '../src/bridge/production/plan.ts';
import { ORIENTACOES_BANCAS_TARGETS } from '../src/bridge/production/targets/orientacoes-bancas.ts';
import type { FieldMap } from '../src/bridge/production/types.ts';
import { type Change, diffDocuments } from '../src/model/changes.ts';
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
<OUTRAS-ORIENTACOES-CONCLUIDAS SEQUENCIA-PRODUCAO="47"><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NATUREZA="TRABALHO_DE_CONCLUSAO_DE_CURSO_GRADUACAO" TITULO="Trabalho de Exemplo" ANO="2020" PAIS="Brasil" IDIOMA="Português" FLAG-RELEVANCIA="NAO"/><DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NOME-DO-ORIENTADO="Formanda de Exemplo" CODIGO-INSTITUICAO="000000000001" NOME-DA-INSTITUICAO="Universidade Federal do Rio Grande do Sul" CODIGO-CURSO="00000001" NOME-DO-CURSO="Genética e Biologia Molecular" FLAG-BOLSA="NAO"/></OUTRAS-ORIENTACOES-CONCLUIDAS>
<OUTRAS-ORIENTACOES-CONCLUIDAS SEQUENCIA-PRODUCAO="48"><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NATUREZA="MONOGRAFIA_DE_CONCLUSAO_DE_CURSO_APERFEICOAMENTO_E_ESPECIALIZACAO" TITULO="Monografia de Exemplo" ANO="2020" PAIS="Brasil" IDIOMA="Português" FLAG-RELEVANCIA="NAO"/><DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NOME-DO-ORIENTADO="Especialista de Exemplo" CODIGO-INSTITUICAO="000000000001" NOME-DA-INSTITUICAO="Universidade Federal do Rio Grande do Sul" CODIGO-CURSO="00000005" NOME-DO-CURSO="Especialização em Genética" FLAG-BOLSA="NAO"/></OUTRAS-ORIENTACOES-CONCLUIDAS>
<OUTRAS-ORIENTACOES-CONCLUIDAS SEQUENCIA-PRODUCAO="49"><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NATUREZA="TRABALHO_DE_CONCLUSAO_DE_CURSO_GRADUACAO" TITULO="Graduação de Exemplo" ANO="2021" PAIS="Brasil" IDIOMA="Português" FLAG-RELEVANCIA="NAO"/><DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NOME-DO-ORIENTADO="Formando de Exemplo" CODIGO-INSTITUICAO="000000000001" NOME-DA-INSTITUICAO="Universidade Federal do Rio Grande do Sul" CODIGO-CURSO="00000005" NOME-DO-CURSO="Especialização em Genética" FLAG-BOLSA="NAO"/></OUTRAS-ORIENTACOES-CONCLUIDAS>
<OUTRAS-ORIENTACOES-CONCLUIDAS SEQUENCIA-PRODUCAO="50"><DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NATUREZA="ORIENTACAO-DE-OUTRA-NATUREZA" TIPO="Estágio" TITULO="Estágio de Exemplo" ANO="2022" PAIS="Brasil" IDIOMA="Português" FLAG-RELEVANCIA="NAO"/><DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS NOME-DO-ORIENTADO="Estagiária de Exemplo" FLAG-BOLSA="NAO"/></OUTRAS-ORIENTACOES-CONCLUIDAS>
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
    expect(reasonOf(set('41', 'DADOS-BASICOS', { NATUREZA: 'Outra' }))).toBe(
      'Natureza: Dissertação de mestrado é o tipo do item no Lattes; para trocar, inclua o item de novo no tipo certo',
    );
    expect(reasonOf(set('43', 'DADOS-BASICOS', { NATUREZA: 'Outra' }))).toMatch(
      /^Natureza: Tese de doutorado é o tipo do item no Lattes/,
    );
    expect(reasonOf(set('41', 'DADOS-BASICOS', { DOI: '10.1/x' }))).toMatch(
      /O formulário deste tipo no Lattes não tem: DOI/,
    );
  });
});

describe('tipo do mestrado (dominio() de pkg_orient.form, lido em 26/10/2026)', () => {
  it('acadêmico para profissional: o código em f_sub_prod e o rótulo em f_dsc_outra', () => {
    const op = onlyOp(set('41', 'DADOS-BASICOS', { TIPO: 'PROFISSIONALIZANTE' }));
    expect(op).toMatchObject({
      expect: { f_dsc_outra: 'Acadêmico', f_sub_prod: '29' },
      set: { f_dsc_outra: 'Profissional', f_sub_prod: '30' },
    });
    expect(op.lookups).toBeUndefined();
  });

  it('com curso no item, o curso é buscado de novo no nível do profissional', () => {
    const withCourse = (root: XElement) => {
      set('41', 'DETALHAMENTO', { 'CODIGO-CURSO': '00000001' })(root);
    };
    const original = parseXml(XML).root;
    withCourse(original);
    const working = parseXml(XML).root;
    withCourse(working);
    set('41', 'DADOS-BASICOS', { TIPO: 'PROFISSIONALIZANTE' })(working);
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true, productionLookups: true },
    );
    expect(plan.unsupported).toEqual([]);
    expect((plan.ops[0] as ProductionOp).lookups).toEqual({
      course: { before: '00000001', code: '00000001' },
      subProd: '30',
    });
  });

  it('valor fora do formulário fica à mão', () => {
    expect(reasonOf(set('41', 'DADOS-BASICOS', { TIPO: 'OUTRO' }))).toMatch(
      /^Tipo: valor que o formulário de orientação do Lattes não tem/,
    );
  });

  it('no Lattes simulado: grava e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(set('41', 'DADOS-BASICOS', { TIPO: 'PROFISSIONALIZANTE' }));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).at(-1)!.fields).toMatchObject({ f_sub_prod: '30' });
  });
});

describe('tipo da orientação de outra natureza (dominio(), lido em 27/10/2026)', () => {
  const kind = (seq: string, value: string) => set(seq, 'DADOS-BASICOS', { TIPO: value });

  it('vai em f_dsc_outra, como o atribui_ot() grava', () => {
    expect(onlyOp(kind('50', 'Monitoria'))).toMatchObject({
      expect: { f_dsc_outra: 'Estágio' },
      set: { f_dsc_outra: 'Monitoria' },
    });
  });

  it('nas outras naturezas, e com a natureza trocada junto, fica à mão', () => {
    expect(reasonOf(kind('42', 'Monitoria'))).toBe(
      'Tipo: o Lattes só guarda o tipo na orientação de outra natureza',
    );
    expect(
      reasonOf((root) => {
        kind('50', 'Monitoria')(root);
        set('50', 'DADOS-BASICOS', { NATUREZA: 'INICIACAO_CIENTIFICA' })(root);
      }),
    ).toContain('Tipo: troque a natureza num envio e o tipo em outro');
    expect(reasonOf(kind('50', 'x'.repeat(101)))).toBe('Tipo: o Lattes aceita até 100 caracteres');
  });

  it('no Lattes simulado: grava e confere', async () => {
    const lattes = await lattesFor();
    expect(await applyOp(onlyOp(kind('50', 'Monitoria')), lattes.port)).toMatchObject({
      status: 'conferido',
    });
    expect(getAttr(partOf(lattes.state.root, '50', 'DADOS-BASICOS'), 'TIPO')).toBe('Monitoria');
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
    // Como o Salvar da página: primeiro a validação do nome, depois o formulário.
    const [check, post] = postsOf(lattes);
    expect(check).toMatchObject({
      fields: { f_nivel: '41', f_nme: 'Aluna%20Revista' },
      proc: 'pkg_orient.valida_orientador_ajax',
    });
    expect(post).toMatchObject({ proc: 'PKG_ORIENT.FORM' });
    expect(post!.fields).toMatchObject({
      F_BOLSA: 'N',
      f_ctr: 'U',
      // O nome não valida: o identificador fica como a página trouxe.
      f_id_orientado: '',
      f_nme_orient: 'Aluna Revista',
      f_tpo_orient: 'C',
    });
    const detail = partOf(lattes.state.root, '41', 'DETALHAMENTO');
    expect(getAttr(detail, 'NOME-DO-ORIENTADO')).toBe('Aluna Revista');
    expect(getAttr(detail, 'TIPO-DE-ORIENTACAO')).toBe('CO_ORIENTADOR');
    expect(getAttr(detail, 'FLAG-BOLSA')).toBe('NAO');
  });

  it('orientando com currículo no Lattes: o identificador da validação vai junto', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      set('41', 'DETALHAMENTO', { 'NOME-DO-ORIENTADO': 'Aluna Sintética de Exemplo' }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const post = postsOf(lattes).at(-1)!;
    expect(post.fields).toMatchObject({
      f_id_orientado: '0000000000000001',
      f_seq_form_orientado: '1',
    });
    expect(getAttr(partOf(lattes.state.root, '41', 'DETALHAMENTO'), 'NUMERO-ID-ORIENTADO')).toBe(
      '0000000000000001',
    );
    // Sem trocar o nome, nenhuma validação.
    const other = await lattesFor();
    await applyOp(onlyOp(set('41', 'DETALHAMENTO', { 'FLAG-BOLSA': 'NAO' })), other.port);
    expect(postsOf(other).map((p) => p.proc)).toEqual(['PKG_ORIENT.FORM']);
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

describe('natureza das outras orientações concluídas (testa_nivel, lido em 20/10/2026)', () => {
  const NATURE = {
    graduacao: 'TRABALHO_DE_CONCLUSAO_DE_CURSO_GRADUACAO',
    ic: 'INICIACAO_CIENTIFICA',
    monografia: 'MONOGRAFIA_DE_CONCLUSAO_DE_CURSO_APERFEICOAMENTO_E_ESPECIALIZACAO',
    outra: 'ORIENTACAO-DE-OUTRA-NATUREZA',
  };
  const plan = (edit: (root: XElement) => void, productionLookups = true) => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    edit(working);
    return planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true, productionLookups },
    );
  };
  const nature = (seq: string, value: string) => set(seq, 'DADOS-BASICOS', { NATUREZA: value });
  const courseSearches = (lattes: LattesSimuladoNoTeste) =>
    lattes.state.log.filter((l) => /^prc_curso_form/i.test(l.path)).map((l) => l.path);
  // O caminho que a página da orientação abre (curso(), lido em 18/10/2026).
  const courseSearch = (lattes: LattesSimuladoNoTeste, level: string, area: string) =>
    `prc_curso_form?f_pgm=TESE&f_cod=${lattes.state.code}&f_inst=V000000000001&f_nivel=${level}&f_sta_area=${area}`;
  const reason = (edit: (root: XElement) => void) => {
    const p = plan(edit);
    expect(p.ops).toEqual([]);
    return p.unsupported.map((u) => u.reason).join(' | ');
  };

  it('graduação para aperfeiçoamento: o rádio, os ocultos limpos e as escolhas de novo', () => {
    const p = plan(nature('47', NATURE.monografia));
    expect(p.unsupported).toEqual([]);
    expect(p.ops[0]).toMatchObject({
      expect: { F_COD_PROD: '44' },
      lookups: {
        course: { before: '00000001', code: '00000001' },
        institution: {
          before: '000000000001',
          code: '000000000001',
          name: 'Universidade Federal do Rio Grande do Sul',
        },
        nature: '43',
      },
      set: { F_COD_PROD: '43', f_dsc_outra: '', f_sub_prod: '' },
      target: 'orientacao-concluida-outra',
    });
    // O antes dos ocultos limpos não se confere.
    expect((p.ops[0] as ProductionOp).expect).not.toHaveProperty('f_dsc_outra');
  });

  it('de ou para outra natureza fica à mão: a janela do subtipo não foi lida', () => {
    expect(reason(nature('47', NATURE.outra))).toMatch(
      /^Natureza: a orientação de outra natureza pede o subtipo/,
    );
  });

  it('sem a instituição ou sem o curso que a natureza nova exige: à mão, com o motivo', () => {
    // A iniciação científica do exemplo não tem instituição.
    expect(reason(nature('42', NATURE.graduacao))).toMatch(
      /o item não tem o código dela; troque no Lattes$/,
    );
    const noCourse = (root: XElement) => {
      set('42', 'DETALHAMENTO', {
        'CODIGO-INSTITUICAO': '000000000001',
        'NOME-DA-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
      })(root);
    };
    const base = parseXml(XML).root;
    noCourse(base);
    const working = parseXml(XML).root;
    noCourse(working);
    nature('42', NATURE.graduacao)(working);
    const p = planChanges(
      diffDocuments(base, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true, productionLookups: true },
    );
    expect(p.unsupported.map((u) => u.reason)).toEqual([
      'Natureza: com a natureza nova, o Lattes exige o curso, e o item não tem; troque a natureza no Lattes e escolha o curso pela lista dele',
    ]);
    // A iniciação científica não exige o curso (o check() da página).
    const toIc = plan(nature('47', NATURE.ic));
    expect(toIc.unsupported).toEqual([]);
  });

  it('com o curso trocado na mesma fila: natureza e curso vão em envios separados', () => {
    const p = plan((root) => {
      nature('47', NATURE.monografia)(root);
      set('47', 'DETALHAMENTO', {
        'CODIGO-CURSO': '00000005',
        'NOME-DO-CURSO': 'Especialização em Genética',
      })(root);
    });
    expect(p.unsupported.map((u) => u.reason)).toContain(
      'Natureza: troque a natureza num envio e a instituição ou o curso em outro',
    );
  });

  it('extensão sem as buscas: a troca fica à mão', () => {
    const p = plan(nature('47', NATURE.monografia), false);
    expect(p.ops).toEqual([]);
    expect(p.unsupported[0]?.reason).toMatch(/desligado nesta montagem/);
  });

  it('no Lattes simulado: grava, com o curso buscado no nível da natureza nova', async () => {
    const lattes = await lattesFor();
    const op = plan(nature('47', NATURE.monografia)).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    // retnivel(): 43 pede o nível 2, e o aperfeiçoamento f_sta_area=N, como a página.
    expect(courseSearches(lattes)).toEqual([courseSearch(lattes, '2', 'N')]);
    const post = postsOf(lattes).at(-1)!;
    expect(post.fields).toMatchObject({
      F_COD_PROD: '43',
      f_cod_curso: '00000001',
      f_cod_inst: 'V000000000001',
      f_dsc_outra: '',
      f_sub_prod: '',
    });
    expect(getAttr(partOf(lattes.state.root, '47', 'DADOS-BASICOS'), 'NATUREZA')).toBe(
      NATURE.monografia,
    );
    const detail = partOf(lattes.state.root, '47', 'DETALHAMENTO');
    expect(getAttr(detail, 'CODIGO-CURSO')).toBe('00000001');
    expect(getAttr(detail, 'CODIGO-INSTITUICAO')).toBe('000000000001');
  });

  it('o curso que só a lista do nível novo tem: grava, com o código dele', async () => {
    const lattes = await lattesFor();
    // A especialização só aparece na busca TESE de nível 2 (TESE_COURSES).
    const op = plan(nature('49', NATURE.monografia)).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(courseSearches(lattes)).toEqual([courseSearch(lattes, '2', 'N')]);
    expect(postsOf(lattes).at(-1)!.fields).toMatchObject({
      F_COD_PROD: '43',
      f_cod_curso: '00000005',
    });
    expect(getAttr(partOf(lattes.state.root, '49', 'DETALHAMENTO'), 'CODIGO-CURSO')).toBe(
      '00000005',
    );
  });

  it('iniciação científica: nível 1 e f_sta_area vazio', async () => {
    const lattes = await lattesFor();
    const op = plan(nature('47', NATURE.ic)).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(courseSearches(lattes)).toEqual([courseSearch(lattes, '1', '')]);
    expect(postsOf(lattes).at(-1)!.fields).toMatchObject({ F_COD_PROD: '45' });
  });

  it('curso que não está na lista do nível novo: nada é enviado', async () => {
    const lattes = await lattesFor();
    // A especialização só aparece no nível 2; a graduação pede o 1.
    const op = plan(nature('48', NATURE.graduacao)).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: expect.stringMatching(/^Com a natureza nova, o curso do item não está na lista/),
      status: 'erro',
    });
    expect(courseSearches(lattes)).toEqual([courseSearch(lattes, '1', 'N')]);
    expect(postsOf(lattes)).toEqual([]);
  });

  it('escolhas já planejadas na mesma mudança: a troca recusa em vez de as trocar', () => {
    const target = ORIENTACOES_BANCAS_TARGETS.find((t) => t.id === 'orientacao-concluida-outra')!;
    const working = parseXml(XML).root;
    const item = bySeq(working, '47');
    const basics = target.natureSwap!.key.split('@')[0]!;
    const change: Change = {
      element: basics,
      fields: [
        { after: NATURE.monografia, attr: 'NATUREZA', before: NATURE.graduacao, label: 'Natureza' },
      ],
      form: 'Orientação',
      key: 'k',
      kind: 'alterado',
      path: ['CURRICULO-VITAE', 'item', basics],
    };
    const planned = { institution: { before: '1', code: '2', name: 'Outra' } };
    const sent = { F_COD_PROD: '43' };
    expect(planNatureSwap(target, change, item, sent, { F_COD_PROD: '44' }, [], planned)).toEqual({
      reason: 'Natureza: troque a natureza num envio e a instituição ou o curso em outro',
    });
    // Numa recusa, o set fica como veio: os ocultos só se limpam no sucesso.
    expect(sent).toEqual({ F_COD_PROD: '43' });
    // Um tipo sem as buscas não troca a natureza sem escolher de novo.
    const bare = { ...target, lookups: undefined };
    expect(planNatureSwap(bare, change, item, sent, { F_COD_PROD: '44' }, [])).toEqual({
      reason:
        'Natureza: com a natureza nova, o Lattes pede a instituição e o curso de novo, e o conector não os escolhe neste tipo; troque no Lattes',
    });
    expect(sent).toEqual({ F_COD_PROD: '43' });
    // No sucesso, os dois ocultos vão vazios.
    expect(planNatureSwap(target, change, item, sent, { F_COD_PROD: '44' }, [])).toHaveProperty(
      'lookups',
    );
    expect(sent).toEqual({ F_COD_PROD: '43', f_dsc_outra: '', f_sub_prod: '' });
  });

  it('o Lattes com outro curso ou outra instituição: divergente, sem culpar a natureza', async () => {
    const lattes = await lattesFor();
    setAttr(partOf(lattes.state.root, '47', 'DETALHAMENTO'), 'CODIGO-CURSO', '00000002');
    const op = plan(nature('47', NATURE.monografia)).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toEqual(
      expect.objectContaining({
        detail: 'O Lattes não está como o editor espera: Curso',
        status: 'divergente',
      }),
    );
    const other = await lattesFor();
    setAttr(partOf(other.state.root, '47', 'DETALHAMENTO'), 'CODIGO-INSTITUICAO', '000000000002');
    expect(await applyOp(op, other.port)).toEqual(
      expect.objectContaining({
        detail: 'O Lattes não está como o editor espera: Instituição',
        status: 'divergente',
      }),
    );
    // Nenhuma busca de curso nem envio: a conferência vem antes.
    expect(other.state.log.some((l) => /^prc_curso_form/i.test(l.path))).toBe(false);
    expect([...postsOf(lattes), ...postsOf(other)]).toEqual([]);
  });

  it('a página do simulado traz cada oculto da troca uma vez só', async () => {
    const lattes = await lattesFor();
    const html = await lattes.port.get(
      `pkg_orient.form?f_cod=${lattes.state.code}&f_tipo=C&f_seq=47`,
    );
    for (const name of ['f_sub_prod', 'f_dsc_outra']) {
      expect(html.split(`name="${name}"`)).toHaveLength(2);
    }
  });

  it('o Lattes com outra natureza: nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(partOf(lattes.state.root, '47', 'DADOS-BASICOS'), 'NATUREZA', NATURE.ic);
    const op = plan(nature('47', NATURE.monografia)).ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(lattes)).toEqual([]);
  });
});

describe('natureza das bancas', () => {
  const manualOf = (id: string) =>
    Object.entries(ORIENTACOES_BANCAS_TARGETS.find((t) => t.id === id)!.manual ?? {}).find(
      ([key]) => key.endsWith('@NATUREZA'),
    )?.[1];

  it('cada tipo com uma natureza diz que ela é o tipo do item', () => {
    expect(manualOf('banca-trabalho-mestrado')).toMatch(/^Mestrado é o tipo do item no Lattes/);
    expect(manualOf('banca-julgadora-outra')).toMatch(/^Outra é o tipo do item no Lattes/);
    expect(reasonOf(set('46', 'DADOS-BASICOS', { NATUREZA: 'Outra' }))).toMatch(
      /^Natureza: Concurso público é o tipo do item no Lattes/,
    );
  });

  it('as outras participações ficam à mão, com o motivo', () => {
    expect(manualOf('banca-trabalho-outra')).toMatch(/não tem opção para outras participações/);
  });

  // testa_nivel() de PKG_BANCA_TRAB.form, lido em 27/10/2026 sem enviar.
  const QUALIFIED = (root: XElement) =>
    set('45', 'DETALHAMENTO', {
      'CODIGO-CURSO': '00000001',
      'CODIGO-INSTITUICAO': '000000000001',
      'NOME-CURSO': 'Genética e Biologia Molecular',
      'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
    })(root);
  const toDoctorate = set('45', 'DADOS-BASICOS', {
    NATUREZA: 'Exame de qualificação de doutorado',
  });
  const planQualification = (productionLookups = true) => {
    const original = parseXml(XML).root;
    QUALIFIED(original);
    const working = parseXml(XML).root;
    QUALIFIED(working);
    toDoctorate(working);
    return planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { editProduction: true, productionLookups },
    );
  };

  it('qualificação de mestrado para doutorado: o rádio e as escolhas de novo', () => {
    const p = planQualification();
    expect(p.unsupported).toEqual([]);
    expect(p.ops[0]).toMatchObject({
      expect: { F_COD_PROD: 'A16' },
      lookups: {
        course: { before: '00000001', code: '00000001' },
        institution: { before: '000000000001', code: '000000000001' },
        nature: 'A13',
      },
      set: { F_COD_PROD: 'A13' },
      target: 'banca-trabalho-qualificacao',
    });
    expect(planQualification(false).unsupported[0]?.reason).toMatch(/desligado nesta montagem/);
  });

  it('qualificação sem a instituição no item: à mão, com o motivo', () => {
    expect(reasonOf(toDoctorate)).toMatch(/o item não tem o código dela; troque no Lattes$/);
  });

  it('no Lattes simulado: grava, com as buscas no nível da natureza nova', async () => {
    const lattes = await lattesFor();
    QUALIFIED(lattes.state.root);
    const op = planQualification().ops[0] as ProductionOp;
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const paths = lattes.state.log.map((l) => l.path);
    // inst() e curso() da página: GD e nível 4, sem área, para a de doutorado.
    expect(paths.some((p) => /^PRC_INST_FORM\?.*F_NIVEL=GD/i.test(p))).toBe(true);
    expect(paths.some((p) => /^prc_curso_form\?.*f_nivel=4&f_sta_area=N/i.test(p))).toBe(true);
    expect(postsOf(lattes).at(-1)!.fields).toMatchObject({ F_COD_PROD: 'A13' });
    expect(getAttr(partOf(lattes.state.root, '45', 'DADOS-BASICOS'), 'NATUREZA')).toBe(
      'Exame de qualificação de doutorado',
    );
  });
});

describe('Lattes simulado: os cursos a mais da busca TESE', () => {
  const coursesAt = async (query: string) => {
    const lattes = await lattesFor();
    const html = await lattes.port.get(`prc_curso_form?f_cod=${lattes.state.code}&${query}`);
    return [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]!.trim());
  };

  it('só a busca TESE do nível listado mostra o curso; as outras ficam como eram', async () => {
    expect(await coursesAt('f_pgm=TESE&f_inst=V000000000001&f_nivel=2&f_sta_area=N')).toContain(
      'V00000005',
    );
    expect(await coursesAt('f_pgm=TESE&f_inst=V000000000001&f_nivel=1&f_sta_area=N')).not.toContain(
      'V00000005',
    );
    // A busca da formação (f_pgm=FORM), em qualquer nível, só com os cursos de sempre.
    expect(await coursesAt('f_pgm=FORM&f_nivel=2&f_inst=V000000000001')).toEqual([
      'V00000001',
      'V00000002',
    ]);
  });
});
