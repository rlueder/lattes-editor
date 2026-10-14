import { describe, expect, it } from 'vitest';

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
import type { FormControl } from '../src/bridge/form.ts';
import { planChanges } from '../src/bridge/plan.ts';
import {
  noUndoReason,
  sentEntry,
  sentLogText,
  UNDO_KEY_PREFIX,
  undoOp,
} from '../src/bridge/sent-log.ts';
import { acceptChange, type Change, diffDocuments, resolvePath } from '../src/model/changes.ts';
import { getAttr, parseXml, type XElement } from '../src/model/xml.ts';

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

  it('conferida, tira o item do original, e a mudança sai da lista', () => {
    const { changes, original, working } = planRemoval(idioma('EN'));
    const change = changes[0]!;
    expect(acceptChange(original, working, change)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
    expect(all(original).some(idioma('EN'))).toBe(false);
    // Já tirado: o caminho não resolve mais.
    expect(acceptChange(original, working, change)).toBe(false);
    const raiz: Change = { ...change, path: [original.name] };
    expect(acceptChange(original, working, raiz)).toBe(false);
  });
});

// ------------------------------------------------------------ Lattes falso

function decodeForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split('&')) {
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k!)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

interface FakeOptions {
  /** O POST de exclusão também apaga esta linha (idioma:N, vinculo:N, atuacao:N). */
  alsoDeletes?: string;
  /** f_ctr do formulário. */
  ctr?: string;
  /** O menu sem as listas. */
  emptyMenu?: boolean;
  /** O servidor ignora a exclusão. */
  ignoreDelete?: boolean;
  /** A sessão cai no GET de número n. */
  logonAtGet?: number;
  /** O formulário vem sem o del() que troca f_ctr para E. */
  noDel?: boolean;
  /** readForm não acha o formulário. */
  noForm?: boolean;
  /** A resposta do POST, que a conferência não deve ler. */
  response?: string;
}

const DEL_SCRIPT = `<script>function del(){ if (confirm('Deseja realmente excluir?')) { fecha(); dc.f_ctr.value = 'E'; enviar(); } }</script>`;
const DELE_SCRIPT = `<script>function dele(){ location = 'pkg_ativ.form?f_cod=K&f_seq_ativ=5&f_ctr=E2'; }</script>`;

function fakeLattes(opts: FakeOptions = {}) {
  const idiomas = new Map<string, { code: string; levels: Record<string, string> }>([
    ['1', { code: 'EN', levels: { COMPR: 'B', CONVERSA: 'B', ESCREVE: 'B', LE: 'B' } }],
    ['2', { code: 'ES', levels: { LE: 'P' } }],
  ]);
  const atuacoes = new Map<
    string,
    { codinst: string; vinculos: Map<string, Record<string, string>> }
  >([
    [
      '5',
      {
        codinst: 'D001',
        vinculos: new Map([
          ['1', { f_ano_fim: '2012', f_ano_ini: '2011', f_mes_fim: '12', f_mes_ini: '01' }],
          ['2', { f_ano_fim: '', f_ano_ini: '2013', f_mes_fim: '', f_mes_ini: '01' }],
        ]),
      },
    ],
    ['6', { codinst: 'D009', vinculos: new Map() }],
  ]);
  const posts: { body: Record<string, string>; path: string }[] = [];
  let gets = 0;
  const del = opts.noDel ? '' : DEL_SCRIPT;

  const port: LattesPort = {
    async get(path) {
      gets += 1;
      if (opts.logonAtGet === gets) return '<form action="pkg_sec.logon">';
      const param = (name: string) => new RegExp(`${name}=(\\w+)`).exec(path)?.[1] ?? '';
      if (path.startsWith('pkg_idioma.lista')) {
        return [...idiomas.keys()]
          .map((seq) => `<a href="pkg_idioma.form?f_cod=K&amp;f_seq=${seq}">${seq}</a>`)
          .concat('<a href="pkg_idioma.form?f_cod=K">Novo</a>')
          .join('\n');
      }
      if (path.startsWith('pkg_idioma.form')) return `FORM:GN_IDIOMA:${param('f_seq')}\n${del}`;
      if (path.startsWith('pkg_ativ.lista')) {
        return [...atuacoes]
          .map(
            ([seq, a]) =>
              `<a href="PKG_ATIV.cargos_vinculos?f_cod=K&amp;f_codinst=${a.codinst}&amp;f_seq_ativ=${seq}">${seq}</a>`,
          )
          .join('\n');
      }
      if (path.startsWith('PKG_ATIV.cargos_vinculos')) {
        const seq = param('f_seq_ativ');
        const a = atuacoes.get(seq);
        if (!a) return '';
        return (
          [...a.vinculos.keys()]
            .map(
              (h) =>
                `<a href='PKG_ATIV.vinculos?f_cod=K&f_codinst=${a.codinst}&f_seq_ativ=${seq}&f_seq_hist=${h}'>v</a>`,
            )
            .join('\n') + DELE_SCRIPT
        );
      }
      if (path.startsWith('PKG_ATIV.vinculos')) {
        return `FORM:GN_ATIV_VINC:${param('f_seq_ativ')}:${param('f_seq_hist')}\n${del}`;
      }
      return '';
    },
    menuHtml: () =>
      opts.emptyMenu
        ? '<p>menu</p>'
        : `<a onclick="modalCV1.setarUrl(&quot;pkg_ativ.lista?f_cod=K&quot;, true)">Atuação</a>
           <a onclick="modalCV1.setarUrl(&quot;pkg_idioma.lista?f_cod=K&quot;, true)">Idiomas</a>`,
    async post(path, body) {
      const pairs = decodeForm(body);
      posts.push({ body: pairs, path });
      if (pairs.f_ctr === 'E' && !opts.ignoreDelete) {
        if (path === 'PKG_IDIOMA.FORM') idiomas.delete(pairs.f_seq!);
        if (path === 'PKG_ATIV.VINCULOS')
          atuacoes.get(pairs.f_seq_ativ!)?.vinculos.delete(pairs.f_seq_hist!);
        const [kind, id] = (opts.alsoDeletes ?? ':').split(':');
        if (kind === 'idioma') idiomas.delete(id!);
        if (kind === 'vinculo') atuacoes.get('5')?.vinculos.delete(id!);
        if (kind === 'atuacao') atuacoes.delete(id!);
      }
      return opts.response ?? '';
    },
    readForm(html, form) {
      if (opts.noForm) return undefined;
      const m = /^FORM:(\w+):([\w:]*)/.exec(html);
      if (!m || m[1] !== form) return undefined;
      const ctr = opts.ctr ?? 'U';
      if (form === 'GN_IDIOMA') {
        const state = idiomas.get(m[2]!);
        if (!state) return undefined;
        const list: FormControl[] = [
          { name: 'f_cod', type: 'hidden', value: 'K' },
          { name: 'f_seq', type: 'hidden', value: m[2]! },
          { name: 'f_ctr', type: 'hidden', value: ctr },
          { name: 'F_COD_IDIOMA', selected: [state.code], type: 'select-one', value: state.code },
        ];
        for (const s of ['LE', 'CONVERSA', 'ESCREVE', 'COMPR']) {
          const level = state.levels[s];
          list.push({ checked: Boolean(level), name: `FC_${s}`, type: 'checkbox', value: 'on' });
          for (const l of ['P', 'R', 'B']) {
            list.push({ checked: level === l, name: `F_${s}`, type: 'radio', value: l });
          }
        }
        list.push({ name: 'salvar', type: 'button', value: 'Salvar' });
        return list;
      }
      const [seqAtiv, seqHist] = m[2]!.split(':');
      const state = atuacoes.get(seqAtiv!)?.vinculos.get(seqHist!);
      if (!state) return undefined;
      return [
        { name: 'f_cod', type: 'hidden', value: 'K' },
        { name: 'f_codinst', type: 'hidden', value: atuacoes.get(seqAtiv!)!.codinst },
        { name: 'f_seq_ativ', type: 'hidden', value: seqAtiv! },
        { name: 'f_seq_hist', type: 'hidden', value: seqHist! },
        { name: 'f_ctr', type: 'hidden', value: ctr },
        ...Object.entries(state).map(([name, value]) => ({ name, type: 'text', value })),
        { disabled: true, name: 'f_vinc', type: 'text', value: 'Celetista' },
        { name: 'f_vinculo', type: 'hidden', value: '' },
      ];
    },
  };
  return { atuacoes, idiomas, port, posts };
}

function opFor(match: (el: XElement) => boolean): DeleteOp {
  const op = planRemoval(match).plan.ops[0];
  if (!op || !isDeleteOp(op)) throw new Error('sem operação de exclusão');
  return op;
}

describe('aplicar a exclusão no Lattes falso', () => {
  it('exclui o idioma pelo formulário dele, com f_ctr=E, e confere pela lista', async () => {
    const lattes = fakeLattes({ response: '<html>qualquer coisa</html>' });
    const op = opFor(idioma('ES'));
    const r = await applyOp(op, lattes.port);
    expect(r).toEqual({
      detail: 'Excluído e conferido no Lattes',
      key: op.key,
      status: 'conferido',
    });
    expect(lattes.posts).toHaveLength(1);
    expect(lattes.posts[0]!.path).toBe('PKG_IDIOMA.FORM');
    expect(lattes.posts[0]!.body).toMatchObject({
      f_cod: 'K',
      F_COD_IDIOMA: 'ES',
      f_ctr: 'E',
      f_seq: '2',
      F_LE: 'P',
      FC_LE: 'on',
    });
    expect([...lattes.idiomas.keys()]).toEqual(['1']);
  });

  it('exclui o vínculo pelo formulário dele, como o del() do Lattes', async () => {
    const lattes = fakeLattes();
    const op = opFor(vinculo('1'));
    const r = await applyDelete(op, lattes.port);
    expect(r.status).toBe('conferido');
    expect(lattes.posts[0]!.path).toBe('PKG_ATIV.VINCULOS');
    expect(lattes.posts[0]!.body).toMatchObject({
      f_codinst: 'D001',
      f_ctr: 'E',
      f_seq_ativ: '5',
      f_seq_hist: '1',
      // O del() não passa pelo check(): f_vinculo vai como a página traz.
      f_vinculo: '',
    });
    expect('f_vinc' in lattes.posts[0]!.body).toBe(false);
    expect([...lattes.atuacoes.get('5')!.vinculos.keys()]).toEqual(['2']);
  });

  it('a fila segue para a próxima depois de uma exclusão conferida', async () => {
    const lattes = fakeLattes();
    const results = await applyAll([opFor(idioma('ES')), opFor(vinculo('2'))], lattes.port);
    expect(results.map((r) => r.status)).toEqual(['conferido', 'conferido']);
  });

  it('o item que continua na lista não conta como excluído', async () => {
    const lattes = fakeLattes({ ignoreDelete: true });
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/continua na lista.*Confira no Lattes/);
  });

  it('outra linha que some junto é avisada', async () => {
    const idiomaJunto = await applyDelete(
      opFor(idioma('ES')),
      fakeLattes({ alsoDeletes: 'idioma:1' }).port,
    );
    expect(idiomaJunto.status).toBe('divergente');
    expect(idiomaJunto.detail).toMatch(/além do item: idioma:1/);
    const vinculoJunto = await applyDelete(
      opFor(vinculo('1')),
      fakeLattes({ alsoDeletes: 'vinculo:2' }).port,
    );
    expect(vinculoJunto.detail).toMatch(/além do item: vinculo:2/);
    const outraAtuacao = await applyDelete(
      opFor(vinculo('1')),
      fakeLattes({ alsoDeletes: 'atuacao:6' }).port,
    );
    expect(outraAtuacao.detail).toMatch(/além do item: atuacao:6/);
  });

  it('a atuação que some depois de excluir o vínculo é avisada', async () => {
    const r = await applyDelete(opFor(vinculo('1')), fakeLattes({ alsoDeletes: 'atuacao:5' }).port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/conferência falhou \(Atuação 5 não encontrada/);
  });

  it('sessão que cai depois do envio também pede conferência à mão', async () => {
    // GETs: lista, form 1, form 2, form 2 de novo; depois do POST, a lista.
    const r = await applyDelete(opFor(idioma('ES')), fakeLattes({ logonAtGet: 5 }).port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/sessão do Lattes caiu/);
  });

  it('nada é enviado quando o Lattes não está como o editor espera', async () => {
    const lattes = fakeLattes();
    lattes.idiomas.get('2')!.levels.LE = 'B';
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toMatch(/F_LE/);
    expect(lattes.posts).toEqual([]);

    const outro = fakeLattes();
    outro.atuacoes.get('5')!.vinculos.get('1')!.f_ano_ini = '2010';
    const rv = await applyDelete(opFor(vinculo('1')), outro.port);
    expect(rv.detail).toMatch(/f_ano_ini/);
    expect(outro.posts).toEqual([]);
  });

  it('nada é enviado quando a exclusão do formulário mudou', async () => {
    const lattes = fakeLattes({ noDel: true });
    const r = await applyDelete(opFor(idioma('ES')), lattes.port);
    expect(r).toMatchObject({ status: 'erro' });
    expect(r.detail).toMatch(/não exclui mais/);
    expect(lattes.posts).toEqual([]);
  });

  it('nada é enviado fora do modo de alteração', async () => {
    const lattes = fakeLattes({ ctr: 'I' });
    const r = await applyDelete(opFor(vinculo('2')), lattes.port);
    expect(r.detail).toBe('O formulário não está em modo de alteração');
    expect(lattes.posts).toEqual([]);
  });

  it('o item que não está no Lattes para tudo antes de enviar', async () => {
    const semIdioma = fakeLattes();
    semIdioma.idiomas.delete('2');
    expect((await applyDelete(opFor(idioma('ES')), semIdioma.port)).detail).toMatch(
      /Idioma ES não encontrado no Lattes \(0 achados\)/,
    );
    const semVinculo = fakeLattes();
    semVinculo.atuacoes.get('5')!.vinculos.delete('1');
    expect((await applyDelete(opFor(vinculo('1')), semVinculo.port)).detail).toBe(
      'Vínculo 1 não encontrado no Lattes',
    );
    const outraInstituicao = fakeLattes();
    outraInstituicao.atuacoes.get('5')!.codinst = 'D777';
    expect((await applyDelete(opFor(vinculo('1')), outraInstituicao.port)).detail).toMatch(
      /Atuação 5 não encontrada no Lattes \(0 achadas\)/,
    );
    expect(semIdioma.posts.length + semVinculo.posts.length + outraInstituicao.posts.length).toBe(
      0,
    );
  });

  it('menu sem as listas, formulário que não abre e sessão caída', async () => {
    const semMenu = fakeLattes({ emptyMenu: true });
    expect((await applyDelete(opFor(idioma('ES')), semMenu.port)).detail).toMatch(
      /Idiomas não encontrados/,
    );
    expect((await applyDelete(opFor(vinculo('1')), semMenu.port)).detail).toMatch(
      /Atuação profissional não encontrada/,
    );
    const semForm = await applyDelete(opFor(vinculo('1')), fakeLattes({ noForm: true }).port);
    expect(semForm).toMatchObject({
      detail: 'Formulário GN_ATIV_VINC não encontrado',
      status: 'erro',
    });
    const sessao = await applyDelete(opFor(idioma('ES')), fakeLattes({ logonAtGet: 1 }).port);
    expect(sessao.status).toBe('sessao');
    const falha: LattesPort = {
      ...fakeLattes().port,
      menuHtml: () => {
        throw new Error('aba fechada');
      },
    };
    expect(await applyDelete(opFor(idioma('ES')), falha)).toMatchObject({
      detail: 'aba fechada',
      status: 'erro',
    });
    const estranha: LattesPort = {
      ...fakeLattes().port,
      menuHtml: () => {
        const notAnError: unknown = 'sem Error';
        throw notAnError;
      },
    };
    expect((await applyDelete(opFor(idioma('ES')), estranha)).detail).toBe('Falha inesperada');
  });

  it('formulário que vira a página de login é sessão caída', async () => {
    const lattes = fakeLattes();
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
