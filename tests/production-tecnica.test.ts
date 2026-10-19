import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { ARTISTICA_TARGETS } from '../src/bridge/production/targets/artistica.ts';
import { TECNICA_TARGETS } from '../src/bridge/production/targets/tecnica.ts';
import type { ProductionTarget } from '../src/bridge/production/types.ts';
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
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

// Um item de cada tipo técnico e artístico que o motor altera (fora o trabalho
// técnico, que tem o teste dele), com título, ano, um campo do detalhamento e
// a própria pessoa como autora.
const TARGETS = [...TECNICA_TARGETS, ...ARTISTICA_TARGETS].filter(
  (t) => t.id !== 'trabalho-tecnico',
);

/** O primeiro campo de texto livre do detalhamento: "FILHO@ATRIBUTO". */
function detailOf(t: ProductionTarget): [string, string] {
  const key = Object.keys(t.fields).find(
    (k) => k.startsWith('DETALHAMENTO') && typeof t.fields[k] === 'string',
  )!;
  return key.split('@') as [string, string];
}

const SEQ = new Map(TARGETS.map((t, i) => [t.id, String(100 + i)]));

function itemXml(t: ProductionTarget): string {
  const [detail, attr] = detailOf(t);
  return `<${t.element} SEQUENCIA-PRODUCAO="${SEQ.get(t.id)}"><${t.title.child} ${t.title.attr}="Título de ${t.id}" ANO="2010"/><${detail} ${attr}="antes"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/></${t.element}>`;
}

const inGroup = (prefix: string) =>
  TARGETS.filter((t) => t.id.startsWith(prefix))
    .map(itemXml)
    .join('');

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-TECNICA>${inGroup('pro')}
<DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>${inGroup('tec-')}</DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>
</PRODUCAO-TECNICA>
<OUTRA-PRODUCAO><PRODUCAO-ARTISTICA-CULTURAL>${inGroup('arte-')}</PRODUCAO-ARTISTICA-CULTURAL></OUTRA-PRODUCAO>
</CURRICULO-VITAE>`;

const itemOf = (root: XElement, t: ProductionTarget) =>
  findIn(root, (el) => el.name === t.element)!;

const partOf = (root: XElement, t: ProductionTarget, child: string) =>
  childElements(itemOf(root, t), child)[0]!;

function opsAfter(edit: (root: XElement) => void, xml = XML): ProductionOp[] {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  const plan = planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    { editProduction: true },
  );
  expect(plan.unsupported).toEqual([]);
  return plan.ops as ProductionOp[];
}

function onlyOp(edit: (root: XElement) => void, xml = XML): ProductionOp {
  const ops = opsAfter(edit, xml);
  expect(ops).toHaveLength(1);
  return ops[0]!;
}

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor() {
  await open?.close();
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

/** A coautora que está no autorDP do menu do simulado. */
const COAUTHOR = {
  'NOME-COMPLETO-DO-AUTOR': 'Coautora de Exemplo',
  'NOME-PARA-CITACAO': 'EXEMPLO, C.',
  'ORDEM-DE-AUTORIA': '2',
};

const authorsOf = (root: XElement, t: ProductionTarget) =>
  childElements(itemOf(root, t), 'AUTORES').map((a) => getAttr(a, 'NOME-COMPLETO-DO-AUTOR'));

describe.each(TARGETS.map((t) => [t.id, t] as const))('%s no Lattes simulado', (_id, t) => {
  const [detail, attr] = detailOf(t);

  it('título e um campo do detalhamento: grava pelo formulário do tipo e confere', async () => {
    const lattes = await lattesFor();
    // Uma operação por parte do item: o título primeiro, e o detalhamento já
    // acha a linha pelo título novo.
    const ops = opsAfter((root) => {
      setAttr(partOf(root, t, t.title.child), t.title.attr, `Título revisto de ${t.id}`);
      setAttr(partOf(root, t, detail), attr, 'depois');
    });
    expect(ops.map((o) => o.match)).toEqual([
      { title: `Título de ${t.id}`, year: '2010' },
      { title: `Título revisto de ${t.id}`, year: '2010' },
    ]);
    expect(ops.every((o) => o.target === t.id)).toBe(true);
    for (const op of ops) {
      expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    }
    const [post] = postsOf(lattes);
    expect(post!.proc.toUpperCase()).toBe(t.form.action.toUpperCase());
    expect(post!.fields).toMatchObject({ f_ctr: 'U', f_titulo: `Título revisto de ${t.id}` });
    const root = lattes.state.root;
    expect(getAttr(partOf(root, t, t.title.child), t.title.attr)).toBe(`Título revisto de ${t.id}`);
    expect(getAttr(partOf(root, t, detail), attr)).toBe('depois');
    expect(authorsOf(root, t)).toEqual(['Pessoa Sintética']);
  });

  it('o Lattes com outro valor no campo: nada é enviado', async () => {
    const lattes = await lattesFor();
    setAttr(partOf(lattes.state.root, t, detail), attr, 'outro');
    const op = onlyOp((root) => setAttr(partOf(root, t, detail), attr, 'depois'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('palavras-chave: grava e preserva os autores', async () => {
    const lattes = await lattesFor();
    const op = onlyOp((root) => setKeywords(lattesSchema, itemOf(root, t), ['acervo', 'mídia']));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields.f_plv_l).toBe('acervo|-1@mídia|-1');
    expect(readKeywords(itemOf(lattes.state.root, t))).toEqual(['acervo', 'mídia']);
    expect(authorsOf(lattes.state.root, t)).toEqual(['Pessoa Sintética']);
  });

  it('pôr um coautor que está na lista de autores do Lattes', async () => {
    const lattes = await lattesFor();
    const coauthor = (root: XElement) =>
      itemOf(root, t).children.push(element('AUTORES', COAUTHOR));
    expect(await applyOp(onlyOp(coauthor), lattes.port)).toMatchObject({ status: 'conferido' });
    expect(authorsOf(lattes.state.root, t)).toEqual(['Pessoa Sintética', 'Coautora de Exemplo']);
  });

  it('tirar um coautor: a grade vai sem ele, e confere', async () => {
    const lattes = await lattesFor();
    itemOf(lattes.state.root, t).children.push(element('AUTORES', COAUTHOR));
    // O editor tem a coautora no original e a tira na cópia.
    const withCoauthor = XML.replace(
      `ORDEM-DE-AUTORIA="1"/></${t.element}>`,
      `ORDEM-DE-AUTORIA="1"/><AUTORES NOME-COMPLETO-DO-AUTOR="Coautora de Exemplo" NOME-PARA-CITACAO="EXEMPLO, C." ORDEM-DE-AUTORIA="2"/></${t.element}>`,
    );
    const op = onlyOp((root) => {
      const item = itemOf(root, t);
      item.children = item.children.filter(
        (c) => !(c.kind === 'element' && getAttr(c, 'ORDEM-DE-AUTORIA') === '2'),
      );
    }, withCoauthor);
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(authorsOf(lattes.state.root, t)).toEqual(['Pessoa Sintética']);
  });
});
