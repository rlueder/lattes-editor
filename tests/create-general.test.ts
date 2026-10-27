// Inclusão pelo conector de idioma, prêmio, vínculo numa atuação existente,
// pós-doutorado e livre-docência (LAT-57), e o motivo dos que ficam à mão. Os
// envios rodam contra o Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp } from '../src/bridge/apply.ts';
import { checkContract, isBreaking, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { byHandReason, type CreateGeneralOp } from '../src/bridge/create-general.ts';
import { CREATE_SPECS } from '../src/bridge/create-items.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { element, getAttr, walk, type XDocument, type XElement } from '../src/model/xml.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start(options: Parameters<typeof withLattesSimulado>[0] = {}) {
  open = await withLattesSimulado(options);
  return open;
}

function find(root: XElement, match: (el: XElement) => boolean): XElement {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && match(el)) hit = el;
  });
  if (!hit) throw new Error('elemento não achado');
  return hit;
}

const all = (root: XElement, name: string) => {
  const out: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) out.push(el);
  });
  return out;
};

async function plan(edit: (doc: XDocument) => void) {
  const original = await loadCv(DEMO, 'demo.xml');
  const working = structuredClone(original.doc);
  edit(working);
  const entries = diffDocuments(original.doc.root, working.root).map((change) => ({
    change,
    itemTitle: '',
  }));
  return planChanges(entries, working.root, { createItems: true });
}

const push = (doc: XDocument, container: string, child: XElement) =>
  find(doc.root, (el) => el.name === container).children.push(child);

const ufrgs = (doc: XDocument) =>
  find(
    doc.root,
    (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '1',
  );

const VINCULO = {
  'ANO-INICIO': '2025',
  'FLAG-VINCULO-EMPREGATICIO': 'NAO',
  'MES-INICIO': '3',
  'OUTRO-VINCULO-INFORMADO': 'Colaboradora',
  'SEQUENCIA-HISTORICO': '9',
};

describe('planejar idioma, prêmio e vínculo', () => {
  it('cada um vira inclusão com os campos do formulário', async () => {
    const { ops, unsupported } = await plan((doc) => {
      push(
        doc,
        'IDIOMAS',
        element('IDIOMA', {
          IDIOMA: 'FR',
          'PROFICIENCIA-DE-COMPREENSAO': 'NAO_INFORMADO',
          'PROFICIENCIA-DE-LEITURA': 'BEM',
        }),
      );
      push(
        doc,
        'PREMIOS-TITULOS',
        element('PREMIO-TITULO', {
          'ANO-DA-PREMIACAO': '2024',
          'NOME-DA-ENTIDADE-PROMOTORA': 'SBG',
          'NOME-DO-PREMIO-OU-TITULO': 'Prêmio Jovem Geneticista',
        }),
      );
      ufrgs(doc).children.push(element('VINCULOS', VINCULO));
    });
    expect(unsupported).toEqual([]);
    expect(ops.map((o) => [o.kind, o.set])).toEqual([
      [
        'criar-vinculo',
        expect.objectContaining({
          f_ano_ini: '2025',
          f_outras_inf_en: '',
          f_stavinc: '1',
          f_vinc: 'Colaboradora',
        }),
      ],
      [
        'criar-dado',
        {
          F_COD_IDIOMA: 'FR',
          F_LE: 'B',
          FC_COMPR: null,
          FC_CONVERSA: null,
          FC_ESCREVE: null,
          FC_LE: 'on',
        },
      ],
      ['criar-dado', { f_agencia: 'SBG', f_ano: '2024', f_titulo: 'Prêmio Jovem Geneticista' }],
    ]);
  });

  it('o que não tem como ir pelo formulário vai à mão, com o motivo', async () => {
    const reasonOf = async (edit: (doc: XDocument) => void) =>
      (await plan(edit)).unsupported.map((u) => u.reason)[0];
    expect(
      await reasonOf((doc) => push(doc, 'IDIOMAS', element('IDIOMA', { IDIOMA: 'FR' }))),
    ).toMatch(/ao menos uma proficiência/);
    expect(
      await reasonOf((doc) =>
        push(doc, 'IDIOMAS', element('IDIOMA', { 'PROFICIENCIA-DE-LEITURA': 'BEM' })),
      ),
    ).toMatch(/Escolha o idioma/);
    expect(
      await reasonOf((doc) =>
        push(doc, 'PREMIOS-TITULOS', element('PREMIO-TITULO', { 'NOME-DO-PREMIO-OU-TITULO': 'X' })),
      ),
    ).toMatch(/nome e do ano/);
    // O nome em inglês fica fora, à vista, e o prêmio vai.
    const english = await plan((doc) =>
      push(
        doc,
        'PREMIOS-TITULOS',
        element('PREMIO-TITULO', {
          'ANO-DA-PREMIACAO': '2024',
          'NOME-DO-PREMIO-OU-TITULO': 'X',
          'NOME-DO-PREMIO-OU-TITULO-INGLES': 'X',
        }),
      ),
    );
    expect(english.ops[0]).toMatchObject({ left: ['Nome em inglês'] });
    // O vínculo novo leva "Outras informações" em português (censo de 27/10/2026).
    const withNote = await plan((doc) =>
      ufrgs(doc).children.push(element('VINCULOS', { ...VINCULO, 'OUTRAS-INFORMACOES': 'Nota' })),
    );
    expect(withNote.unsupported).toEqual([]);
    expect(withNote.ops[0]).toMatchObject({ set: { f_outras_inf: 'Nota' } });
    expect(
      await reasonOf((doc) =>
        push(
          doc,
          'ATUACOES-PROFISSIONAIS',
          element('ATUACAO-PROFISSIONAL', {}, [element('VINCULOS', VINCULO)]),
        ),
      ),
    ).toMatch(/Instituição sem código/);
    expect(
      await reasonOf((doc) =>
        ufrgs(doc).children.push(
          element('ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO', {}, [
            element('DIRECAO-E-ADMINISTRACAO', {
              'ANO-INICIO': '2020',
              'SEQUENCIA-FUNCAO-ATIVIDADE': '9',
            }),
          ]),
        ),
      ),
    ).toMatch(/ao menos uma descrição/);
  });

  it('cada tipo à mão tem o seu motivo', () => {
    for (const [name, pattern] of [
      ['LICENCA', /nascimento ou adoção/],
      ['AREA-DE-ATUACAO', /f_area_l/],
      ['DISCIPLINA', /grade leva também as que já existem/],
      ['TREINAMENTO', /grade leva também os que já existem/],
      ['LINHA-DE-PESQUISA', /grade leva também as que já existem/],
      ['FINANCIADOR-DO-PROJETO', /EDITAR_FINANCIAMENTO, que não foi lida/],
      ['PRODUCAO-CT-DO-PROJETO', /janela de produções/],
      ['ORIENTACAO', /janela de orientações/],
      ['CONSELHO-COMISSAO-E-CONSULTORIA', /órgão ou unidade/],
    ] as const) {
      expect(byHandReason(name), name).toMatch(pattern);
    }
    expect(byHandReason('IDIOMA')).toBeUndefined();
    expect(byHandReason('MBA')).toBeUndefined();
  });
});

describe('incluir no Lattes simulado', () => {
  it('idioma, prêmio, vínculo e pós-doutorado: inclui, confere, e a exportação traz cada um', async () => {
    const lattes = await start();
    const { ops, unsupported } = await plan((doc) => {
      push(doc, 'IDIOMAS', element('IDIOMA', { IDIOMA: 'FR', 'PROFICIENCIA-DE-LEITURA': 'POUCO' }));
      push(
        doc,
        'PREMIOS-TITULOS',
        element('PREMIO-TITULO', {
          'ANO-DA-PREMIACAO': '2024',
          'NOME-DA-ENTIDADE-PROMOTORA': 'SBG',
          'NOME-DO-PREMIO-OU-TITULO': 'Prêmio Jovem Geneticista',
        }),
      );
      ufrgs(doc).children.push(element('VINCULOS', VINCULO));
      push(
        doc,
        'FORMACAO-ACADEMICA-TITULACAO',
        element('POS-DOUTORADO', {
          'ANO-DE-INICIO': '2023',
          'CODIGO-INSTITUICAO': '000000000003',
          'NOME-INSTITUICAO': 'Universidade Estadual de Campinas',
          'SEQUENCIA-FORMACAO': '9',
          'STATUS-DO-CURSO': 'EM_ANDAMENTO',
        }),
      );
    });
    expect(unsupported).toEqual([]);
    const results = await applyAll(ops, lattes.port);
    expect(results.map((r) => [r.status, r.detail])).toEqual(
      results.map((r) => ['conferido', r.detail]),
    );
    expect(results.map((r) => r.assigned)).toEqual(
      expect.arrayContaining([{ 'SEQUENCIA-HISTORICO': '2' }]),
    );
    const root = lattes.state.root;
    expect(
      getAttr(
        find(root, (el) => getAttr(el, 'IDIOMA') === 'FR'),
        'PROFICIENCIA-DE-LEITURA',
      ),
    ).toBe('POUCO');
    expect(all(root, 'PREMIO-TITULO').map((p) => getAttr(p, 'ANO-DA-PREMIACAO'))).toContain('2024');
    const vinculos = all(lattes.state.root, 'VINCULOS').filter(
      (v) => getAttr(v, 'OUTRO-VINCULO-INFORMADO') === 'Colaboradora',
    );
    expect(vinculos).toHaveLength(1);
    expect(getAttr(all(root, 'POS-DOUTORADO').at(-1)!, 'NOME-INSTITUICAO')).toBe(
      'Universidade Estadual de Campinas',
    );

    // De novo: tudo já está no Lattes, nada é enviado.
    const posts = lattes.state.log.filter((l) => l.method === 'POST').length;
    const again = [];
    for (const op of ops) again.push(await applyOp(op, lattes.port));
    expect(again.map((r) => r.status)).toEqual([
      'divergente',
      'divergente',
      'divergente',
      'divergente',
    ]);
    expect(lattes.state.log.filter((l) => l.method === 'POST').length).toBe(posts);
  });

  it('idioma que a inclusão não oferece, sem lista ou sem link: para antes de enviar', async () => {
    const op = (form: CreateGeneralOp['form'], set: CreateGeneralOp['set']): CreateGeneralOp => ({
      expect: {},
      form,
      key: 'k',
      kind: 'criar-dado',
      label: 'x',
      set,
    });
    const lattes = await start();
    expect(
      await applyOp(op('idioma', { F_COD_IDIOMA: 'ZZ', FC_LE: 'on', F_LE: 'B' }), lattes.port),
    ).toMatchObject({
      detail: 'O Lattes não oferece esse idioma na inclusão',
      status: 'erro',
    });
    expect(
      await applyOp(op('premio', { f_ano: '2024', f_titulo: 'X', f_outro: 'y' }), lattes.port),
    ).toMatchObject({ detail: 'O formulário não tem: f_outro', status: 'erro' });
    expect(
      (await applyOp(op('premio', { f_ano: '2024', f_titulo: 'X'.repeat(201) }), lattes.port))
        .detail,
    ).toMatch(/limite do Lattes \(200/);
    const noMenu = await start({
      intercept: async (req, _state, next) => {
        const out = await next();
        return /pkg_menu\.menu/i.test(req.proc) && 'html' in out
          ? {
              ...out,
              html: out.html
                .replace(/pkg_premio\.lista[^'"]*/gi, '')
                .replace(/pkg_ativ\.lista[^'"]*/gi, ''),
            }
          : out;
      },
    });
    expect(
      await applyOp(op('premio', { f_ano: '2024', f_titulo: 'X' }), noMenu.port),
    ).toMatchObject({
      detail: 'A lista de prêmio não está no menu do Lattes',
      status: 'erro',
    });
    expect(
      await applyOp(
        { expect: {}, key: 'k', kind: 'criar-vinculo', label: 'v', seqAtiv: '1', set: {} },
        noMenu.port,
      ),
    ).toMatchObject({
      detail: 'Atuação profissional não encontrada no menu do Lattes',
      status: 'erro',
    });
  });

  it('o que ficou fora vai no resultado e na linha da confirmação', async () => {
    const lattes = await start();
    const premio: CreateGeneralOp = {
      expect: {},
      form: 'premio',
      key: 'k',
      kind: 'criar-dado',
      label: 'Prêmio',
      left: ['Nome em inglês'],
      set: { f_agencia: 'Sociedade', f_ano: '2024', f_titulo: 'Prêmio de teste' },
    };
    const r = await applyOp(premio, lattes.port);
    expect(r).toMatchObject({ partial: true, status: 'conferido' });
    expect(r.detail).toMatch(
      /Ficou fora, porque o formulário de inclusão do Lattes não tem: Nome em inglês$/,
    );
    expect(opRows(premio).at(-1)).toEqual({
      after: 'Nome em inglês',
      before: '',
      label: 'Fica fora (o Lattes não tem)',
      name: '(fora)',
    });
  });

  it('vínculo em atuação que não está no Lattes, ou gravado diferente', async () => {
    const lattes = await start({
      intercept: async (req, state, next) => {
        const out = await next();
        if (req.method === 'POST' && /^pkg_ativ\.vinculos$/i.test(req.proc)) {
          const v = all(state.root, 'VINCULOS').find(
            (x) => getAttr(x, 'OUTRO-VINCULO-INFORMADO') === 'Colaboradora',
          );
          if (v) v.attrs.find((a) => a.name === 'ANO-INICIO')!.value = '2020';
        }
        return out;
      },
    });
    const vinculo = (seqAtiv: string) => ({
      expect: {},
      key: 'k',
      kind: 'criar-vinculo' as const,
      label: 'v',
      seqAtiv,
      set: { f_ano_ini: '2025', f_vinc: 'Colaboradora', f_vinculo: 'Colaboradora' },
    });
    expect(await applyOp(vinculo('99'), lattes.port)).toMatchObject({
      detail: 'Atuação 99 não encontrada no Lattes (0 achadas)',
      status: 'erro',
    });
    const r = await applyOp(vinculo('1'), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(
      /^Criado no Lattes \(vínculo 2\), mas o Lattes guardou outro valor em: Ano de início/,
    );
  });

  it('o contrato dos formulários de prêmio e de vínculo bate com o simulado', async () => {
    const lattes = await start();
    const report = await checkContract(lattes.port, {
      forms: {
        ...LATTES_CONTRACT.forms,
        'criar-dado': CREATE_SPECS['criar-dado'],
        'criar-vinculo': CREATE_SPECS['criar-vinculo'],
      },
      menu: LATTES_CONTRACT.menu,
    });
    for (const kind of ['criar-dado', 'criar-vinculo']) {
      const form = report.forms.find((f) => f.kind === kind)!;
      expect(form.drifts.filter(isBreaking), kind).toEqual([]);
      expect(['ok', 'mudou'], kind).toContain(form.status);
    }
  });
});
