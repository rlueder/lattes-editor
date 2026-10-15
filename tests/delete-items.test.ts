import { afterEach, describe, expect, it } from 'vitest';

import type { LattesState } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp, type LattesPort } from '../src/bridge/apply.ts';
import { blocksKind, type ContractReport, lacksSample } from '../src/bridge/contract.ts';
import {
  applyDelete,
  ATUACAO_REASON,
  contractKind,
  DELETE_ITEMS_ENABLED,
  DELETE_OFF_REASON,
  type DeleteIdiomaOp,
  type DeleteOp,
  type DeleteVinculoOp,
  FORMACAO_REASON,
  isDeleteOp,
  planDelete,
} from '../src/bridge/delete.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { planChanges } from '../src/bridge/plan.ts';
import {
  noUndoReason,
  opBadge,
  sentEntry,
  sentLogText,
  UNDO_KEY_PREFIX,
  undoOp,
} from '../src/bridge/sent-log.ts';
import { acceptChange, type Change, diffDocuments, resolvePath } from '../src/model/changes.ts';
import { childElements, getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withSmallLattes,
} from './helpers/lattes-simulado.ts';

// ------------------------------------------------------------ planejamento

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS>
<FORMACAO-ACADEMICA-TITULACAO><GRADUACAO SEQUENCIA-FORMACAO="1" NOME-CURSO="Física"/></FORMACAO-ACADEMICA-TITULACAO>
<IDIOMAS><IDIOMA DESCRICAO-DO-IDIOMA="Sem código" PROFICIENCIA-DE-LEITURA="BEM"/>
<IDIOMA IDIOMA="EN" DESCRICAO-DO-IDIOMA="Inglês" PROFICIENCIA-DE-LEITURA="BEM" PROFICIENCIA-DE-FALA="BEM" PROFICIENCIA-DE-ESCRITA="BEM" PROFICIENCIA-DE-COMPREENSAO="BEM"/>
<IDIOMA IDIOMA="ES" DESCRICAO-DO-IDIOMA="Espanhol" PROFICIENCIA-DE-LEITURA="POUCO" PROFICIENCIA-DE-FALA="" PROFICIENCIA-DE-ESCRITA="" PROFICIENCIA-DE-COMPREENSAO=""/></IDIOMAS>
<PREMIOS-TITULOS><PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Prêmio" ANO-DA-PREMIACAO="2020"/></PREMIOS-TITULOS>
<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="009" NOME-INSTITUICAO="Y">
<VINCULOS SEQUENCIA-HISTORICO="3" ANO-INICIO="2000"/></ATUACAO-PROFISSIONAL>
<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="001" NOME-INSTITUICAO="X" SEQUENCIA-ATIVIDADE="5">
<VINCULOS SEQUENCIA-HISTORICO="1" MES-INICIO="01" ANO-INICIO="2011" MES-FIM="12" ANO-FIM="2012"/>
<VINCULOS SEQUENCIA-HISTORICO="2" MES-INICIO="01" ANO-INICIO="2013" MES-FIM="" ANO-FIM=""/>
</ATUACAO-PROFISSIONAL>
<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="010" NOME-INSTITUICAO="Z" SEQUENCIA-ATIVIDADE="9">
<VINCULOS ANO-INICIO="2001" MES-INICIO="02"/></ATUACAO-PROFISSIONAL>
</ATUACOES-PROFISSIONAIS></DADOS-GERAIS>
<DADOS-COMPLEMENTARES><FORMACAO-COMPLEMENTAR><FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO SEQUENCIA-FORMACAO="2" NOME-CURSO="Curso"/></FORMACAO-COMPLEMENTAR></DADOS-COMPLEMENTARES>
</CURRICULO-VITAE>`;

function all(root: XElement): XElement[] {
  const out: XElement[] = [];
  const visit = (el: XElement) => {
    out.push(el);
    for (const c of el.children) if (c.kind === 'element') visit(c);
  };
  visit(root);
  return out;
}

/** Remove na cópia de trabalho o primeiro elemento que casa e planeja a lista inteira. */
function planRemoval(match: (el: XElement) => boolean, deleteItems = true) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  const target = all(working).find(match)!;
  const parent = all(working).find((el) => el.children.includes(target))!;
  parent.children = parent.children.filter((c) => c !== target);
  const changes = diffDocuments(original, working);
  return {
    changes,
    original,
    plan: planChanges(
      changes.map((change) => ({ change, itemTitle: 'Item' })),
      working,
      { deleteItems },
    ),
    working,
  };
}

const idioma = (code: string) => (el: XElement) =>
  el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === code;
const vinculo = (seqHist: string) => (el: XElement) =>
  el.name === 'VINCULOS' && getAttr(el, 'SEQUENCIA-HISTORICO') === seqHist;

describe('planejar a exclusão', () => {
  it('fica desligada por padrão até o teste no Lattes real', () => {
    expect(DELETE_ITEMS_ENABLED).toBe(false);
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    const ingles = all(working).find(idioma('EN'))!;
    const idiomas = all(working).find((el) => el.name === 'IDIOMAS')!;
    idiomas.children = idiomas.children.filter((c) => c !== ingles);
    const entries = diffDocuments(original, working).map((change) => ({
      change,
      itemTitle: '',
    }));
    const off = planChanges(entries, working);
    expect(off.ops).toEqual([]);
    expect(off.unsupported.map((u) => u.reason)).toEqual([DELETE_OFF_REASON]);
  });

  it('idioma removido vira exclusão pelo código, com as proficiências de antes', () => {
    const { plan } = planRemoval(idioma('ES'));
    expect(plan.unsupported).toEqual([]);
    const op = plan.ops[0] as DeleteIdiomaOp;
    expect(op).toMatchObject({
      code: 'ES',
      kind: 'excluir-idioma',
      label: 'Excluir: Idioma · Item',
    });
    expect(op.set).toEqual({});
    expect(op.expect).toEqual({
      F_COMPR: null,
      F_CONVERSA: null,
      F_ESCREVE: null,
      F_LE: 'P',
      FC_COMPR: null,
      FC_CONVERSA: null,
      FC_ESCREVE: null,
      FC_LE: 'on',
    });
  });

  it('vínculo removido vira exclusão pela sequência da atuação e do histórico', () => {
    const { plan } = planRemoval(vinculo('1'));
    const op = plan.ops[0] as DeleteVinculoOp;
    expect(op).toMatchObject({
      codInst: '001',
      kind: 'excluir-vinculo',
      seqAtiv: '5',
      seqHist: '1',
    });
    expect(op.expect).toEqual({
      f_ano_fim: '2012',
      f_ano_ini: '2011',
      f_mes_fim: '12',
      f_mes_ini: '01',
    });
  });

  it('a atuação inteira fica à mão: no Lattes ela apaga em cascata', () => {
    const { plan } = planRemoval(
      (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '5',
    );
    expect(plan.ops).toEqual([]);
    expect(plan.unsupported.map((u) => u.reason)).toEqual([ATUACAO_REASON]);
  });

  it('as duas formações ficam à mão: excluir pode tornar pública outra', () => {
    const academica = planRemoval((el) => el.name === 'GRADUACAO');
    expect(academica.plan.unsupported.map((u) => u.reason)).toEqual([FORMACAO_REASON]);
    const complementar = planRemoval(
      (el) => el.name === 'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO',
    );
    expect(complementar.plan.unsupported.map((u) => u.reason)).toEqual([FORMACAO_REASON]);
    const tudo = planRemoval((el) => el.name === 'FORMACAO-ACADEMICA-TITULACAO');
    expect(tudo.plan.unsupported.map((u) => u.reason)).toEqual([FORMACAO_REASON]);
  });

  it('o resto fica à mão, com o motivo', () => {
    const premio = planRemoval((el) => el.name === 'PREMIO-TITULO');
    expect(premio.plan.unsupported[0]!.reason).toMatch(/não suportado ainda/);
    const semCodigo = planRemoval(
      (el) => el.name === 'IDIOMA' && getAttr(el, 'DESCRICAO-DO-IDIOMA') === 'Sem código',
    );
    expect(semCodigo.plan.unsupported[0]!.reason).toBe('Idioma sem código');
    // Atuação sem SEQUENCIA-ATIVIDADE; vínculo sem SEQUENCIA-HISTORICO.
    const semAtiv = planRemoval(
      (el) => el.name === 'VINCULOS' && getAttr(el, 'ANO-INICIO') === '2000',
    );
    expect(semAtiv.plan.unsupported[0]!.reason).toBe('Vínculo sem número de sequência');
    const semHist = planRemoval(
      (el) => el.name === 'VINCULOS' && getAttr(el, 'ANO-INICIO') === '2001',
    );
    expect(semHist.plan.unsupported[0]!.reason).toBe('Vínculo sem número de sequência');
  });

  it('recusa quando o caminho não termina no pai do item', () => {
    const { changes, working } = planRemoval(idioma('EN'));
    const change = changes[0]!;
    // O item voltou à cópia de trabalho: o caminho resolve inteiro.
    const chain = resolvePath(parseXml(XML).root, change.path);
    expect(planDelete(change, chain, 'Idioma', true)).toMatchObject({
      reason: expect.stringMatching(/ainda existe/),
    });
    expect(planDelete(change, [], 'Idioma', true)).toHaveProperty('reason');
    expect(planDelete(change, resolvePath(working, change.path), 'Idioma')).toMatchObject({
      reason: DELETE_OFF_REASON,
    });
  });
});

describe('a exclusão e o resto do conector', () => {
  const idiomaOp: DeleteIdiomaOp = {
    code: 'ES',
    expect: {},
    key: 'k',
    kind: 'excluir-idioma',
    label: 'Excluir: Idioma · Espanhol',
    set: {},
  };

  it('usa a conferência do formulário de edição de onde sai', () => {
    expect(contractKind('excluir-idioma')).toBe('idioma');
    expect(contractKind('excluir-vinculo')).toBe('vinculo');
    expect(contractKind('resumo')).toBe('resumo');
    expect(isDeleteOp(idiomaOp)).toBe(true);
    expect(isDeleteOp({ kind: 'idioma' })).toBe(false);
    expect(isDeleteOp({ kind: 'constructor' })).toBe(false);
    expect(contractKind('toString')).toBe('toString');
    const report: ContractReport = {
      checkedAt: new Date().toISOString(),
      forms: [
        {
          drifts: [{ field: 'f_seq', form: 'GN_IDIOMA', kind: 'campo-sumiu' }],
          form: 'GN_IDIOMA',
          kind: 'idioma',
          status: 'mudou',
        },
        { drifts: [], form: 'GN_ATIV_VINC', kind: 'vinculo', status: 'sem-amostra' },
      ],
      menu: [],
      status: 'mudou',
    };
    expect(blocksKind(report, 'excluir-idioma')).toHaveLength(1);
    expect(blocksKind(report, 'excluir-vinculo')).toEqual([]);
    expect(lacksSample(report, 'excluir-vinculo')?.form).toBe('GN_ATIV_VINC');
  });

  it('não se desfaz pelo registro do enviado', () => {
    const entry = { ...sentEntry(idiomaOp, '1', 0), id: 7 };
    expect(undoOp(entry)).toBeUndefined();
    expect(noUndoReason(idiomaOp)).toMatch(/não tem como desfazer/);
    expect(entry.rows).toEqual([]);
    expect(opRows(idiomaOp)).toEqual([]);
    expect(sentLogText([entry], { appVersion: '1', lattesId: '1', now: 0 })).toContain(
      'Excluir: Idioma · Espanhol (excluído e conferido)',
    );
    // Uma alteração comum continua desfazível.
    const resumo = {
      expect: { F_TEXTO: 'a' },
      key: 'r',
      kind: 'resumo' as const,
      label: 'Resumo',
      set: { F_TEXTO: 'b' },
    };
    const edit = { ...sentEntry(resumo, '1', 0), id: 8 };
    expect(noUndoReason(edit.op)).toBeUndefined();
    expect(undoOp(edit)?.key).toBe(`${UNDO_KEY_PREFIX}8`);
  });

  it('selo no registro do enviado: "removido" na exclusão, "novo" na criação, nada na alteração', () => {
    expect(opBadge(idiomaOp)).toBe('removido');
    expect(opBadge({ ...idiomaOp, kind: 'criar-atuacao' } as unknown as typeof idiomaOp)).toBe(
      'novo',
    );
    const resumo = { expect: {}, key: 'r', kind: 'resumo' as const, label: 'Resumo', set: {} };
    expect(opBadge(resumo)).toBeUndefined();
  });

  it('conferida, tira o item do original, e a mudança sai da lista', () => {
    const { changes, original, working } = planRemoval(idioma('EN'));
    const change = changes[0]!;
    expect(acceptChange(original, working, change)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
    expect(all(original).some(idioma('EN'))).toBe(false);
    // Já tirado: o caminho não resolve mais.
    expect(acceptChange(original, working, change)).toBe(false);
    // Item com atributos vazios (as proficiências do espanhol) e em outra ordem.
    const es = planRemoval(idioma('ES'));
    const esChange = es.changes.find((c) => c.kind === 'removido')!;
    const reversed = { ...esChange, fields: [...esChange.fields].reverse() };
    expect(acceptChange(es.original, es.working, reversed)).toBe(true);
    expect(diffDocuments(es.original, es.working)).toEqual([]);
    // Mudança velha cujo caminho por posição agora cai num vizinho: não mexe.
    const docs = planRemoval(
      (el) => el.name === 'IDIOMA' && getAttr(el, 'DESCRICAO-DO-IDIOMA') === 'Sem código',
    );
    const semCodigo = docs.changes.find((c) => c.kind === 'removido')!;
    const vizinho = all(docs.original).find(
      (el) => el.name === 'IDIOMA' && getAttr(el, 'DESCRICAO-DO-IDIOMA') === 'Sem código',
    )!;
    vizinho.attrs = [{ name: 'DESCRICAO-DO-IDIOMA', value: 'Outro' }];
    expect(acceptChange(docs.original, docs.working, semCodigo)).toBe(false);
    expect(all(docs.original).some((el) => getAttr(el, 'DESCRICAO-DO-IDIOMA') === 'Outro')).toBe(
      true,
    );
    expect(acceptChange(docs.original, docs.working, { ...semCodigo, element: 'X' })).toBe(false);
    const raiz: Change = { ...change, path: [original.name] };
    expect(acceptChange(original, working, raiz)).toBe(false);
  });
});

// ------------------------------------------------------------ Lattes simulado

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com o currículo
// pequeno (SMALL_CV): idiomas EN e ES, a atuação 5 com os vínculos 1 e 2 e a
// atuação 6 sem vínculo.
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withSmallLattes>[0] = {}) {
  await open?.close();
  open = await withSmallLattes(options);
  return open;
}

const idiomaIn = (state: LattesState, code: string) =>
  findIn(state.root, (el) => el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === code);
const atuacaoIn = (state: LattesState, seq: string) =>
  findIn(
    state.root,
    (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === seq,
  );
const vinculoIn = (state: LattesState, seq: string) =>
  findIn(
    atuacaoIn(state, '5')!,
    (el) => el.name === 'VINCULOS' && getAttr(el, 'SEQUENCIA-HISTORICO') === seq,
  );
const codes = (state: LattesState) =>
  childElements(findIn(state.root, (el) => el.name === 'IDIOMAS')!).map((i) =>
    getAttr(i, 'IDIOMA'),
  );

/** A exclusão também apaga outra linha (o que o conector precisa acusar). */
const alsoDeletes = (pick: (state: LattesState) => XElement | undefined) =>
  faults.afterPost((req, state) => {
    if (req.get('f_ctr') !== 'E') return;
    const el = pick(state);
    if (!el) return;
    const parent = findIn(state.root, (p) => p.children.includes(el))!;
    state.remove(parent, el);
  });

/** O formulário vem em outro modo (f_ctr) ou sem o del() que troca f_ctr para E. */
const formPages = /^(pkg_idioma\.form|PKG_ATIV\.vinculos)$/i;

function opFor(match: (el: XElement) => boolean): DeleteOp {
  const op = planRemoval(match).plan.ops[0];
  if (!op || !isDeleteOp(op)) throw new Error('sem operação de exclusão');
  return op;
}

describe('aplicar a exclusão no Lattes simulado', () => {
  it('exclui o idioma pelo formulário dele, com f_ctr=E, e confere pela lista', async () => {
    const lattes = await lattesFor({
      intercept: faults.postResponse('<html>qualquer coisa</html>'),
    });
    const op = opFor(idioma('ES'));
    const r = await applyOp(op, lattes.port);
    expect(r).toEqual({
      detail: 'Excluído e conferido no Lattes',
      key: op.key,
      status: 'conferido',
    });
    const posts = postsOf(lattes);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.proc).toBe('PKG_IDIOMA.FORM');
    expect(posts[0]!.fields).toMatchObject({
      f_cod: lattes.state.code,
      F_COD_IDIOMA: 'ES',
      f_ctr: 'E',
      f_seq: '2',
      F_LE: 'P',
      FC_LE: 'on',
    });
    expect(codes(lattes.state)).toEqual(['EN']);
  });

  it('exclui o vínculo pelo formulário dele, como o del() do Lattes', async () => {
    const lattes = await lattesFor();
    const op = opFor(vinculo('1'));
    const r = await applyDelete(op, lattes.port);
    expect(r.status).toBe('conferido');
    const [post] = postsOf(lattes);
    expect(post!.proc).toBe('PKG_ATIV.VINCULOS');
    expect(post!.fields).toMatchObject({
      f_codinst: 'D001',
      f_ctr: 'E',
      f_seq_ativ: '5',
      f_seq_hist: '1',
      // O del() não passa pelo check(): f_vinculo vai como a página traz.
      f_vinculo: '',
    });
    expect('f_vinc' in post!.fields).toBe(false);
    expect(vinculoIn(lattes.state, '1')).toBeUndefined();
    expect(vinculoIn(lattes.state, '2')).toBeDefined();
  });

  it('a fila segue para a próxima depois de uma exclusão conferida', async () => {
    const lattes = await lattesFor();
    const results = await applyAll([opFor(idioma('ES')), opFor(vinculo('2'))], lattes.port);
    expect(results.map((r) => r.status)).toEqual(['conferido', 'conferido']);
  });

  it('o item que continua na lista não conta como excluído', async () => {
    const lattes = await lattesFor({ intercept: faults.ignorePost() });
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/continua na lista.*Confira no Lattes/);
  });

  it('outra linha que some junto é avisada', async () => {
    const idiomaJunto = await applyDelete(
      opFor(idioma('ES')),
      (await lattesFor({ intercept: alsoDeletes((s) => idiomaIn(s, 'EN')) })).port,
    );
    expect(idiomaJunto.status).toBe('divergente');
    expect(idiomaJunto.detail).toMatch(/além do item: idioma:1/);
    const vinculoJunto = await applyDelete(
      opFor(vinculo('1')),
      (await lattesFor({ intercept: alsoDeletes((s) => vinculoIn(s, '2')) })).port,
    );
    expect(vinculoJunto.detail).toMatch(/além do item: vinculo:2/);
    const outraAtuacao = await applyDelete(
      opFor(vinculo('1')),
      (await lattesFor({ intercept: alsoDeletes((s) => atuacaoIn(s, '6')) })).port,
    );
    expect(outraAtuacao.detail).toMatch(/além do item: atuacao:6/);
  });

  it('a atuação que some depois de excluir o vínculo é avisada', async () => {
    const lattes = await lattesFor({ intercept: alsoDeletes((s) => atuacaoIn(s, '5')) });
    const r = await applyDelete(opFor(vinculo('1')), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/conferência falhou \(Atuação 5 não encontrada/);
  });

  it('sessão que cai depois do envio também pede conferência à mão', async () => {
    // GETs: lista, form 1, form 2, form 2 de novo; depois do POST, a lista.
    const lattes = await lattesFor({ intercept: faults.logonAtGet(5) });
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/sessão do Lattes caiu/);
  });

  it('erro no envio não diz que nada foi enviado: a lista decide', async () => {
    const chegou = await lattesFor();
    const post = chegou.port.post.bind(chegou.port);
    const caiuDepois: LattesPort = {
      ...chegou.port,
      async post(path, body) {
        await post(path, body);
        throw new Error('rede caiu');
      },
    };
    expect((await applyDelete(opFor(idioma('ES')), caiuDepois)).status).toBe('conferido');
    const naoChegou: LattesPort = {
      ...(await lattesFor()).port,
      post: () => Promise.reject(new Error('rede caiu')),
    };
    const r = await applyDelete(opFor(idioma('ES')), naoChegou);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/deu erro \(rede caiu\) e pode ter chegado.*continua na lista/);
    const estranho: LattesPort = {
      ...(await lattesFor()).port,
      post: () => {
        const notAnError: unknown = 'x';
        return Promise.reject(notAnError as Error);
      },
    };
    expect((await applyDelete(opFor(idioma('ES')), estranho)).detail).toMatch(/falha inesperada/);
  });

  it('nada é enviado quando o Lattes não está como o editor espera', async () => {
    const lattes = await lattesFor();
    setAttr(idiomaIn(lattes.state, 'ES')!, 'PROFICIENCIA-DE-LEITURA', 'BEM');
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/F_LE/);
    expect(postsOf(lattes)).toEqual([]);

    const outro = await lattesFor();
    setAttr(vinculoIn(outro.state, '1')!, 'ANO-INICIO', '2010');
    const rv = await applyDelete(opFor(vinculo('1')), outro.port);
    expect(rv.detail).toMatch(/f_ano_ini/);
    expect(postsOf(outro)).toEqual([]);
  });

  it('nada é enviado quando a exclusão do formulário mudou', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(formPages, (html) => html.replace("dc.f_ctr.value = 'E'", '')),
    });
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r).toMatchObject({ status: 'erro' });
    expect(r.detail).toMatch(/não exclui mais/);
    expect(postsOf(lattes)).toEqual([]);
  });

  it('nada é enviado fora do modo de alteração', async () => {
    const lattes = await lattesFor({
      intercept: faults.rewritePages(formPages, (html) =>
        html.replace('name="f_ctr" value="U"', 'name="f_ctr" value="I"'),
      ),
    });
    const r = await applyDelete(opFor(vinculo('2')), lattes.port);
    expect(r.detail).toBe('O formulário não está em modo de alteração');
    expect(postsOf(lattes)).toEqual([]);
  });

  it('o item que não está no Lattes para tudo antes de enviar', async () => {
    const semIdioma = await lattesFor();
    const es = idiomaIn(semIdioma.state, 'ES')!;
    semIdioma.state.remove(
      findIn(semIdioma.state.root, (el) => el.name === 'IDIOMAS')!,
      es,
    );
    expect((await applyDelete(opFor(idioma('ES')), semIdioma.port)).detail).toMatch(
      /Idioma ES não encontrado no Lattes \(0 achados\)/,
    );
    expect(postsOf(semIdioma)).toHaveLength(0);
    const semVinculo = await lattesFor();
    semVinculo.state.remove(atuacaoIn(semVinculo.state, '5')!, vinculoIn(semVinculo.state, '1')!);
    expect((await applyDelete(opFor(vinculo('1')), semVinculo.port)).detail).toBe(
      'Vínculo 1 não encontrado no Lattes',
    );
    expect(postsOf(semVinculo)).toHaveLength(0);
    const outraInstituicao = await lattesFor();
    setAttr(atuacaoIn(outraInstituicao.state, '5')!, 'CODIGO-INSTITUICAO', '777');
    expect((await applyDelete(opFor(vinculo('1')), outraInstituicao.port)).detail).toMatch(
      /Atuação 5 não encontrada no Lattes \(0 achadas\)/,
    );
    expect(postsOf(outraInstituicao)).toHaveLength(0);
  });

  it('menu sem as listas, formulário que não abre e sessão caída', async () => {
    const lattes = await lattesFor();
    const semMenu = { port: { ...lattes.port, menuHtml: () => '<p>menu</p>' } };
    expect((await applyDelete(opFor(idioma('ES')), semMenu.port)).detail).toMatch(
      /Idiomas não encontrados/,
    );
    expect((await applyDelete(opFor(vinculo('1')), semMenu.port)).detail).toMatch(
      /Atuação profissional não encontrada/,
    );
    const semForm = await applyDelete(opFor(vinculo('1')), {
      ...lattes.port,
      readForm: () => undefined,
    });
    expect(semForm).toMatchObject({
      detail: 'Formulário GN_ATIV_VINC não encontrado',
      status: 'erro',
    });
    const caida = await lattesFor({ intercept: faults.logonAtGet(1) });
    const sessao = await applyDelete(opFor(idioma('ES')), caida.port);
    expect(sessao.status).toBe('sessao');
    const falha: LattesPort = {
      ...caida.port,
      menuHtml: () => {
        throw new Error('aba fechada');
      },
    };
    expect(await applyDelete(opFor(idioma('ES')), falha)).toMatchObject({
      detail: 'aba fechada',
      status: 'erro',
    });
    const estranha: LattesPort = {
      ...caida.port,
      menuHtml: () => {
        const notAnError: unknown = 'sem Error';
        throw notAnError;
      },
    };
    expect((await applyDelete(opFor(idioma('ES')), estranha)).detail).toBe('Falha inesperada');
  });

  it('formulário que vira a página de login é sessão caída', async () => {
    const lattes = await lattesFor();
    const port: LattesPort = {
      ...lattes.port,
      async get(path) {
        if (path.startsWith('PKG_ATIV.vinculos')) {
          return '<script>location.href="pkg_sec.logon"</script>';
        }
        return lattes.port.get(path);
      },
    };
    expect((await applyDelete(opFor(vinculo('1')), port)).status).toBe('sessao');
  });
});
