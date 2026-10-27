// Atividade de ensino com disciplinas, incluída numa atuação que já está no
// Lattes (LAT-57), contra o Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp } from '../src/bridge/apply.ts';
import { checkContract, isBreaking, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import {
  type CreateAtividadeOp,
  DISCIPLINES_UNREAD,
  specGrid,
} from '../src/bridge/create-atividade.ts';
import { CREATE_SPECS } from '../src/bridge/create-items.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import {
  childElements,
  element,
  getAttr,
  setAttr,
  walk,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start() {
  open = await withLattesSimulado();
  // A atuação 1 passa a ter a instituição com curso na busca do simulado.
  setAttr(ufrgs(open.state.root), 'CODIGO-INSTITUICAO', 'V000000000003');
  return open;
}

function ufrgs(root: XElement): XElement {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '1') {
      hit = el;
    }
  });
  return hit!;
}

const disciplina = (name: string, seq: string) =>
  element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': seq }, [{ kind: 'text', value: name }]);

function ensino(attrs: Record<string, string> = {}, children = [disciplina('Genética', '1')]) {
  return element('ATIVIDADES-DE-ENSINO', {}, [
    element(
      'ENSINO',
      {
        'ANO-INICIO': '2020',
        'CODIGO-CURSO': '00000004',
        'FLAG-PERIODO': 'ATUAL',
        'MES-INICIO': '3',
        'NOME-CURSO': 'Genética e Biologia Molecular',
        'SEQUENCIA-FUNCAO-ATIVIDADE': '90',
        'TIPO-ENSINO': 'POS-GRADUACAO',
        ...attrs,
      },
      children,
    ),
  ]);
}

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

describe('atividade de ensino', () => {
  it('a grade das disciplinas como o check() a monta: oito linhas', () => {
    expect(specGrid(['Genética', 'Evolução'])).toBe(
      '1@0?Genética!2@0?Evolução!3@?!4@?!5@?!6@?!7@?!8@?!',
    );
    expect(specGrid(Array.from({ length: 9 }, (_, i) => `D${i}`)).split('!')).toHaveLength(10);
  });

  it('vira inclusão com o nível, o período e as disciplinas', async () => {
    const { ops, unsupported } = await plan((doc) =>
      ufrgs(doc.root).children.push(
        ensino({}, [disciplina('Genética', '1'), disciplina('Evolução', '2')]),
      ),
    );
    expect(unsupported).toEqual([]);
    expect(ops).toEqual([
      expect.objectContaining({
        courseCode: '00000004',
        kind: 'criar-atividade',
        seqAtiv: '1',
        set: {
          f_ano_fim: '',
          f_ano_ini: '2020',
          f_espec_l: specGrid(['Genética', 'Evolução']),
          f_mes_fim: '',
          f_mes_ini: '3',
          f_nivel: '402',
          f_status: 'S',
        },
      }),
    ]);
  });

  it('o que não tem como ir pelo formulário vai à mão, com o motivo', async () => {
    const reason = async (item: XElement) =>
      (await plan((doc) => ufrgs(doc.root).children.push(item))).unsupported[0]?.reason;
    expect(await reason(ensino({}, []))).toMatch(/ao menos uma disciplina/);
    expect(await reason(ensino({}, [disciplina('Genética: por quê?', '1')]))).toMatch(
      /usa como separador/,
    );
    expect(await reason(ensino({ 'TIPO-ENSINO': '' }))).toMatch(/tipo de ensino/);
    expect(await reason(ensino({ 'CODIGO-CURSO': '' }))).toMatch(/exige o curso/);
    expect(await reason(ensino({ 'TIPO-ENSINO': 'ENSINO-MEDIO' }))).toMatch(/não aceita curso/);
    expect(await reason(ensino({ 'ANO-INICIO': '' }))).toMatch(/ano de início/);
    expect(await reason(ensino({ 'NOME-CURSO-INGLES': 'Genetics' }))).toMatch(
      /formulário de atividade não tem: NOME-CURSO-INGLES/,
    );
    // Atuação nova: a atividade vai junto, à mão.
    const nova = await plan((doc) =>
      childElements(doc.root, 'DADOS-GERAIS')[0]!
        .children.filter(
          (c): c is XElement => c.kind === 'element' && c.name === 'ATUACOES-PROFISSIONAIS',
        )[0]!
        .children.push(element('ATUACAO-PROFISSIONAL', { 'NOME-INSTITUICAO': 'X' }, [ensino()])),
    );
    expect(nova.ops).toEqual([]);
  });
});

describe('incluir atividade de ensino no Lattes simulado', () => {
  it('busca o curso, inclui, acha a atividade nova e confere; de novo, recusa', async () => {
    const lattes = await start();
    const { ops } = await plan((doc) =>
      ufrgs(doc.root).children.push(
        ensino({}, [disciplina('Genética', '1'), disciplina('Evolução', '2')]),
      ),
    );
    const [r] = await applyAll(ops, lattes.port);
    // Os campos voltam conferidos; as disciplinas não são relidas e ficam no aviso.
    expect(r).toMatchObject({ status: 'conferido' });
    expect(r!.detail).toBe(
      `${DISCIPLINES_UNREAD} (atividade ${r!.assigned!['SEQUENCIA-FUNCAO-ATIVIDADE']})`,
    );
    const novo = childElements(
      childElements(ufrgs(lattes.state.root), 'ATIVIDADES-DE-ENSINO')[0]!,
      'ENSINO',
    ).at(-1)!;
    expect(getAttr(novo, 'TIPO-ENSINO')).toBe('POS-GRADUACAO');
    expect(getAttr(novo, 'NOME-CURSO')).toBe('Genética e Biologia Molecular');
    expect(
      childElements(novo, 'DISCIPLINA').map((d) =>
        d.children.map((c) => (c.kind === 'text' ? c.value : '')).join(''),
      ),
    ).toEqual(['Genética', 'Evolução']);

    const posts = lattes.state.log.filter((l) => l.method === 'POST').length;
    expect(await applyOp(ops[0]!, lattes.port)).toMatchObject({
      detail: 'A atuação já tem essa atividade (mesma natureza e início)',
      status: 'divergente',
    });
    expect(lattes.state.log.filter((l) => l.method === 'POST').length).toBe(posts);
  });

  it('a duplicata se confere pela natureza do formulário, não pelo link da linha', async () => {
    let edit: ((html: string) => string) | undefined;
    open = await withLattesSimulado({
      intercept: async (req, _state, next) => {
        const out = await next();
        return edit && /^pkg_ativ\.cargos_vinculos$/i.test(req.proc) && 'html' in out
          ? { ...out, html: edit(out.html) }
          : out;
      },
    });
    setAttr(ufrgs(open.state.root), 'CODIGO-INSTITUICAO', 'V000000000003');
    const { ops } = await plan((doc) => ufrgs(doc.root).children.push(ensino()));
    await applyOp(ops[0]!, open.port);
    const posts = () => open!.state.log.filter((l) => l.method === 'POST').length;
    const before = posts();
    // A linha sem f_natur_ativ no link: a natureza vem do oculto do formulário.
    edit = (html) => html.replace(/f_natur_ativ=4&amp;(f_seq_funcao=)/g, '$1');
    expect(await applyOp(ops[0]!, open.port)).toMatchObject({
      detail: 'A atuação já tem essa atividade (mesma natureza e início)',
      status: 'divergente',
    });
    // Uma atividade num link que o conector não reconhece: nada vai.
    edit = (html) =>
      html.replace(
        '</table>',
        '<tr><td><a href="pkg_ativ.cargo?f_cod=X&amp;f_item=2">Outra</a></td></tr></table>',
      );
    expect(await applyOp(ops[0]!, open.port)).toMatchObject({
      detail:
        'A tela de cargos e vínculos tem atividades que o conector não reconhece; nada foi enviado',
      status: 'erro',
    });
    expect(posts()).toBe(before);
  });

  it('a atuação se confere também pelo código da instituição', async () => {
    const lattes = await start();
    const { ops } = await plan((doc) => {
      setAttr(ufrgs(doc.root), 'CODIGO-INSTITUICAO', 'V000000000003');
      ufrgs(doc.root).children.push(ensino());
    });
    const op = ops[0] as CreateAtividadeOp;
    expect(op.codInst).toBe('V000000000003');
    // O código certo acha a atuação (e para adiante, pela duplicata ou pelo envio).
    expect((await applyOp(op, lattes.port)).detail).not.toMatch(/não encontrada/);
    expect(await applyOp({ ...op, codInst: 'V999999999999' }, lattes.port)).toMatchObject({
      detail: 'Atuação 1 não encontrada no Lattes (0 achadas)',
      status: 'erro',
    });
  });

  it('atuação que não está no Lattes ou curso fora da lista: para antes de enviar', async () => {
    const lattes = await start();
    const op: CreateAtividadeOp = {
      courseCode: '99999999',
      expect: {},
      key: 'k',
      kind: 'criar-atividade',
      label: 'Ensino',
      seqAtiv: '1',
      set: { f_ano_ini: '2020', f_espec_l: specGrid(['X']), f_nivel: '402', f_status: 'S' },
    };
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'Curso não encontrado na lista do Lattes (0 achados)',
      status: 'erro',
    });
    expect(await applyOp({ ...op, seqAtiv: '77' }, lattes.port)).toMatchObject({
      detail: 'Atuação 77 não encontrada no Lattes (0 achadas)',
      status: 'erro',
    });
    expect(
      await applyOp(
        { ...op, courseCode: undefined, set: { ...op.set, f_outro: 'x' } },
        lattes.port,
      ),
    ).toMatchObject({ detail: 'O formulário de atividade não tem: f_outro', status: 'erro' });
  });

  it('o contrato do formulário de atividade bate com o simulado', async () => {
    const lattes = await start();
    const report = await checkContract(lattes.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-atividade': CREATE_SPECS['criar-atividade'] },
      menu: LATTES_CONTRACT.menu,
    });
    const form = report.forms.find((f) => f.kind === 'criar-atividade')!;
    expect(form.drifts.filter(isBreaking)).toEqual([]);
    expect(['ok', 'mudou']).toContain(form.status);
  });
});
