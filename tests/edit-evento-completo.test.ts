// Alteração de evento com EDIT_EVENTO_ENABLED (LAT-58): convidado,
// participante, e forma, tipo, natureza e cidade em qualquer evento. A chave
// fica desligada até o teste acompanhado; aqui ela é ligada só pelas opções do
// plano, contra o Lattes simulado.

import { afterEach, describe, expect, it } from 'vitest';

import { type ApplyGates, applyOp } from '../src/bridge/apply.ts';
import { EDIT_EVENTO_ENABLED, editContract, type EventoOp } from '../src/bridge/edit-items.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { noUndoReason, sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS>
<PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="12">
  <DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO NATUREZA="Congresso" TITULO="" ANO="2019" PAIS="Brasil" TIPO-PARTICIPACAO="" FORMA-PARTICIPACAO="Ouvinte" FLAG-DIVULGACAO-CIENTIFICA="NAO"/>
  <DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO NOME-DO-EVENTO="Congresso Brasileiro de Exemplo" CIDADE-DO-EVENTO="Porto Alegre"/>
</PARTICIPACAO-EM-CONGRESSO>
<PARTICIPACAO-EM-SEMINARIO SEQUENCIA-PRODUCAO="13">
  <DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO NATUREZA="Seminário" TITULO="Palestra" ANO="2020" PAIS="Brasil" TIPO-PARTICIPACAO="Conferencista" FORMA-PARTICIPACAO="Convidado" FLAG-DIVULGACAO-CIENTIFICA="NAO"/>
  <DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO NOME-DO-EVENTO="Seminário de Exemplo" CIDADE-DO-EVENTO="Canoas"/>
</PARTICIPACAO-EM-SEMINARIO>
<PARTICIPACAO-EM-ENCONTRO SEQUENCIA-PRODUCAO="15">
  <DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO NATUREZA="" TITULO="Pôster" ANO="2021" PAIS="Brasil" TIPO-PARTICIPACAO="Poster / Painel" FORMA-PARTICIPACAO="Participante" FLAG-DIVULGACAO-CIENTIFICA="NAO"/>
  <DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO NOME-DO-EVENTO="Encontro de Exemplo"/>
</PARTICIPACAO-EM-ENCONTRO>
</PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES></CURRICULO-VITAE>`;

function find(root: XElement, seq: string): XElement {
  let hit: XElement | undefined;
  const walk = (el: XElement) => {
    if (getAttr(el, 'SEQUENCIA-PRODUCAO') === seq) hit = el;
    for (const c of el.children) if (c.kind === 'element') walk(c);
  };
  walk(root);
  if (!hit) throw new Error(seq);
  return hit;
}

const child = (item: XElement, prefix: string) =>
  item.children.find((c): c is XElement => c.kind === 'element' && c.name.startsWith(prefix))!;
const basics = (root: XElement, seq: string) => child(find(root, seq), 'DADOS-BASICOS');
const detail = (root: XElement, seq: string) => child(find(root, seq), 'DETALHAMENTO');

function planAfter(edit: (root: XElement) => void, editEvento = true) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const changes = diffDocuments(original, working);
  return planChanges(
    changes.map((change) => ({ change, itemTitle: 'Evento' })),
    working,
    { editEvento, editOuvinte: true },
  );
}

function onlyOp(edit: (root: XElement) => void): EventoOp {
  const plan = planAfter(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as EventoOp;
}

function onlyReason(edit: (root: XElement) => void): string {
  const plan = planAfter(edit);
  expect(plan.ops).toEqual([]);
  return plan.unsupported.map((u) => u.reason).join(' | ');
}

/** As chaves ligadas do lado da extensão, como numa montagem com elas ligadas. */
const GATES: ApplyGates = { editEvento: true, lists: new Set(['formacao-complementar', 'premio']) };

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

const basicsIn = (lattes: LattesSimuladoNoTeste, seq: string) =>
  child(
    findIn(lattes.state.root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!,
    'DADOS',
  );
const detailIn = (lattes: LattesSimuladoNoTeste, seq: string) =>
  child(
    findIn(lattes.state.root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!,
    'DETALHAMENTO',
  );

describe('alteração de evento completa: chave', () => {
  it('ligada na montagem; com a opção desligada, convidado segue à mão', () => {
    expect(EDIT_EVENTO_ENABLED).toBe(true);
    const edit = (root: XElement) => setAttr(basics(root, '13'), 'TITULO', 'Outra palestra');
    expect(planAfter(edit, false).unsupported[0]!.reason).toMatch(
      /só a participação como ouvinte; a edição como Convidado/,
    );
    expect(planAfter(edit).ops.map((o) => o.kind)).toEqual(['evento']);
  });

  it('com só a chave nova, o contrato confere o formulário de eventos', () => {
    expect(editContract(true).forms.evento).toBeDefined();
  });
});

describe('alteração de evento completa: plano', () => {
  it('convidado: o tipo vai junto, sem mudar, para não ser apagado', () => {
    const op = onlyOp((root) => setAttr(basics(root, '13'), 'TITULO', 'Outra palestra'));
    expect(op).toMatchObject({ kind: 'evento', seq: '13' });
    expect(op.set).toEqual({ F_TPO: 'Conferencista', f_titulo: 'Outra palestra' });
    expect(op.expect).toEqual({
      F_COD_PROD: 'A32',
      F_FORMA: '38',
      F_TPO: 'Conferencista',
      f_titulo: 'Palestra',
    });
    expect(op.identity).toEqual({
      f_ano: ['2020'],
      f_cidade: ['Canoas'],
      f_nme_evento: ['Seminário de Exemplo'],
    });
    // O tipo que não muda não aparece para quem confere.
    expect(opRows(op).map((r) => r.label)).toEqual(['Título']);
  });

  it('participante: tipo trocado dentro da forma, e o nome do evento pelo detalhamento', () => {
    const tipo = onlyOp((root) =>
      setAttr(basics(root, '15'), 'TIPO-PARTICIPACAO', 'Apresentação oral'),
    );
    expect(tipo.set).toEqual({ F_TPO: 'Apresentação oral' });
    expect(tipo.expect).toMatchObject({ F_FORMA: '39', F_TPO: 'Poster / Painel' });
    expect(opRows(tipo)).toEqual([
      {
        after: 'Apresentação oral',
        before: 'Poster / Painel',
        label: 'Tipo de participação',
        name: 'F_TPO',
      },
    ]);
    const nome = onlyOp((root) => setAttr(detail(root, '15'), 'NOME-DO-EVENTO', 'Outro encontro'));
    expect(nome.set).toEqual({ F_TPO: 'Poster / Painel', f_nme_evento: 'Outro encontro' });
    expect(nome.identity).toEqual({ f_ano: ['2021'], f_cidade: [''] });
    expect(nome.expect).toEqual({
      F_COD_PROD: 'A35',
      F_FORMA: '39',
      f_nme_evento: 'Encontro de Exemplo',
      F_TPO: 'Poster / Painel',
    });
  });

  it('cidade, em ouvinte e em convidado', () => {
    const ouvinte = onlyOp((root) => setAttr(detail(root, '12'), 'CIDADE-DO-EVENTO', 'Canoas'));
    expect(ouvinte.set).toEqual({ f_cidade: 'Canoas' });
    expect(ouvinte.identity).toEqual({
      f_ano: ['2019'],
      f_nme_evento: ['Congresso Brasileiro de Exemplo'],
    });
    expect(ouvinte.expect).toEqual({
      f_cidade: 'Porto Alegre',
      F_COD_PROD: 'A31',
      F_FORMA: '40',
    });
    const convidado = onlyOp((root) => setAttr(detail(root, '13'), 'CIDADE-DO-EVENTO', ''));
    expect(convidado.set).toEqual({ f_cidade: '', F_TPO: 'Conferencista' });
  });

  it('forma: sair de ouvinte fica à mão; voltar a ouvinte leva o tipo vazio', () => {
    // A página monta o tipo por script: depois do envio, a releitura não o
    // veria, e o evento ficaria trocado com "não gravou".
    expect(
      onlyReason((root) => {
        const b = basics(root, '12');
        setAttr(b, 'FORMA-PARTICIPACAO', 'Convidado');
        setAttr(b, 'TIPO-PARTICIPACAO', 'Moderador');
        setAttr(b, 'TITULO', 'Mesa redonda');
      }),
    ).toMatch(/^Trocar a forma de ouvinte para convidado pelo conector espera o teste acompanhado/);
    const back = onlyOp((root) => {
      const b = basics(root, '13');
      setAttr(b, 'FORMA-PARTICIPACAO', 'Ouvinte');
      setAttr(b, 'TIPO-PARTICIPACAO', '');
    });
    expect(back.set).toEqual({ F_FORMA: '40', F_TPO: '' });
    expect(back.expect).toMatchObject({ F_FORMA: '38', F_TPO: 'Conferencista' });
    expect(opRows(back).map((r) => [r.label, r.before, r.after])).toEqual([
      ['Forma de participação', 'Convidado', 'Ouvinte'],
      ['Tipo de participação', 'Conferencista', '(vazio)'],
    ]);
  });

  it('ouvinte com um tipo antigo no XML segue alterável; o tipo não vai', () => {
    const xml = XML.replace(
      'TIPO-PARTICIPACAO="" FORMA-PARTICIPACAO="Ouvinte"',
      'TIPO-PARTICIPACAO="Conferencista" FORMA-PARTICIPACAO="Ouvinte"',
    );
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    setAttr(basics(working, '12'), 'TITULO', 'Novo');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
      working,
      { editEvento: true },
    );
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops[0]!.set).toEqual({ f_titulo: 'Novo' });
  });

  it('segue as regras do check(): tipo e título de quem apresentou, ouvinte sem tipo', () => {
    expect(onlyReason((root) => setAttr(basics(root, '13'), 'TIPO-PARTICIPACAO', ''))).toBe(
      'O Lattes exige o tipo de participação de convidado',
    );
    expect(onlyReason((root) => setAttr(basics(root, '15'), 'TITULO', ''))).toBe(
      'O Lattes exige o título da apresentação de participante',
    );
    expect(
      onlyReason((root) => setAttr(basics(root, '13'), 'TIPO-PARTICIPACAO', 'Poster / Painel')),
    ).toBe('Tipo de participação que o Lattes não tem para Convidado: Poster / Painel');
    expect(
      onlyReason((root) => setAttr(basics(root, '13'), 'FORMA-PARTICIPACAO', 'Ouvinte')),
    ).toMatch(/^Ouvinte não tem tipo/);
    expect(
      onlyReason((root) => setAttr(basics(root, '13'), 'FORMA-PARTICIPACAO', 'Palestrante')),
    ).toBe('Forma de participação que o Lattes não tem: Palestrante');
    expect(onlyReason((root) => setAttr(basics(root, '13'), 'TITULO', ''))).toBe(
      'O Lattes exige o título da apresentação de convidado',
    );
  });

  it('forma de antes que o Lattes não tem também fica à mão', () => {
    const xml = XML.replace('FORMA-PARTICIPACAO="Convidado"', 'FORMA-PARTICIPACAO=""');
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    setAttr(basics(working, '13'), 'ANO', '2022');
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
      working,
      { editEvento: true },
    );
    expect(plan.unsupported.map((u) => u.reason)).toEqual([
      'Forma de participação que o Lattes não tem: vazia',
    ]);
  });

  it('natureza: a nova vai no mesmo item, e o antes segue o tipo de evento', () => {
    const op = onlyOp((root) => setAttr(basics(root, '15'), 'NATUREZA', 'Encontro'));
    expect(op.set).toEqual({ F_COD_PROD: 'A35', F_TPO: 'Poster / Painel' });
    expect(op.expect).toMatchObject({ F_COD_PROD: 'A35' });
    // Um congresso que passa a feira: o Lattes troca a natureza no mesmo f_seq.
    const feira = onlyOp((root) => setAttr(basics(root, '12'), 'NATUREZA', 'Feira'));
    expect(feira.set).toMatchObject({ F_COD_PROD: 'A37' });
    expect(feira.expect).toMatchObject({ F_COD_PROD: 'A31' });
    expect(onlyReason((root) => setAttr(basics(root, '12'), 'NATUREZA', 'Palestra'))).toBe(
      'Natureza que o Lattes não tem: Natureza',
    );
  });

  it('o que o formulário não tem continua à mão', () => {
    expect(onlyReason((root) => setAttr(basics(root, '13'), 'IDIOMA', 'Inglês'))).toBe(
      'O formulário de eventos do Lattes não tem: Idioma',
    );
  });
});

const opFor = (edit: (root: XElement) => void): EventoOp => onlyOp(edit);

describe('alteração de evento completa: aplicar no Lattes simulado', () => {
  it('convidado, com a página como a observada: o tipo não aparece, e nada é enviado', async () => {
    // A lista F_TPO vem só com a opção vazia (o script monta o resto). A
    // conferência do tipo para antes de mandar F_TPO vazio e apagá-lo.
    const lattes = await lattesFor();
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Conferência nova'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Tipo de participação',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('convidado, se a edição mostrar o tipo gravado: envia o título com ele e confere', async () => {
    const lattes = await lattesFor({ tpoRendered: true });
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Conferência nova'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({ status: 'conferido' });
    expect(getAttr(basicsIn(lattes, '13'), 'TITULO')).toBe('Conferência nova');
    expect(getAttr(basicsIn(lattes, '13'), 'TIPO-PARTICIPACAO')).toBe('Conferencista');
    const post = lattes.state.log.find((l) => l.method === 'POST')!;
    expect(post.pairs).toContainEqual(['F_TPO', 'Conferencista']);
    expect(post.pairs).toContainEqual(['F_FORMA', '38']);
  });

  it('de ouvinte para participante com o tipo não mostrado: o envio deixaria o evento trocado', async () => {
    // Por isso o plano recusa (planShape). Aqui, a operação montada à mão
    // mostra o que aconteceria: gravado, mas a releitura não vê o tipo.
    const lattes = await lattesFor();
    const op: EventoOp = {
      expect: { F_COD_PROD: 'A31', F_FORMA: '40', F_TPO: '' },
      key: 'k',
      kind: 'evento',
      label: 'Evento',
      seq: '12',
      set: { F_FORMA: '39', F_TPO: 'Apresentação oral', f_titulo: 'Comunicação' },
    };
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'O Lattes não gravou: Tipo de participação',
      status: 'divergente',
    });
    expect(getAttr(basicsIn(lattes, '12'), 'FORMA-PARTICIPACAO')).toBe('Participante');
  });

  it('de convidado para ouvinte vai, e não oferece desfazer', async () => {
    const lattes = await lattesFor({ tpoRendered: true });
    const op = opFor((root) => {
      const b = basics(root, '13');
      setAttr(b, 'FORMA-PARTICIPACAO', 'Ouvinte');
      setAttr(b, 'TIPO-PARTICIPACAO', '');
    });
    expect((await applyOp(op, lattes.port, GATES)).status).toBe('conferido');
    const b = basicsIn(lattes, '13');
    expect(getAttr(b, 'FORMA-PARTICIPACAO')).toBe('Ouvinte');
    expect(getAttr(b, 'TIPO-PARTICIPACAO')).toBe('');
    expect(noUndoReason(op)).toMatch(/^Voltar de ouvinte para convidado ou participante/);
    expect(undoOp({ ...sentEntry(op, '1', 1000), id: 3 })).toBeUndefined();
  });

  it('a extensão com a chave desligada não grava convidado nem cidade, e grava ouvinte', async () => {
    const lattes = await lattesFor({ tpoRendered: true });
    const off: ApplyGates = { editEvento: false, lists: new Set() };
    const reason = 'Esta extensão só altera eventos de ouvinte; a alteração fica à mão';
    const convidado = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Nova'));
    expect(await applyOp(convidado, lattes.port, off)).toMatchObject({ detail: reason });
    const cidade = opFor((root) => setAttr(detail(root, '12'), 'CIDADE-DO-EVENTO', 'Pelotas'));
    expect(await applyOp(cidade, lattes.port, off)).toMatchObject({ detail: reason });
    expect(postsOf(lattes)).toEqual([]);
    const ouvinte = opFor((root) => setAttr(basics(root, '12'), 'TITULO', 'Novo'));
    expect((await applyOp(ouvinte, lattes.port, off)).status).toBe('conferido');
  });

  it('cidade gravada e conferida', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => setAttr(detail(root, '12'), 'CIDADE-DO-EVENTO', 'Pelotas'));
    expect((await applyOp(op, lattes.port, GATES)).status).toBe('conferido');
    expect(getAttr(detailIn(lattes, '12'), 'CIDADE-DO-EVENTO')).toBe('Pelotas');
  });

  it('a natureza que já está no Lattes não gera envio', async () => {
    const lattes = await lattesFor({ tpoRendered: true });
    const op = opFor((root) => setAttr(basics(root, '15'), 'NATUREZA', 'Encontro'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'O Lattes já estava assim; nada foi enviado',
      status: 'conferido',
    });
    expect(postsOf(lattes)).toEqual([]);
    // Nada foi trocado: o registro do enviado não oferece desfazer.
    expect(undoOp({ ...sentEntry(op, '1', 1000), id: 4 })).toBeUndefined();
  });

  it('para sem enviar quando a página não mostra o tipo gravado', async () => {
    // Como o Lattes marca o tipo já gravado não foi visto: se a lista vier vazia,
    // como no HTML de inclusão, mandar F_TPO vazio apagaria o tipo.
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^PKG_EVENTO\.form$/i, (html) =>
        html.replace(/<option value="Conferencista"[^>]*>Conferencista<\/option>/, ''),
      ),
      tpoRendered: true,
    });
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Nova'));
    expect(await applyOp(op, lattes.port, GATES)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Tipo de participação',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('para sem enviar quando a forma no Lattes é outra', async () => {
    const lattes = await lattesFor();
    setAttr(basicsIn(lattes, '13'), 'FORMA-PARTICIPACAO', 'Participante');
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Nova'));
    const r = await applyOp(op, lattes.port, GATES);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/Forma de participação/);
    expect(postsOf(lattes)).toEqual([]);
  });
});
