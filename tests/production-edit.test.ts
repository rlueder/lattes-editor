import { afterEach, describe, expect, it } from 'vitest';

import { seedGrids, storedGrids } from '../scripts/lattes-simulado/grades.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges, type PlanOptions, planOptionsFor } from '../src/bridge/plan.ts';
import { keywordRows, readGrids, serializeGrid } from '../src/bridge/production/grids.ts';
import { EDIT_PRODUCTION_ENABLED, type ProductionOp } from '../src/bridge/production/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { readKeywords, setKeywords } from '../src/model/production.ts';
import {
  childElements,
  element,
  getAttr,
  parseXml,
  setAttr,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { canAddKeywords, parseKeywords } from '../src/ui/keywords-inline.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-BIBLIOGRAFICA><DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA>
<OUTRA-PRODUCAO-BIBLIOGRAFICA SEQUENCIA-PRODUCAO="33"><DADOS-BASICOS-DE-OUTRA-PRODUCAO NATUREZA="OUTRA" TITULO="Ensaio de Exemplo" ANO="2004"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/></OUTRA-PRODUCAO-BIBLIOGRAFICA>
</DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA></PRODUCAO-BIBLIOGRAFICA>
<PRODUCAO-TECNICA>
<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="31"><DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="ELABORACAO_DE_PROJETO" TITULO-DO-TRABALHO-TECNICO="Sistema de Exemplo" ANO="2005"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/><AUTORES NOME-COMPLETO-DO-AUTOR="Coautora D&amp;Ávila" NOME-PARA-CITACAO="D'ÁVILA, C." ORDEM-DE-AUTORIA="2" NRO-ID-CNPQ="1234567890123456"/></TRABALHO-TECNICO>
<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="32"><DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="ELABORACAO_DE_PROJETO" TITULO-DO-TRABALHO-TECNICO="Portal de Exemplo" ANO="2006"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/><PALAVRAS-CHAVE PALAVRA-CHAVE-1="design" PALAVRA-CHAVE-2="web" PALAVRA-CHAVE-3="" PALAVRA-CHAVE-4="" PALAVRA-CHAVE-5="" PALAVRA-CHAVE-6=""/></TRABALHO-TECNICO>
</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

const ON: PlanOptions = { editProduction: true };
const ALL_GRIDS = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l'] as const;

const bySeq = (root: XElement, seq: string) =>
  findIn(root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!;

function planAfter(edit: (root: XElement) => void, options: PlanOptions = ON) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    options,
  );
}

function onlyOp(edit: (root: XElement) => void): ProductionOp {
  const plan = planAfter(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as ProductionOp;
}

const words = (seq: string, list: string[]) => (root: XElement) =>
  setKeywords(lattesSchema, bySeq(root, seq), list);

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

describe('palavras-chave: as grades como o check() as serializa', () => {
  it('chaves da lista, na ordem do objeto, com "|" e "@"; a área leva o r na frente', () => {
    // JSON, para as chaves ficarem na ordem da página (o lint ordena literais).
    const rows = (json: string) => JSON.parse(json) as Record<string, unknown>[];
    expect(
      serializeGrid(rows('[{"l":"Pessoa","c":"","t":"P.","editable":false,"deletable":true},{}]'), [
        'c',
        'l',
        't',
        'pais',
        'add',
      ]),
    ).toBe('Pessoa||P.');
    expect(
      serializeGrid(rows('[{"l":"Pessoa","c":"","t":"P."},{"l":"Outra","c":"9","t":"O."}]'), [
        'c',
        'l',
        't',
      ]),
    ).toBe('Pessoa||P.@Outra|9|O.');
    expect(
      serializeGrid(rows('[{"l":"Área","c":"99990006","r":"1","p":"2"}]'), ['l', 'c', 'r', 'p']),
    ).toBe('Área|99990006|r1|2');
    expect(serializeGrid([{}], ['l', 'c'])).toBe('');
  });

  it('lê os quatro vetores da página, com o nome do autor decodificado como a página faz', () => {
    const page = `<script>
var autorProvider =
[{"l":"Coautora D&amp;Ávila","c":"","t":"D&#39;ÁVILA, C.","editable":false,"deletable":true},{}];
</script><script>
palavraProvider =
[{"l":"design","c":"1","editable":false},{}];
</script><script>
areaProvider =
[{"l":"Programação Visual","c":"99990006","editable":false},{}];
</script><script>
var setorProvider =
[{}];
</script>`;
    const grids = readGrids(page, ALL_GRIDS);
    expect('missing' in grids).toBe(false);
    if ('missing' in grids) return;
    expect(grids.f_autores_l?.[0]).toMatchObject({ l: 'Coautora D&Ávila', t: "D'ÁVILA, C." });
    expect(grids.f_plv_l?.[0]).toMatchObject({ c: '1', l: 'design' });
    expect(readGrids(page.replace('palavraProvider', 'outroProvider'), ALL_GRIDS)).toEqual({
      missing: 'palavraProvider',
    });
  });

  it('a palavra que já estava segue com a posição dela; a nova entra com c=-1', () => {
    expect(
      keywordRows(
        [
          { c: '1', editable: false, l: 'design' },
          { c: '2', editable: false, l: 'Web' },
        ],
        ['web', 'Design de interface'],
      ),
    ).toEqual([
      { c: '2', editable: false, l: 'Web' },
      { c: '-1', l: 'Design de interface' },
    ]);
  });
});

describe('palavras-chave: o campo do formulário da linha', () => {
  it('aparece no item sem palavras cujo tipo as tem, e corta em seis', () => {
    const root = parseXml(XML).root;
    expect(canAddKeywords(bySeq(root, '31'))).toBe(true);
    expect(canAddKeywords(bySeq(root, '32'))).toBe(false);
    expect(canAddKeywords(findIn(root, (el) => el.name === 'DADOS-GERAIS')!)).toBe(false);
    expect(parseKeywords(' a, ,b,c,d,e,f,g ')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('palavras-chave: plano', () => {
  it('ligada, as palavras novas de um trabalho técnico viram a operação', () => {
    expect(EDIT_PRODUCTION_ENABLED).toBe(true);
    expect(planOptionsFor(['alterar-producao']).editProduction).toBe(true);
    expect(planOptionsFor([]).editProduction).toBe(false);
    const op = onlyOp(words('31', ['Design de interface', 'Website']));
    expect(op).toMatchObject({
      keywords: { after: ['Design de interface', 'Website'], before: [] },
      kind: 'producao',
      match: { title: 'Sistema de Exemplo', year: '2005' },
      target: 'trabalho-tecnico',
    });
    expect(opRows(op)).toEqual([
      {
        after: 'Design de interface, Website',
        before: '',
        label: 'Palavras-chave',
        name: 'f_plv_l',
      },
    ]);
  });

  it('nas que já tinham palavras, o antes vem do original', () => {
    const op = onlyOp(words('32', ['design', 'web', 'portal']));
    expect(op).toMatchObject({
      keywords: { after: ['design', 'web', 'portal'], before: ['design', 'web'] },
    });
  });

  it('a outra produção bibliográfica também; desligada, fica à mão', () => {
    expect(onlyOp(words('33', ['Tipografia']))).toMatchObject({
      match: { title: 'Ensaio de Exemplo', year: '2004' },
      target: 'outra-bibliografica',
    });
    const off = planAfter(words('33', ['Tipografia']), {});
    expect(off.ops).toEqual([]);
    expect(off.unsupported).toHaveLength(1);
  });

  it('palavra com o separador da grade fica à mão', () => {
    const plan = planAfter(words('31', ['a|b']));
    expect(plan.ops).toEqual([]);
    expect(plan.unsupported[0]!.reason).toMatch(/separar a grade/);
  });
});

describe('palavras-chave no Lattes simulado', () => {
  it('trabalho técnico: grava as palavras e preserva autores e áreas', async () => {
    const lattes = await lattesFor();
    const item = bySeq(lattes.state.root, '31');
    seedGrids(item, { areas: [['Programação Visual', '99990006']] });
    const op = onlyOp(words('31', ['Design de interface', 'Website']));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(readKeywords(item)).toEqual(['Design de interface', 'Website']);
    expect(childElements(item, 'AUTORES').map((a) => getAttr(a, 'NOME-COMPLETO-DO-AUTOR'))).toEqual(
      ['Pessoa Sintética', 'Coautora D&Ávila'],
    );
    expect(storedGrids(item).areas).toMatchObject([{ c: '99990006', l: 'Programação Visual' }]);
    const [post] = postsOf(lattes);
    expect(post).toMatchObject({ proc: 'PKG_RELATORIO.FORM' });
    expect(post!.fields).toMatchObject({
      f_area_l: 'Programação Visual|99990006',
      f_autores_l: "Pessoa Sintética||SINTÉTICA, P.@Coautora D&Ávila|1234567890123456|D'ÁVILA, C.",
      f_ctr: 'U',
      f_plv_l: 'Design de interface|-1@Website|-1',
      f_setor_l: '',
    });
  });

  it('as palavras que já estavam vão com a posição delas', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(words('32', ['design', 'web', 'portal']));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields.f_plv_l).toBe('design|1@web|2@portal|-1');
    expect(readKeywords(bySeq(lattes.state.root, '32'))).toEqual(['design', 'web', 'portal']);
  });

  it('outra produção bibliográfica: pela lista 1Z e pelo PRC_BIB_OUTRAPROD', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(words('33', ['Tipografia', 'Grid']));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]).toMatchObject({ proc: 'PRC_BIB_OUTRAPROD' });
    expect(readKeywords(bySeq(lattes.state.root, '33'))).toEqual(['Tipografia', 'Grid']);
  });

  it('desfazer volta as palavras de antes, conferindo as de depois', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(words('32', ['design', 'web', 'portal']));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    // Conferido não guarda outcome no registro: só os que não conferiram.
    const entry = { ...sentEntry(op, 'cv', Date.now()), id: 1 };
    const undo = undoOp(entry) as ProductionOp;
    expect(undo).toMatchObject({
      keywords: { after: ['design', 'web'], before: ['design', 'web', 'portal'] },
    });
    expect(await applyOp(undo, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(readKeywords(bySeq(lattes.state.root, '32'))).toEqual(['design', 'web']);
  });

  it('o Lattes com outras palavras: nada é enviado', async () => {
    const lattes = await lattesFor();
    setKeywords(lattesSchema, bySeq(lattes.state.root, '31'), ['outra']);
    const op = onlyOp(words('31', ['Website']));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Palavras-chave',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('página sem uma das grades: nada é enviado', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/pkg_relatorio\.form/i, (html) =>
        html.replace('var setorProvider', 'var outroProvider'),
      ),
    });
    const op = onlyOp(words('31', ['Website']));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'A página do Lattes não tem a grade setorProvider; nada foi enviado',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('autor que some no envio é acusado', async () => {
    const lattes = await lattesFor({
      intercept: faults.afterPost((_req, state) => {
        const item = bySeq(state.root, '31');
        item.children = item.children.filter(
          (c) =>
            !(
              c.kind === 'element' &&
              c.name === 'AUTORES' &&
              getAttr(c, 'ORDEM-DE-AUTORIA') === '2'
            ),
        );
      }),
    });
    const op = onlyOp(words('31', ['Website']));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: Autores. Confira no Lattes',
      status: 'divergente',
    });
  });

  it('POST que não grava é divergente', async () => {
    const lattes = await lattesFor({ intercept: faults.ignorePost() });
    const op = onlyOp(words('31', ['Website']));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não gravou: Palavras-chave. Confira no Lattes',
      status: 'divergente',
    });
  });

  it('dois itens com o mesmo título e ano: nada é enviado', async () => {
    const lattes = await lattesFor();
    const twin = bySeq(lattes.state.root, '32');
    const basics = childElements(twin, 'DADOS-BASICOS-DO-TRABALHO-TECNICO')[0]!;
    basics.attrs = basics.attrs.map((a) =>
      a.name === 'TITULO-DO-TRABALHO-TECNICO'
        ? { ...a, value: 'Sistema de Exemplo' }
        : a.name === 'ANO'
          ? { ...a, value: '2005' }
          : a,
    );
    const op = onlyOp(words('31', ['Website']));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes tem mais de um item com esse título e esse ano; nada foi enviado',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });
});

const basicsOf = (root: XElement, seq: string) =>
  childElements(bySeq(root, seq)).find((c) => c.name.startsWith('DADOS-BASICOS'))!;

const setBasic = (seq: string, attr: string, value: string) => (root: XElement) =>
  setAttr(basicsOf(root, seq), attr, value);

const authorsOf = (root: XElement, seq: string) =>
  childElements(bySeq(root, seq), 'AUTORES').map((a) => getAttr(a, 'NOME-COMPLETO-DO-AUTOR'));

describe('alterar campos de uma produção no Lattes simulado', () => {
  it('título e natureza de um trabalho técnico: grava e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      setBasic('31', 'TITULO-DO-TRABALHO-TECNICO', 'Sistema Revisto')(root);
      setBasic('31', 'NATUREZA', 'PARECER')(root);
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields).toMatchObject({ f_titulo: 'Sistema Revisto' });
    const basics = basicsOf(lattes.state.root, '31');
    expect(getAttr(basics, 'TITULO-DO-TRABALHO-TECNICO')).toBe('Sistema Revisto');
    expect(getAttr(basics, 'NATUREZA')).toBe('PARECER');
    // As grades seguem como estavam.
    expect(authorsOf(lattes.state.root, '31')).toHaveLength(2);
  });

  it('título de uma outra produção bibliográfica', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(setBasic('33', 'TITULO', 'Ensaio Revisto'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(basicsOf(lattes.state.root, '33'), 'TITULO')).toBe('Ensaio Revisto');
  });

  it('o Lattes com outro valor no campo: nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(basicsOf(lattes.state.root, '31'), 'NATUREZA', 'RELATORIO_TECNICO');
    const op = onlyOp(setBasic('31', 'NATUREZA', 'PARECER'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('campo que o formulário não tem fica à mão, com o motivo', () => {
    const plan = planAfter((root) => {
      // O formulário de outra produção bibliográfica não tem DOI (lido em 26/10/2026).
      const basics = childElements(bySeq(root, '33')).find((c) =>
        c.name.startsWith('DADOS-BASICOS'),
      )!;
      setAttr(basics, 'DOI', '10.1234/novo');
    });
    expect(plan.ops).toEqual([]);
    expect(plan.unsupported.map((u) => u.reason)).toEqual([
      expect.stringMatching(/não tem campo para DOI/),
    ]);
  });
});

describe('alterar autores de uma produção no Lattes simulado', () => {
  it('tirar um coautor: a grade vai sem ele, e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      const item = bySeq(root, '31');
      item.children = item.children.filter(
        (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-DE-AUTORIA') === '2'),
      );
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(authorsOf(lattes.state.root, '31')).toEqual(['Pessoa Sintética']);
  });

  it('pôr um coautor que já está na lista de autores do Lattes', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => {
      bySeq(root, '33').children.push(
        element('AUTORES', {
          'NOME-COMPLETO-DO-AUTOR': 'Coautora de Exemplo',
          'NOME-PARA-CITACAO': 'EXEMPLO, C.',
          'ORDEM-DE-AUTORIA': '2',
        }),
      );
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(authorsOf(lattes.state.root, '33')).toEqual(['Pessoa Sintética', 'Coautora de Exemplo']);
  });

  it('trocar só a citação de um autor fica à mão: a grade não leva', () => {
    const plan = planAfter((root) => {
      const author = childElements(bySeq(root, '31'), 'AUTORES')[1]!;
      setAttr(author, 'NOME-PARA-CITACAO', 'ÁVILA, C. D.');
    });
    expect(plan.ops).toEqual([]);
    expect(plan.unsupported[0]?.reason).toBe(
      'A grade de autores do Lattes não leva: Nome para citação',
    );
  });
});
