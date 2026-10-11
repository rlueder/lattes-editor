import { describe, expect, it } from 'vitest';

import { applyAll, applyOp, type LattesPort, sameInstitution } from '../src/bridge/apply.ts';
import {
  encodeLatin1Form,
  type FormControl,
  pairValue,
  setPairs,
  successfulPairs,
  withCheckRules,
} from '../src/bridge/form.ts';
import { cvCodeFrom, findLinks, isLogonPage } from '../src/bridge/lattes-html.ts';
import { type BridgeOp, planChange, planChanges } from '../src/bridge/plan.ts';
import {
  bridgeMessage,
  editorMessage,
  fromSamePage,
  isBridgeMessage,
  isEditorMessage,
} from '../src/bridge/protocol.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { parseXml, setAttr, type XElement } from '../src/model/xml.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS>
<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo" TEXTO-RESUMO-CV-RH-EN="Summary"/>
<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="D001" NOME-INSTITUICAO="X" SEQUENCIA-ATIVIDADE="5">
<VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="CELETISTA" MES-INICIO="01" ANO-INICIO="2011" MES-FIM="12" ANO-FIM="2012" OUTRAS-INFORMACOES="" OUTRAS-INFORMACOES-INGLES="" FLAG-DEDICACAO-EXCLUSIVA="NAO" FLAG-VINCULO-EMPREGATICIO="SIM" CARGA-HORARIA-SEMANAL="40"/>
</ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`;

function find(root: XElement, name: string): XElement {
  const stack = [root];
  while (stack.length) {
    const el = stack.pop()!;
    if (el.name === name) return el;
    for (const c of el.children) if (c.kind === 'element') stack.push(c);
  }
  throw new Error(name);
}

function changesAfter(edit: (root: XElement) => void) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return { changes: diffDocuments(original, working), working };
}

// ---------------------------------------------------------------- Lattes falso

function decodeForm(body: string): [string, string][] {
  return body.split('&').map((part) => {
    const [k, v = ''] = part.split('=');
    const dec = (s: string) =>
      s
        .replace(/\+/g, ' ')
        .replace(/%([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
    return [dec(k!), dec(v)];
  });
}

interface FakeOptions {
  /** O POST não grava este campo. */
  dropField?: string;
  /** A sessão cai no passo n (contagem de GETs). */
  logonAtGet?: number;
  /** O POST também muda outro campo. */
  sideEffect?: [string, string];
}

function fakeLattes(opts: FakeOptions = {}) {
  const vinculo: Record<string, string> = {
    f_ano_fim: '2012',
    f_ano_ini: '2011',
    f_carga: '40',
    f_cod: 'K000000000',
    f_codinst: 'D001',
    f_ctr: 'U',
    f_enqua: '',
    f_enqua_en: '',
    f_mes_fim: '12',
    f_mes_ini: '01',
    f_outras_inf: '',
    f_outras_inf_en: '',
    f_regime: '',
    f_seq_ativ: '5',
    f_seq_hist: '1',
    f_stavinc: '1',
    f_status: 'N',
    f_tipo_privacidade: '1',
    f_vinculo: '',
  };
  const resumo: Record<string, string> = { F_TEXTO: 'Resumo', F_TEXTO_EN: 'Summary', f_ctr: 'U' };
  const posts: { body: string; path: string }[] = [];
  let gets = 0;

  const controls = (state: Record<string, string>, form: string): FormControl[] => {
    const list: FormControl[] = Object.entries(state)
      .filter(
        ([k]) =>
          !['f_outras_inf_en', 'f_regime', 'f_status'].includes(k) || form !== 'GN_ATIV_VINC',
      )
      .map(([name, value]) => ({ name, type: 'text', value }));
    if (form === 'GN_ATIV_VINC') {
      list.push({ disabled: true, name: 'f_vinc', type: 'text', value: 'Celetista' });
      list.push({
        checked: state.f_regime === '3',
        name: 'f_regime',
        type: 'checkbox',
        value: '3',
      });
      list.push({ checked: state.f_status === 'S', name: 'f_status', type: 'radio', value: 'S' });
      list.push({ checked: state.f_status === 'N', name: 'f_status', type: 'radio', value: 'N' });
      list.push({
        maxLength: 2000,
        name: 'f_outras_inf_en',
        type: 'textarea',
        value: state.f_outras_inf_en!,
      });
      list.push({ name: 'salvar', type: 'button', value: 'Salvar' });
    }
    return list.filter(
      (c, i, all) =>
        all.findIndex((x) => x.name === c.name && x.type === c.type) === i || c.type === 'radio',
    );
  };

  const port: LattesPort = {
    async get(path) {
      gets += 1;
      if (opts.logonAtGet === gets) return '<form action="pkg_sec.logon">';
      if (path.startsWith('pkg_ativ.lista')) {
        return `<a onclick="setarUrl(&quot;PKG_ATIV.cargos_vinculos?f_cod=K000000000&amp;f_codinst=D001&amp;f_seq_ativ=5&quot;)">x</a>
                <a href="PKG_ATIV.cargos_vinculos?f_cod=K000000000&amp;f_codinst=D009&amp;f_seq_ativ=6">y</a>`;
      }
      if (path.startsWith('PKG_ATIV.cargos_vinculos')) {
        return `<a href='PKG_ATIV.vinculos?f_cod=K000000000&f_codinst=D001&f_seq_ativ=5&f_seq_hist=1'>v</a>`;
      }
      if (path.startsWith('PKG_ATIV.vinculos')) return 'FORM:GN_ATIV_VINC';
      if (path.startsWith('pkg_resume.')) return 'FORM:RES';
      return '';
    },
    menuHtml: () =>
      `<a onclick="modalCV1.setarUrl(&quot;pkg_ativ.lista?f_cod=K000000000&quot;, true)">Atuação</a>
       <a onclick="modalCV1.setarUrl(&quot;pkg_resume.prc_resume?f_cod=K000000000&quot;, true)">Resumo</a>`,
    async post(path, body) {
      posts.push({ body, path });
      const state = path === 'PKG_ATIV.VINCULOS' ? vinculo : resumo;
      const pairs = decodeForm(body);
      for (const key of Object.keys(state)) {
        if (key === opts.dropField) continue;
        const v = pairs.find(([k]) => k === key)?.[1];
        state[key] = v ?? (key === 'f_regime' ? '' : state[key]!);
      }
      // A página volta com f_vinculo vazio, como no Lattes.
      vinculo.f_vinculo = '';
      if (opts.sideEffect) state[opts.sideEffect[0]] = opts.sideEffect[1];
      return "<script>self.parent.modalCV2.setarUrl('PKG_ATIV.cargos_vinculos', true)</script>";
    },
    readForm(html, form) {
      if (html === 'FORM:GN_ATIV_VINC' && form === 'GN_ATIV_VINC') return controls(vinculo, form);
      if (html === 'FORM:RES' && form === 'RES') return controls(resumo, form);
      return undefined;
    },
  };
  return { port, posts, resumo, vinculo };
}

function vinculoOp(edit: (v: XElement) => void): BridgeOp {
  const { changes, working } = changesAfter((root) => edit(find(root, 'VINCULOS')));
  const plan = planChanges(
    changes.map((change) => ({ change, itemTitle: 'X' })),
    working,
  );
  expect(plan.unsupported).toEqual([]);
  return plan.ops[0]!;
}

// ---------------------------------------------------------------- testes

describe('ponte: formulário', () => {
  it('envia só controles bem-sucedidos e copia f_vinc para f_vinculo', () => {
    const controls: FormControl[] = [
      { name: 'a', type: 'text', value: '1' },
      { disabled: true, name: 'f_vinc', type: 'text', value: 'Celetista' },
      { name: 'f_vinculo', type: 'hidden', value: '' },
      { checked: false, name: 'c', type: 'checkbox', value: '3' },
      { checked: true, name: 'r', type: 'radio', value: 'S' },
      { name: 'l', selected: ['2'], type: 'select-one', value: '2' },
      { name: '', type: 'text', value: 'sem nome' },
      { name: 'b', type: 'submit', value: 'ok' },
    ];
    const pairs = withCheckRules('GN_ATIV_VINC', controls, successfulPairs(controls));
    expect(pairs).toEqual([
      ['a', '1'],
      ['f_vinculo', 'Celetista'],
      ['r', 'S'],
      ['l', '2'],
    ]);
    expect(withCheckRules('RES', controls, [['f_vinculo', '']])).toEqual([['f_vinculo', '']]);
  });

  it('troca, tira e acrescenta campos', () => {
    const out = setPairs(
      [
        ['a', '1'],
        ['b', '2'],
        ['b', '3'],
      ],
      { a: null, b: 'x', c: 'novo', d: null },
    );
    expect(out).toEqual([
      ['b', 'x'],
      ['c', 'novo'],
    ]);
    expect(pairValue(out, 'a')).toBeNull();
  });

  it('codifica em Latin-1, com CRLF e referência numérica fora do Latin-1', () => {
    expect(encodeLatin1Form([['f_x', 'Ação é 100% ok\nfim — já']])).toBe(
      'f_x=A%E7%E3o+%E9+100%25+ok%0D%0Afim+%26%238212%3B+j%E1',
    );
  });
});

describe('ponte: HTML do Lattes', () => {
  it('acha links com parâmetros em onclick, href e &amp;', () => {
    const links = findLinks(
      `x("PKG_ATIV.cargos_vinculos?f_cod=K1&amp;F_SEQ_ATIV=5&quot;, true)
       <a href="pkg_ativ.cargos_vinculos?f_cod=K1&f_seq_ativ=6">`,
      'pkg_ativ.cargos_vinculos',
    );
    expect(links.map((l) => l.params.f_seq_ativ)).toEqual(['5', '6']);
    expect(links[0]!.path).toBe('PKG_ATIV.cargos_vinculos?f_cod=K1&F_SEQ_ATIV=5');
  });

  it('reconhece a tela de login e o código do currículo', () => {
    expect(isLogonPage('<form action="pkg_sec.logon" method="post">')).toBe(true);
    expect(isLogonPage('<p>ok</p>', 'https://wwws.cnpq.br/cvlattesweb/pkg_sec.logon')).toBe(true);
    expect(isLogonPage('<a href="x">pkg_sec.logon</a>')).toBe(false);
    expect(cvCodeFrom('PKG_MENU.menu?f_cod=FE387C4DFE584C19BD79D189C7A9DF99')).toBeUndefined();
    expect(cvCodeFrom('pkg_ativ.lista?f_cod=K4746321J8&quot;')).toBe('K4746321J8');
  });
});

describe('ponte: protocolo', () => {
  it('só aceita mensagens da versão e da origem certas', () => {
    expect(isEditorMessage(editorMessage({ type: 'ola' }))).toBe(true);
    expect(isBridgeMessage(bridgeMessage({ type: 'fim' }))).toBe(true);
    expect(isBridgeMessage(editorMessage({ type: 'ola' }))).toBe(false);
    expect(isEditorMessage({ source: 'lattes-editor', type: 'ola', v: 99 })).toBe(false);
    expect(isEditorMessage(null)).toBe(false);
    const win = {};
    expect(
      fromSamePage(
        { origin: 'http://localhost:5190', source: win },
        { origin: 'http://localhost:5190', window: win },
      ),
    ).toBe(true);
    expect(
      fromSamePage(
        { origin: 'http://evil', source: win },
        { origin: 'http://localhost:5190', window: win },
      ),
    ).toBe(false);
    expect(
      fromSamePage(
        { origin: 'http://localhost:5190', source: {} },
        { origin: 'http://localhost:5190', window: win },
      ),
    ).toBe(false);
  });
});

describe('ponte: plano', () => {
  it('mapeia campos do vínculo, situação e conferência do início', () => {
    const op = vinculoOp((v) => {
      setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'More');
      setAttr(v, 'ANO-FIM', '');
      setAttr(v, 'MES-FIM', '');
      setAttr(v, 'FLAG-DEDICACAO-EXCLUSIVA', 'SIM');
      setAttr(v, 'FLAG-VINCULO-EMPREGATICIO', 'NAO');
    });
    expect(op).toMatchObject({ codInst: 'D001', kind: 'vinculo', seqAtiv: '5', seqHist: '1' });
    expect(op.set).toEqual({
      f_ano_fim: '',
      f_mes_fim: '',
      f_outras_inf_en: 'More',
      f_regime: '3',
      f_stavinc: '0',
      f_status: 'S',
    });
    expect(op.expect).toMatchObject({
      f_ano_ini: '2011',
      f_mes_ini: '01',
      f_regime: null,
      f_status: 'N',
    });
  });

  it('mapeia o resumo', () => {
    const { changes, working } = changesAfter((root) =>
      setAttr(find(root, 'RESUMO-CV'), 'TEXTO-RESUMO-CV-RH-EN', 'New'),
    );
    const { ops } = planChanges(
      changes.map((change) => ({ change, itemTitle: '' })),
      working,
    );
    expect(ops[0]).toMatchObject({ kind: 'resumo', label: 'Resumo', set: { F_TEXTO_EN: 'New' } });
  });

  it('deixa de fora o que não foi observado no Lattes', () => {
    const reasons = (edit: (root: XElement) => void) => {
      const { changes, working } = changesAfter(edit);
      return planChanges(
        changes.map((change) => ({ change, itemTitle: '' })),
        working,
      ).unsupported.map((u) => u.reason);
    };
    expect(reasons((r) => setAttr(find(r, 'VINCULOS'), 'TIPO-DE-VINCULO', 'OUTRO'))[0]).toMatch(
      /Campos não suportados/,
    );
    expect(
      reasons((r) => setAttr(find(r, 'ATUACAO-PROFISSIONAL'), 'NOME-INSTITUICAO', 'Y'))[0],
    ).toMatch(/Formulário não suportado/);
    expect(reasons((r) => setAttr(find(r, 'RESUMO-CV'), 'OUTRO', 'x'))[0]).toMatch(
      /Campos não suportados/,
    );
    expect(
      reasons((r) => {
        const v = find(r, 'VINCULOS');
        setAttr(v, 'SEQUENCIA-HISTORICO', '');
        setAttr(v, 'ANO-INICIO', '2010');
      }).join(),
    ).toMatch(/Incluir ou excluir|sequência/);
  });

  it('recusa mudança que não é alteração ou cujo item sumiu', () => {
    const { changes, working } = changesAfter((r) =>
      setAttr(find(r, 'RESUMO-CV'), 'TEXTO-RESUMO-CV-RH', 'x'),
    );
    const change = changes[0]!;
    expect(planChange({ ...change, kind: 'novo' }, [], 'L')).toMatchObject({ reason: /Incluir/ });
    expect(planChange(change, [], 'L')).toMatchObject({ reason: /não existe mais/ });
    expect(planChange(change, resolvePath(working, change.path), 'L')).toMatchObject({
      kind: 'resumo',
    });
  });
});

describe('ponte: aplicar no Lattes (falso)', () => {
  it('grava, relê e confere só os campos da operação', async () => {
    const fake = fakeLattes();
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'teste — ponte'));
    const r = await applyOp(op, fake.port);
    expect(r).toMatchObject({ key: op.key, status: 'conferido' });
    expect(fake.vinculo.f_outras_inf_en).toBe('teste — ponte');
    expect(fake.posts[0]!.path).toBe('PKG_ATIV.VINCULOS');
    expect(fake.posts[0]!.body).toContain('f_vinculo=Celetista');
    expect(fake.posts[0]!.body).not.toContain('salvar');
  });

  it('marca e desmarca caixa e muda a situação junto com o fim', async () => {
    const fake = fakeLattes();
    const op = vinculoOp((v) => {
      setAttr(v, 'FLAG-DEDICACAO-EXCLUSIVA', 'SIM');
      setAttr(v, 'ANO-FIM', '');
      setAttr(v, 'MES-FIM', '');
    });
    expect(await applyOp(op, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.vinculo).toMatchObject({ f_ano_fim: '', f_regime: '3', f_status: 'S' });
  });

  it('não envia nada quando o Lattes não está como o editor espera', async () => {
    const fake = fakeLattes();
    fake.vinculo.f_ano_ini = '2009';
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    expect(await applyOp(op, fake.port)).toMatchObject({
      detail: /f_ano_ini/,
      status: 'divergente',
    });
    expect(fake.posts).toHaveLength(0);
  });

  it('recusa valor acima do limite do campo', async () => {
    const fake = fakeLattes();
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'a'.repeat(2001)));
    expect(await applyOp(op, fake.port)).toMatchObject({ detail: /limite/, status: 'erro' });
    expect(fake.posts).toHaveLength(0);
  });

  it('acusa campo não gravado e efeito colateral', async () => {
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    const dropped = fakeLattes({ dropField: 'f_outras_inf_en' });
    expect(await applyOp(op, dropped.port)).toMatchObject({ detail: /não gravou/, status: 'erro' });
    const side = fakeLattes({ sideEffect: ['f_carga', '20'] });
    expect(await applyOp(op, side.port)).toMatchObject({ detail: /f_carga/, status: 'erro' });
  });

  it('para quando a sessão cai, em qualquer passo', async () => {
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    for (const step of [1, 2, 3, 4]) {
      const fake = fakeLattes({ logonAtGet: step });
      expect(await applyOp(op, fake.port)).toMatchObject({ status: 'sessao' });
    }
  });

  it('acusa atuação, vínculo ou resumo que não acha', async () => {
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    const fake = fakeLattes();
    expect(await applyOp({ ...op, seqAtiv: '9' } as BridgeOp, fake.port)).toMatchObject({
      detail: /Atuação 9/,
      status: 'erro',
    });
    expect(await applyOp({ ...op, seqHist: '7' } as BridgeOp, fake.port)).toMatchObject({
      detail: /Vínculo 7/,
      status: 'erro',
    });
    const empty = { ...fake.port, menuHtml: () => '' };
    expect(await applyOp(op, empty)).toMatchObject({ detail: /menu/, status: 'erro' });
    const resumo: BridgeOp = {
      expect: {},
      key: 'r',
      kind: 'resumo',
      label: 'R',
      set: { F_TEXTO: 'n' },
    };
    expect(await applyOp(resumo, empty)).toMatchObject({ detail: /Resumo/, status: 'erro' });
  });

  it('acusa formulário ausente, fora do modo de alteração e falha da rede', async () => {
    const resumo: BridgeOp = {
      expect: { F_TEXTO: 'Resumo' },
      key: 'r',
      kind: 'resumo',
      label: 'R',
      set: { F_TEXTO: 'Novo' },
    };
    const fake = fakeLattes();
    expect(await applyOp(resumo, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.resumo.F_TEXTO).toBe('Novo');

    const noForm = { ...fake.port, readForm: () => undefined };
    expect(await applyOp(resumo, noForm)).toMatchObject({
      detail: /RES não encontrado/,
      status: 'erro',
    });

    const other = fakeLattes();
    other.resumo.f_ctr = 'I';
    expect(await applyOp({ ...resumo, expect: {} }, other.port)).toMatchObject({
      detail: /alteração/,
      status: 'erro',
    });

    const failing = { ...fake.port, get: () => Promise.reject(new Error('rede')) };
    expect(await applyOp(resumo, failing)).toMatchObject({ detail: 'rede', status: 'erro' });
    const weird = { ...fake.port, get: () => Promise.reject('?') };
    expect(await applyOp(resumo, weird)).toMatchObject({
      detail: 'Falha inesperada',
      status: 'erro',
    });

    const logonPost = {
      ...fakeLattes().port,
      post: () => Promise.resolve('<form action="pkg_sec.logon">'),
    };
    expect(await applyOp({ ...resumo, set: { F_TEXTO: 'x' } }, logonPost)).toMatchObject({
      status: 'sessao',
    });
  });

  it('aplica em ordem, para no primeiro problema e quando pedem', async () => {
    const ok = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    const bad = { ...ok, key: 'b', seqHist: '7' } as BridgeOp;
    const seen: string[] = [];
    const results = await applyAll([bad, ok], fakeLattes().port, {
      onResult: (r) => seen.push(r.status),
    });
    expect(seen).toEqual(['erro']);
    expect(results).toHaveLength(1);
    expect(await applyAll([ok], fakeLattes().port, { shouldStop: () => true })).toEqual([]);
    expect(await applyAll([ok], fakeLattes().port)).toMatchObject([{ status: 'conferido' }]);
  });
});

describe('instituição no link do Lattes', () => {
  it('aceita a letra que o Lattes põe na frente do código do XML', () => {
    expect(sameInstitution('D001000000998', '001000000998')).toBe(true);
    expect(sameInstitution('001000000998', '001000000998')).toBe(true);
    expect(sameInstitution('D001000000999', '001000000998')).toBe(false);
    expect(sameInstitution(undefined, '001')).toBe(false);
    expect(sameInstitution('D001', undefined)).toBe(true);
  });
});
