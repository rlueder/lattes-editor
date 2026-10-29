// As peças de "Atualizar do Lattes" (src/bridge/refresh/) uma a uma: o que a
// leitura cobre, a leitura na aba, o plano das linhas e a entrada no editor.
// Os itens e as linhas são sintéticos.

import { describe, expect, it } from 'vitest';

import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import type { FormControl } from '../src/bridge/form.ts';
import { country, date, language } from '../src/bridge/production/mappers.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import { applyReading } from '../src/bridge/refresh/apply-reading.ts';
import {
  formNamesOf,
  groupOfList,
  leftOutReason,
  readableFormProcs,
  refreshGroups,
} from '../src/bridge/refresh/coverage.ts';
import { LATTES_REFRESH_ENABLED } from '../src/bridge/refresh/enabled.ts';
import { fromForm } from '../src/bridge/refresh/from-form.ts';
import { mergeInto, mergeReadings, targetOf } from '../src/bridge/refresh/merge.ts';
import { planRefresh } from '../src/bridge/refresh/plan.ts';
import {
  FORMS_PER_TASK,
  formValues,
  readFormPage,
  readRefreshPart,
  type RefreshPort,
} from '../src/bridge/refresh/read.ts';
import type { ListSnapshot } from '../src/census/test-ledger.ts';
import { loadedOf, mergeMarks } from '../src/model/form-read.ts';
import { isNewProduction, newItem } from '../src/model/production.ts';
import {
  childElements,
  firstChild,
  getAttr,
  parseXml,
  serializeElement,
  type XElement,
} from '../src/model/xml.ts';
import { availabilityToForm } from '../src/schema/availability.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

const target = (id: string) => PRODUCTION_TARGETS.find((t) => t.id === id)!;
const xmlOf = (el: XElement) => serializeElement(el).join('');

describe('o que a leitura cobre', () => {
  it('a chave e a capacidade andam juntas', () => {
    expect((BRIDGE_FEATURES as readonly string[]).includes('atualizar-do-lattes')).toBe(
      LATTES_REFRESH_ENABLED,
    );
  });

  it('acha o grupo de cada lista do menu, com parâmetros a mais e sem f_cod', () => {
    expect(groupOfList('pkg_artigo.lista?')?.targets.map((t) => t.id)).toEqual([
      'artigo-publicado',
    ]);
    expect(groupOfList('prc_bib_demais_lista?f_cod_tipo=1A')?.targets[0]?.id).toBe('traducao');
    expect(groupOfList('pkg_orient.lista?f_tipo=C')?.label).toBe('Orientações concluídas');
    expect(
      groupOfList('pkg_arte_nova.lista?f_cod_tipo=MU&f_sta_divulgacao_cientifica=S')?.targets[0]
        ?.id,
    ).toBe('arte-MU');
    expect(groupOfList('pkg_premio.lista?')).toBeUndefined();
  });

  it('projetos, patentes, registros, licenças e linhas ficam de fora, com o motivo', () => {
    const out = refreshGroups()
      .filter((g) => !g.readable)
      .flatMap((g) => g.targets.map((t) => t.id));
    expect(out).toEqual(
      expect.arrayContaining(['projeto', 'patente', 'registro-PC', 'licenca', 'linha-de-pesquisa']),
    );
    expect(leftOutReason('registro-MR')).toMatch(/titulares/);
    expect(leftOutReason('artigo-publicado')).toBeUndefined();
    expect(readableFormProcs().has('pkg_projeto.form')).toBe(false);
    expect(readableFormProcs().has('pkg_artigo.form')).toBe(true);
    expect(formNamesOf('pkg_lvr_cap.lista')).toEqual(['GN_LIVRO', 'GN_CAP']);
    expect(formNamesOf('nada')).toEqual([]);
  });
});

describe('a volta do formulário para o XML', () => {
  it('cada conversão do conector tem o caminho de volta', () => {
    const map = (toForm?: (v: string) => string | undefined) => ({ field: 'f', toForm });
    expect(fromForm('X', 'A', map(), 'livre')).toBe('livre');
    expect(fromForm('X', 'A', map(availabilityToForm), '')).toBe('NAO_INFORMADO');
    expect(fromForm('X', 'A', map(availabilityToForm), 'Restrita')).toBe('RESTRITA');
    expect(fromForm('X', 'A', map(country), '')).toBe('');
    expect(fromForm('X', 'A', map(country), 'BRA')).toBe('Brasil');
    expect(fromForm('X', 'A', map(date), '05/03/2020')).toBe('05032020');
    expect(fromForm('X', 'A', map(language), 'PT')).toBe('Português');
    expect(
      fromForm(
        'X',
        'A',
        map(() => undefined),
        'S',
      ),
    ).toBeUndefined();
  });
});

const control = (c: Partial<FormControl> & { name: string }): FormControl => ({
  type: 'text',
  value: '',
  ...c,
});

const ARTICLE_FORM = `<form name="GN_ARTIGO"><input name="f_titulo" value="Título"></form>
<script>var autorProvider = [{"l":"Ana","c":"","t":"LIMA, A."},{}];</script>`;

/** Lê formulários de mentira: o nome do <form> e um campo de título. */
const fakeRead = (html: string, name: string): FormControl[] | undefined =>
  html.includes(`name="${name}"`) ? [control({ name: 'f_titulo', value: 'Título' })] : undefined;

describe('a leitura na aba', () => {
  it('cada campo como a página mostra: rádio marcado, caixa, lista e desabilitado', () => {
    expect(
      formValues([
        control({ name: 'f_titulo', value: 'A' }),
        control({ name: 'f_titulo', value: 'repetido' }),
        control({ checked: false, name: 'F_RELEV', type: 'radio', value: 'S' }),
        control({ checked: true, name: 'F_RELEV', type: 'radio', value: 'N' }),
        control({ checked: false, name: 'f_caixa', type: 'checkbox', value: '1' }),
        control({ checked: true, name: 'f_marcada', type: 'checkbox', value: '1' }),
        control({ name: 'f_lista', selected: ['3'], type: 'select-one', value: '3' }),
        control({ name: 'f_vazia', type: 'select-one', value: '' }),
        control({ disabled: true, name: 'f_inst', value: 'Universidade' }),
        control({ name: 'ok', type: 'button', value: 'Salvar' }),
        control({ name: '', value: 'sem nome' }),
      ]),
    ).toEqual({
      F_RELEV: 'N',
      f_caixa: '',
      f_inst: 'Universidade',
      f_lista: '3',
      f_marcada: '1',
      f_titulo: 'A',
      f_vazia: '',
    });
  });

  it('caixas de mesmo nome: as marcadas juntas, por vírgula, no lugar do oculto X', () => {
    expect(
      formValues([
        control({ name: 'f_tematica', type: 'hidden', value: 'X' }),
        control({ checked: true, name: 'f_tematica', type: 'checkbox', value: 'EA' }),
        control({ checked: false, name: 'f_tematica', type: 'checkbox', value: 'PC' }),
        control({ checked: true, name: 'f_tematica', type: 'checkbox', value: 'AI' }),
        control({ name: 'f_tpo_cooperacao', type: 'hidden', value: 'X' }),
        control({ checked: false, name: 'f_tpo_cooperacao', type: 'checkbox', value: 'IE' }),
      ]),
    ).toEqual({ f_tematica: 'EA,AI', f_tpo_cooperacao: '' });
  });

  it('o primeiro formulário pedido que a página tem, com as grades dela', () => {
    const page = readFormPage(
      ARTICLE_FORM,
      { forms: ['GN_LIVRO', 'GN_ARTIGO'], link: 'x' },
      fakeRead,
    );
    expect(page.form).toBe('GN_ARTIGO');
    expect(page.values).toEqual({ f_titulo: 'Título' });
    expect(page.grids?.f_autores_l?.[0]).toMatchObject({ l: 'Ana', t: 'LIMA, A.' });
    expect(page.grids?.f_plv_l).toBeUndefined();
    expect(readFormPage('<p>nada</p>', { forms: ['GN_ARTIGO'], link: 'x' }, fakeRead)).toEqual({
      error: 'sem-formulario',
      link: 'x',
    });
  });

  it('link com f_ctr, de procedimento fora da leitura ou sem f_seq não é pedido', async () => {
    const asked: string[] = [];
    const port: RefreshPort = {
      get: async (path) => {
        asked.push(path);
        return ARTICLE_FORM;
      },
      readForm: fakeRead,
    };
    const part = await readRefreshPart(port, '', 'K000000000', {
      reads: [
        { forms: ['GN_ARTIGO'], link: 'PKG_ARTIGO.form?f_cod=K&f_seq=1&f_ctr=E' },
        { forms: [], link: 'pkg_publicar.enviar?f_seq=1' },
        { forms: [], link: 'PKG_PROJETO.form?f_seq=1' },
        { forms: ['GN_ARTIGO'], link: 'PKG_ARTIGO.form?f_cod=K' },
        { forms: ['GN_ARTIGO'], link: 'PKG_ARTIGO.form?f_cod=K&f_seq=2' },
      ],
      step: 'formularios',
    });
    expect(asked).toEqual(['PKG_ARTIGO.form?f_cod=K&f_seq=2']);
    expect(part.step === 'formularios' && part.forms.map((f) => f.error)).toEqual([
      'erro',
      'erro',
      'erro',
      'erro',
      undefined,
    ]);
  });

  it('a sessão caída no meio devolve o que já leu e o resto da fila', async () => {
    let n = 0;
    const port: RefreshPort = {
      get: async () => (++n === 2 ? '<form action="pkg_sec.logon"></form>' : ARTICLE_FORM),
      readForm: fakeRead,
    };
    const links = [1, 2, 3].map((i) => ({
      forms: ['GN_ARTIGO'],
      link: `PKG_ARTIGO.form?f_seq=${i}`,
    }));
    const part = await readRefreshPart(port, '', 'K', { reads: links, step: 'formularios' });
    expect(part).toMatchObject({ reason: 'sessao', step: 'formularios' });
    expect(part.step === 'formularios' && part.forms).toHaveLength(1);
    expect(part.step === 'formularios' && part.rest).toEqual([
      'PKG_ARTIGO.form?f_seq=2',
      'PKG_ARTIGO.form?f_seq=3',
    ]);
  });

  it('a aba que falha no meio para com erro; acima do teto, o resto vai para a próxima parte', async () => {
    const failing: RefreshPort = {
      get: async () => {
        throw new Error('rede');
      },
      readForm: fakeRead,
    };
    const one = [{ forms: ['GN_ARTIGO'], link: 'PKG_ARTIGO.form?f_seq=1' }];
    expect(
      await readRefreshPart(failing, '', 'K', { reads: one, step: 'formularios' }),
    ).toMatchObject({ reason: 'erro', rest: ['PKG_ARTIGO.form?f_seq=1'] });
    const many = Array.from({ length: FORMS_PER_TASK + 2 }, (_, i) => ({
      forms: ['GN_ARTIGO'],
      link: `PKG_ARTIGO.form?f_seq=${i}`,
    }));
    const ok: RefreshPort = { get: async () => ARTICLE_FORM, readForm: fakeRead };
    const part = await readRefreshPart(ok, '', 'K', { reads: many, step: 'formularios' });
    expect(part.step === 'formularios' && part.forms).toHaveLength(FORMS_PER_TASK);
    expect(part.step === 'formularios' && part.rest).toHaveLength(2);
  });

  it('as listas com a sessão caída: motivo sessao e a fila inteira de volta', async () => {
    const menu = `<a onclick="setarUrl('pkg_artigo.lista?f_cod=K000000000')">Artigos</a>`;
    const port: RefreshPort = {
      get: async () => '<form action="pkg_sec.logon"></form>',
      readForm: fakeRead,
    };
    const part = await readRefreshPart(port, menu, 'K000000000', { step: 'listas' });
    expect(part).toMatchObject({ reason: 'sessao', step: 'listas', unread: ['pkg_artigo.lista?'] });
  });
});

const CV = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>
<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="1"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Um estudo de caso" ANO-DO-ARTIGO="2020"/></ARTIGO-PUBLICADO>
<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="2"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Eco" ANO-DO-ARTIGO="2021"/></ARTIGO-PUBLICADO>
</ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA></CURRICULO-VITAE>`;

const link = (n: number) => `PKG_ARTIGO.form?f_cod=K&f_seq=${n}`;

describe('o plano das linhas', () => {
  it('só a linha sem item vai ao formulário; o título curto fica como órfão', () => {
    const root = parseXml(CV).root;
    const lists: ListSnapshot = {
      'pkg_artigo.lista?': [
        { link: link(1), text: 'Um estudo de caso Artigo 2020' },
        { link: link(9), text: 'Artigo novo no Lattes 2026' },
        { link: 'pkg_artigo.outra?f_seq=3', text: 'Linha sem formulário' },
      ],
    };
    const plan = planRefresh(lists, [], root, root);
    expect(plan.reads.map((r) => r.link)).toEqual([link(9)]);
    expect(plan.orphans['pkg_artigo.lista']).toEqual(['2']);
    expect(plan.notCompared).toEqual([]);
  });

  it('a lista que falhou deixa o grupo como não comparado', () => {
    const root = parseXml(CV).root;
    const plan = planRefresh({}, ['pkg_artigo.lista?'], root, root);
    expect(plan.notCompared).toContain('Artigo publicado');
    expect(plan.reads).toEqual([]);
  });

  it('nenhum item achado numa lista com linhas: formato mudado, nada é lido', () => {
    const many = `<CURRICULO-VITAE><PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>${[1, 2, 3]
      .map(
        (i) =>
          `<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="${i}"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Artigo de exemplo ${i}" ANO-DO-ARTIGO="2020"/></ARTIGO-PUBLICADO>`,
      )
      .join('')}</ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA></CURRICULO-VITAE>`;
    const root = parseXml(many).root;
    const rows = [1, 2, 3].map((i) => ({ link: link(i), text: `outro formato ${i}` }));
    const plan = planRefresh({ 'pkg_artigo.lista?': rows }, [], root, root);
    expect(plan.notCompared).toEqual(['Artigo publicado']);
    expect(plan.reads).toEqual([]);
  });

  it('grupo de fora e as outras seções só contam as linhas a mais', () => {
    const root = parseXml(CV).root;
    const lists: ListSnapshot = {
      'pkg_artigo.lista?': [{ link: link(1), text: 'Um estudo de caso 2020' }],
      'pkg_patente_registro.lista?f_cod_tipo=PP': [
        { link: 'pkg_patente_registro.form?f_cod=K&f_seq=7', text: 'Uma patente 2024' },
      ],
      'pkg_premio.lista?': [{ link: 'pkg_premio.form?f_seq=1', text: 'Prêmio de exemplo 2024' }],
    };
    const plan = planRefresh(lists, [], root, root);
    expect(plan.notRead).toEqual([
      { label: 'Patentes', reason: expect.stringMatching(/histórico/), rows: 1 },
      { label: 'Prêmios e títulos', reason: expect.any(String), rows: 1 },
    ]);
    expect(plan.reads).toEqual([]);
  });
});

describe('a entrada no editor', () => {
  it('o tipo do formulário sai da natureza marcada, ou do único sem natureza', () => {
    const group = groupOfList('pkg_banca_trab.lista?')!.targets;
    expect(targetOf(group, { F_COD_PROD: 'A12' })?.id).toBe('banca-trabalho-doutorado');
    expect(targetOf(group, {})?.id).toBe('banca-trabalho-outra');
    expect(targetOf(groupOfList('pkg_lvr_cap.lista?')!.targets, {})).toBeUndefined();
  });

  it('leva à cópia de trabalho só o que a pessoa não mudou', () => {
    const before = parseXml(
      `<I A="1" B="1" C="1"><P X="1"/><Q Y="1"/><AUTORES N="a"/><AUTORES N="b"/></I>`,
    ).root;
    const after = parseXml(`<I A="2" B="2"><P X="2"/><R Z="1"/><AUTORES N="c"/></I>`).root;
    const working = parseXml(
      `<I A="1" B="mudei" C="1"><P X="1"/><Q Y="1"/><AUTORES N="a"/><AUTORES N="b"/></I>`,
    ).root;
    mergeInto(before, after, working);
    expect(xmlOf(working)).toBe('<I A="2" B="mudei"><P X="2"/><AUTORES N="c"/><R Z="1"/></I>');
    // Sem os atributos de antes e com outra lista de autores: tudo é da pessoa.
    const mine = parseXml(`<I><AUTORES N="minha"/><Q Y="2"/></I>`).root;
    mergeInto(before, after, mine);
    expect(xmlOf(mine)).toBe('<I><AUTORES N="minha"/><Q Y="2"/><R Z="1"/></I>');
  });

  it('formulário que não abriu, tipo não reconhecido ou linha fora do plano não entram', () => {
    const root = parseXml(CV).root;
    const plan = {
      notCompared: [],
      notRead: [],
      orphans: {},
      reads: [
        { group: 'pkg_artigo.lista', link: 'a', text: 'Linha A' },
        { group: 'pkg_lvr_cap.lista', link: 'b', text: 'Linha B' },
      ],
    };
    const out = mergeReadings({
      base: root,
      counter: 3,
      now: 1,
      plan,
      readings: [
        { error: 'sem-formulario', link: 'a' },
        { link: 'b', values: {} },
        { link: 'c', values: {} },
      ],
      working: parseXml(CV).root,
    });
    expect(out.skipped.map((s) => s.reason)).toEqual([
      'o formulário não abriu',
      'o tipo do item não foi reconhecido no formulário',
    ]);
    expect(out.marks).toEqual([]);
  });

  it('o mesmo formulário de um item órfão sem diferença conta como igual', () => {
    const base = parseXml(CV).root;
    const plan = {
      notCompared: [],
      notRead: [],
      orphans: { 'pkg_artigo.lista': ['2'] },
      reads: [{ group: 'pkg_artigo.lista', link: link(2), text: 'Eco 2021' }],
    };
    const out = mergeReadings({
      base,
      counter: 3,
      now: 1,
      plan,
      readings: [{ link: link(2), values: { f_ano: '2021', f_titulo: 'Eco' } }],
      working: parseXml(CV).root,
    });
    expect(out).toMatchObject({ added: [], changed: [], same: 1 });
  });

  it('busca de instituição, curso, agência, orientando e setores vêm dos ocultos e das grades', () => {
    const t = target('orientacao-concluida-mestrado');
    const item = newItem(lattesSchema, t.element, 5);
    applyReading(t, item, {
      grids: { f_setor_l: [{ c: '1', l: 'Educação' }, {}] },
      link: 'x',
      values: {
        f_agencia: '045',
        f_cod_curso: '',
        f_cod_curso2: ' 123 ',
        f_cod_inst: 'V000000000001',
        f_curso_old: 'Curso de Exemplo (Mestrado)',
        f_id_orientado: '9999',
        f_inst_old: 'Universidade de Exemplo',
        f_nme_agencia: 'Agência de Exemplo',
      },
    });
    const detail = firstChild(item, 'DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO')!;
    expect(getAttr(detail, 'CODIGO-INSTITUICAO')).toBe('000000000001');
    expect(getAttr(detail, 'NOME-DA-INSTITUICAO')).toBe('Universidade de Exemplo');
    expect(getAttr(detail, 'CODIGO-CURSO')).toBe('123');
    expect(getAttr(detail, 'NOME-DO-CURSO')).toBe('Curso de Exemplo');
    expect(getAttr(detail, 'CODIGO-AGENCIA-FINANCIADORA')).toBe('045');
    expect(getAttr(detail, 'NUMERO-ID-ORIENTADO')).toBe('9999');
    const setores = childElements(item, 'SETORES-DE-ATIVIDADE')[0]!;
    expect(getAttr(setores, 'SETOR-DE-ATIVIDADE-1')).toBe('Educação');
    // A mesma lista de setores, de novo, deixa o item como está; vazia, tira.
    const again = xmlOf(item);
    applyReading(t, item, { grids: { f_setor_l: [{ l: 'educação' }] }, link: 'x', values: {} });
    expect(xmlOf(item)).toBe(again);
    applyReading(t, item, { grids: { f_setor_l: [{}] }, link: 'x', values: {} });
    expect(childElements(item, 'SETORES-DE-ATIVIDADE')).toEqual([]);
  });

  it('palavras-chave novas trocam a lista; autores iguais ficam como estão', () => {
    const t = target('artigo-publicado');
    const item = parseXml(
      `<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="1"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="T"/><AUTORES NOME-COMPLETO-DO-AUTOR="Ana" NOME-PARA-CITACAO="LIMA" ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ=""/></ARTIGO-PUBLICADO>`,
    ).root;
    applyReading(t, item, {
      grids: {
        f_autores_l: [{ c: '', l: 'Ana', t: 'OUTRA CITAÇÃO' }, {}],
        f_plv_l: [{ c: '1', l: 'leitura' }, {}],
      },
      link: 'x',
      values: {},
    });
    expect(getAttr(childElements(item, 'AUTORES')[0]!, 'NOME-PARA-CITACAO')).toBe('LIMA');
    expect(getAttr(firstChild(item, 'PALAVRAS-CHAVE')!, 'PALAVRA-CHAVE-1')).toBe('leitura');
  });
});

describe('as marcas do que foi lido dos formulários', () => {
  it('só os itens novos contam como já estando no Lattes', () => {
    expect(loadedOf({ loadedMaxSequencia: 4 })).toBe(4);
    const loaded = loadedOf({
      lattesForms: [
        { kind: 'novo', readAt: 1, seq: '6', target: 'artigo-publicado' },
        { kind: 'alterado', readAt: 1, seq: '2', target: 'artigo-publicado' },
      ],
      loadedMaxSequencia: 4,
    });
    const item = (seq: number) => newItem(lattesSchema, 'ARTIGO-PUBLICADO', seq);
    expect(isNewProduction(item(6), loaded)).toBe(false);
    expect(isNewProduction(item(5), loaded)).toBe(true);
    expect(isNewProduction(item(3), loaded)).toBe(false);
  });

  it('a leitura mais nova vale, e um item novo continua novo', () => {
    const marks = mergeMarks(
      [{ kind: 'novo', readAt: 1, seq: '6', target: 'a' }],
      [
        { kind: 'alterado', readAt: 2, seq: '6', target: 'a' },
        { kind: 'alterado', readAt: 2, seq: '2', target: 'a' },
      ],
    );
    expect(marks).toEqual([
      { kind: 'novo', readAt: 2, seq: '6', target: 'a' },
      { kind: 'alterado', readAt: 2, seq: '2', target: 'a' },
    ]);
    expect(mergeMarks(undefined, [])).toEqual([]);
  });
});
