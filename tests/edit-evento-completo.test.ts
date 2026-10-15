// Alteração de evento com EDIT_EVENTO_ENABLED (LAT-58): convidado,
// participante, e forma, tipo, natureza e cidade em qualquer evento. A chave
// fica desligada até o teste acompanhado; aqui ela é ligada só pelas opções do
// plano, contra o Lattes simulado.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { EDIT_EVENTO_ENABLED, editContract, type EventoOp } from '../src/bridge/edit-items.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
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
  it('fica desligada até o teste acompanhado; desligada, convidado segue à mão', () => {
    expect(EDIT_EVENTO_ENABLED).toBe(false);
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
      f_ano: '2020',
      F_COD_PROD: 'A32',
      F_FORMA: '38',
      F_TPO: 'Conferencista',
      f_titulo: 'Palestra',
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
    expect(ouvinte.expect).toEqual({
      f_cidade: 'Porto Alegre',
      F_COD_PROD: 'A31',
      F_FORMA: '40',
      f_nme_evento: 'Congresso Brasileiro de Exemplo',
    });
    const convidado = onlyOp((root) => setAttr(detail(root, '13'), 'CIDADE-DO-EVENTO', ''));
    expect(convidado.set).toEqual({ f_cidade: '', F_TPO: 'Conferencista' });
  });

  it('forma: de ouvinte para convidado leva tipo e título; de volta, tipo vazio', () => {
    const op = onlyOp((root) => {
      const b = basics(root, '12');
      setAttr(b, 'FORMA-PARTICIPACAO', 'Convidado');
      setAttr(b, 'TIPO-PARTICIPACAO', 'Moderador');
      setAttr(b, 'TITULO', 'Mesa redonda');
    });
    expect(op.set).toEqual({ F_FORMA: '38', F_TPO: 'Moderador', f_titulo: 'Mesa redonda' });
    expect(op.expect).toEqual({
      f_ano: '2019',
      F_COD_PROD: 'A31',
      F_FORMA: '40',
      F_TPO: '',
      f_titulo: '',
    });
    expect(opRows(op).map((r) => [r.label, r.before, r.after])).toEqual([
      ['Título', '(vazio)', 'Mesa redonda'],
      ['Forma de participação', 'Ouvinte', 'Convidado'],
      ['Tipo de participação', '(vazio)', 'Moderador'],
    ]);
    const back = onlyOp((root) => {
      const b = basics(root, '13');
      setAttr(b, 'FORMA-PARTICIPACAO', 'Ouvinte');
      setAttr(b, 'TIPO-PARTICIPACAO', '');
    });
    expect(back.set).toEqual({ F_FORMA: '40', F_TPO: '' });
    expect(back.expect).toMatchObject({ F_FORMA: '38', F_TPO: 'Conferencista' });
  });

  it('segue as regras do check(): tipo e título de quem apresentou, ouvinte sem tipo', () => {
    expect(
      onlyReason((root) => setAttr(basics(root, '12'), 'FORMA-PARTICIPACAO', 'Convidado')),
    ).toBe('O Lattes exige o tipo de participação de convidado');
    expect(
      onlyReason((root) => {
        setAttr(basics(root, '12'), 'FORMA-PARTICIPACAO', 'Participante');
        setAttr(basics(root, '12'), 'TIPO-PARTICIPACAO', 'Apresentação oral');
      }),
    ).toBe('O Lattes exige o título da apresentação de participante');
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

  it('natureza: só a que segue o tipo de evento, conferida sem trocar', () => {
    const op = onlyOp((root) => setAttr(basics(root, '15'), 'NATUREZA', 'Encontro'));
    expect(op.set).toEqual({ F_COD_PROD: 'A35', F_TPO: 'Poster / Painel' });
    expect(op.expect).toMatchObject({ F_COD_PROD: 'A35' });
    expect(opRows(op)).toEqual([
      { after: 'Encontro', before: 'Encontro', label: 'Natureza', name: 'F_COD_PROD' },
    ]);
    expect(onlyReason((root) => setAttr(basics(root, '12'), 'NATUREZA', 'Feira'))).toBe(
      'A natureza segue o tipo de evento (Congresso); para trocar, inclua o evento de novo no tipo certo',
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
  it('convidado: envia o título com o tipo gravado e confere', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Conferência nova'));
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(basicsIn(lattes, '13'), 'TITULO')).toBe('Conferência nova');
    expect(getAttr(basicsIn(lattes, '13'), 'TIPO-PARTICIPACAO')).toBe('Conferencista');
    const post = lattes.state.log.find((l) => l.method === 'POST')!;
    expect(post.pairs).toContainEqual(['F_TPO', 'Conferencista']);
    expect(post.pairs).toContainEqual(['F_FORMA', '38']);
  });

  it('troca a forma e o tipo, e volta pelo desfazer', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => {
      const b = basics(root, '12');
      setAttr(b, 'FORMA-PARTICIPACAO', 'Participante');
      setAttr(b, 'TIPO-PARTICIPACAO', 'Apresentação oral');
      setAttr(b, 'TITULO', 'Comunicação');
    });
    expect((await applyOp(op, lattes.port)).status).toBe('conferido');
    const b = basicsIn(lattes, '12');
    expect(getAttr(b, 'FORMA-PARTICIPACAO')).toBe('Participante');
    expect(getAttr(b, 'TIPO-PARTICIPACAO')).toBe('Apresentação oral');
    const undo = undoOp({ ...sentEntry(op, '1', 1000), id: 3 })!;
    expect(undo.set).toEqual({ F_FORMA: '40', F_TPO: '', f_titulo: '' });
    expect((await applyOp(undo, lattes.port)).status).toBe('conferido');
    expect(getAttr(b, 'FORMA-PARTICIPACAO')).toBe('Ouvinte');
    expect(getAttr(b, 'TIPO-PARTICIPACAO')).toBe('');
  });

  it('cidade gravada e conferida', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => setAttr(detail(root, '12'), 'CIDADE-DO-EVENTO', 'Pelotas'));
    expect((await applyOp(op, lattes.port)).status).toBe('conferido');
    expect(getAttr(detailIn(lattes, '12'), 'CIDADE-DO-EVENTO')).toBe('Pelotas');
  });

  it('a natureza que já está no Lattes não gera envio', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => setAttr(basics(root, '15'), 'NATUREZA', 'Encontro'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes já estava assim; nada foi enviado',
      status: 'conferido',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('para sem enviar quando a página não mostra o tipo gravado', async () => {
    // Como o Lattes marca o tipo já gravado não foi visto: se a lista vier vazia,
    // como no HTML de inclusão, mandar F_TPO vazio apagaria o tipo.
    const lattes = await lattesFor({
      intercept: faults.rewritePages(/^PKG_EVENTO\.form$/i, (html) =>
        html.replace(/<option value="Conferencista"[^>]*>Conferencista<\/option>/, ''),
      ),
    });
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Nova'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Tipo de participação',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('para sem enviar quando a forma no Lattes é outra', async () => {
    const lattes = await lattesFor();
    setAttr(basicsIn(lattes, '13'), 'FORMA-PARTICIPACAO', 'Participante');
    const op = opFor((root) => setAttr(basics(root, '13'), 'TITULO', 'Nova'));
    const r = await applyOp(op, lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/Forma de participação/);
    expect(postsOf(lattes)).toEqual([]);
  });
});
