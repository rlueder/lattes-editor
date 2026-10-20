// A citação de um coautor pelo dicionário de coautores (src/bridge/edit-citacao.ts),
// contra o Lattes simulado.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { dictionaryRows } from '../src/bridge/edit-citacao.ts';
import { planChanges, type PlanOptions } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const author = (order: number, name: string, citation: string) =>
  `<AUTORES NOME-COMPLETO-DO-AUTOR="${name}" NOME-PARA-CITACAO="${citation}" ORDEM-DE-AUTORIA="${order}"/>`;

const work = (seq: number, title: string) =>
  `<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="${seq}"><DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="ELABORACAO_DE_PROJETO" TITULO-DO-TRABALHO-TECNICO="${title}" ANO="2005"/>${author(1, 'Pessoa Sintética', 'SINTÉTICA, P.')}${author(2, 'Coautora de Exemplo', 'EXEMPLO, C.')}</TRABALHO-TECNICO>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética" NOME-EM-CITACOES-BIBLIOGRAFICAS="SINTÉTICA, P."/>
<PRODUCAO-TECNICA>${work(31, 'Sistema Um')}${work(32, 'Sistema Dois')}</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

const OPTIONS: PlanOptions = { editCitacoes: true, editProduction: true };

const authorsIn = (root: XElement, title: string) => {
  const item = findIn(
    root,
    (e) =>
      e.name === 'TRABALHO-TECNICO' &&
      findIn(e, (d) => getAttr(d, 'TITULO-DO-TRABALHO-TECNICO') === title) !== undefined,
  )!;
  return item.children.filter((c): c is XElement => c.kind === 'element' && c.name === 'AUTORES');
};

function plan(edit: (root: XElement) => void, options = OPTIONS) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Trabalho' })),
    working,
    options,
  );
}

const coauthor = (title: string, attrs: Record<string, string>) => (root: XElement) => {
  const el = authorsIn(root, title)[1]!;
  for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v);
};

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattes() {
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

describe('citação de coautor: o plano', () => {
  it('a troca só da citação vai pelo dicionário, com o aviso na linha', () => {
    const { ops, unsupported } = plan(
      coauthor('Sistema Um', { 'NOME-PARA-CITACAO': 'EXEMPLO, C. DE' }),
    );
    expect(unsupported).toEqual([]);
    expect(ops[0]).toMatchObject({
      citation: { after: 'EXEMPLO, C. DE', before: 'EXEMPLO, C.' },
      kind: 'citacao',
      name: 'Coautora de Exemplo',
    });
    expect((ops[0] as { rows: { label: string }[] }).rows[0]!.label).toMatch(/todas as produções/);
  });

  it('a própria citação, a troca junto com o nome e a chave desligada ficam à mão', () => {
    const own = plan((root) =>
      setAttr(authorsIn(root, 'Sistema Um')[0]!, 'NOME-PARA-CITACAO', 'P. SINTÉTICA'),
    );
    expect(own.unsupported[0]?.reason).toMatch(/sua própria citação/);
    const mixed = plan(
      coauthor('Sistema Um', {
        'NOME-COMPLETO-DO-AUTOR': 'Outra Pessoa',
        'NOME-PARA-CITACAO': 'PESSOA, O.',
      }),
    );
    expect(mixed.unsupported[0]?.reason).toMatch(/num envio só dela/);
    const off = plan(coauthor('Sistema Um', { 'NOME-PARA-CITACAO': 'X, Y.' }), {
      editProduction: true,
    });
    expect(off.unsupported[0]?.reason).toMatch(/não leva: Nome para citação/);
  });

  it('a lista do dicionário como a página a escreve', () => {
    expect(
      dictionaryRows(
        '<tr class="even" onclick="pp_autor(11)">\n<td >\n&nbsp;&nbsp;&nbsp;\nCAUDURO, Fl&aacute;vio</td>\n<td  >CAUDURO, F.</td>\n<td >4</td>\n<td ><font color=red>0</font></td>\n</tr>',
      ),
    ).toEqual([{ citation: 'CAUDURO, F.', name: 'CAUDURO, Flávio', productions: '4', seq: '11' }]);
  });
});

describe('citação de coautor: o envio', () => {
  it('grava no dicionário, muda nas duas produções, e a segunda troca só confere', async () => {
    const sim = await lattes();
    const { ops } = plan((root) => {
      coauthor('Sistema Um', { 'NOME-PARA-CITACAO': 'EXEMPLO, C. DE' })(root);
      coauthor('Sistema Dois', { 'NOME-PARA-CITACAO': 'EXEMPLO, C. DE' })(root);
    });
    expect(ops).toHaveLength(2);
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({
      detail: expect.stringMatching(/nas 2 produções/),
      status: 'conferido',
    });
    for (const title of ['Sistema Um', 'Sistema Dois']) {
      expect(getAttr(authorsIn(sim.state.root, title)[1]!, 'NOME-PARA-CITACAO')).toBe(
        'EXEMPLO, C. DE',
      );
    }
    expect(postsOf(sim).at(-1)!.fields.f_nome_cit).toBe('EXEMPLO, C. DE');
    const posts = postsOf(sim).length;
    expect(await applyOp(ops[1]!, sim.port)).toMatchObject({
      detail: expect.stringMatching(/já estava/),
      status: 'conferido',
    });
    expect(postsOf(sim)).toHaveLength(posts);
  });

  it('com produção validada, ou com outra citação no Lattes, nada vai', async () => {
    const sim = await lattes();
    const { ops } = plan(coauthor('Sistema Um', { 'NOME-PARA-CITACAO': 'EXEMPLO, C. DE' }));
    sim.state.validatedCoauthors.add('Coautora de Exemplo');
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'erro' });
    sim.state.validatedCoauthors.clear();
    for (const title of ['Sistema Um', 'Sistema Dois']) {
      setAttr(authorsIn(sim.state.root, title)[1]!, 'NOME-PARA-CITACAO', 'MUDOU, C.');
    }
    expect(await applyOp(ops[0]!, sim.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(sim).filter((p) => /dic_autor\.form/i.test(p.proc))).toEqual([]);
  });
});
