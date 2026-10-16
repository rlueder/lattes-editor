import { afterEach, describe, expect, it } from 'vitest';

import type { LattesState } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp, sameInstitution } from '../src/bridge/apply.ts';
import { fieldLabel, opRows } from '../src/bridge/field-labels.ts';
import {
  encodeLatin1Form,
  type FormControl,
  identityMismatches,
  pairValue,
  setPairs,
  successfulPairs,
  withCheckRules,
} from '../src/bridge/form.ts';
import {
  cvCodeFrom,
  findLinks,
  isLogonPage,
  lattesIdFrom,
  sameCv,
} from '../src/bridge/lattes-html.ts';
import { type BridgeOp, planChange, planChanges, type VinculoOp } from '../src/bridge/plan.ts';
import {
  bridgeMessage,
  editorMessage,
  fromSamePage,
  isBridgeMessage,
  isEditorMessage,
} from '../src/bridge/protocol.ts';
import { flagFromStavinc, stavincFromFlag } from '../src/bridge/vinculo-flag.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { copyFileName } from '../src/ui/copy-name.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withSmallLattes,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS>
<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo" TEXTO-RESUMO-CV-RH-EN="Summary"/>
<IDIOMAS><IDIOMA IDIOMA="EN" DESCRICAO-DO-IDIOMA="Inglês" PROFICIENCIA-DE-LEITURA="BEM" PROFICIENCIA-DE-FALA="BEM" PROFICIENCIA-DE-ESCRITA="BEM" PROFICIENCIA-DE-COMPREENSAO="BEM"/>
<IDIOMA IDIOMA="ES" DESCRICAO-DO-IDIOMA="Espanhol" PROFICIENCIA-DE-LEITURA="POUCO" PROFICIENCIA-DE-FALA="" PROFICIENCIA-DE-ESCRITA="" PROFICIENCIA-DE-COMPREENSAO=""/></IDIOMAS>
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

// ---------------------------------------------------------------- Lattes simulado

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com um currículo
// pequeno (SMALL_CV): os mesmos idiomas e o mesmo vínculo do XML acima.
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withSmallLattes>[0] = {}) {
  open = await withSmallLattes(options);
  return open;
}

const vinculoIn = (state: LattesState) =>
  findIn(state.root, (el) => el.name === 'VINCULOS' && getAttr(el, 'SEQUENCIA-HISTORICO') === '1')!;
const idiomaIn = (state: LattesState, code: string) =>
  findIn(state.root, (el) => el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === code)!;
const resumoIn = (state: LattesState) => findIn(state.root, (el) => el.name === 'RESUMO-CV')!;

function idiomaOp(code: string, edit: (el: XElement) => void) {
  const { changes, working } = changesAfter((root) => {
    const stack = [root];
    while (stack.length) {
      const el = stack.pop()!;
      if (el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === code) return edit(el);
      for (const c of el.children) if (c.kind === 'element') stack.push(c);
    }
  });
  return planChanges(
    changes.map((change) => ({ change, itemTitle: code })),
    working,
  );
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

describe('conector: formulário', () => {
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

describe('conector: HTML do Lattes', () => {
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
    // Sem cookie de sessão, o menu abre com este alerta (14/10/2026).
    expect(
      isLogonPage(
        '<script>alert("Problemas na autenticação");</script>\nerro ao recuperar rh/cookie',
      ),
    ).toBe(true);
    // Sessão vencida: a página é só um script que redireciona. HTML como veio do
    // Lattes em 14/10/2026, sem sessão válida.
    const stub = [
      '<html><body>',
      '<br><br><BR>',
      '<HTML><HEAD><TITLE></TITLE>',
      '<META HTTP-EQUIV="Pragma" CONTENT="no-cache">',
      '</HEAD>',
      '<BODY>',
      '<SCRIPT>location="pkg_sec.logon?f_cod=ini"</SCRIPT>',
      '</BODY>',
      '</HTML>',
      '</body></html>',
    ].join('\n');
    expect(isLogonPage(stub)).toBe(true);
    expect(isLogonPage("<script>window.location.href = 'pkg_sec.logon'</script>")).toBe(true);
    expect(isLogonPage("<!-- x --><script>location.replace('pkg_sec.logon')</script>")).toBe(true);
    // Página com conteúdo e um script que leva ao login não é sessão caída.
    expect(
      isLogonPage(
        '<h1>Atuação</h1><script>function sair() { location = "pkg_sec.logon?f_cod=ini"; }</script>',
      ),
    ).toBe(false);
    // Título, noscript, &#160; e script truncado não fazem a página virar conteúdo.
    expect(
      isLogonPage(
        '<title>Lattes</title><noscript>Ative o JavaScript</noscript>&#160;<script>location="pkg_sec.logon"',
      ),
    ).toBe(true);
    // Frame ou formulário sem texto, com um script que leva ao login, é conteúdo.
    expect(
      isLogonPage('<iframe src="pkg_menu.menu"></iframe><script>location="pkg_sec.logon"</script>'),
    ).toBe(false);
    // Script que só menciona pkg_sec.logon, sem redirecionar.
    expect(isLogonPage('<script>var proximo = "pkg_sec.logon";</script>')).toBe(false);
    expect(cvCodeFrom('PKG_MENU.menu?f_cod=FE387C4DFE584C19BD79D189C7A9DF99')).toBeUndefined();
    expect(cvCodeFrom('pkg_ativ.lista?f_cod=K1234567A8&quot;')).toBe('K1234567A8');
  });
});

describe('conector: protocolo', () => {
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

describe('conector: plano', () => {
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
      // NAO no XML é Sim (1) no formulário: invertido, observado em 15/10/2026.
      f_stavinc: '1',
      f_status: 'S',
    });
    expect(op.expect).toMatchObject({
      f_ano_ini: '2011',
      f_mes_ini: '01',
      f_regime: null,
      f_stavinc: '0',
      f_status: 'N',
    });
  });

  it('FLAG-VINCULO-EMPREGATICIO vai invertido para f_stavinc (observado em 15/10/2026)', () => {
    // No Lattes, "Possui vínculo empregatício: Sim" (f_stavinc=1) sai como NAO
    // na exportação, e Não (0) sai como SIM; a dedicação exclusiva não inverte.
    expect([stavincFromFlag('SIM'), stavincFromFlag('NAO'), stavincFromFlag('')]).toEqual([
      '0',
      '1',
      '',
    ]);
    expect([flagFromStavinc('0'), flagFromStavinc('1'), flagFromStavinc('')]).toEqual([
      'SIM',
      'NAO',
      '',
    ]);
    const op = vinculoOp((v) => setAttr(v, 'FLAG-VINCULO-EMPREGATICIO', 'NAO'));
    expect(op.expect).toMatchObject({ f_stavinc: '0' });
    expect(op.set).toEqual({ f_stavinc: '1' });
    const regime = vinculoOp((v) => setAttr(v, 'FLAG-DEDICACAO-EXCLUSIVA', 'SIM'));
    expect(regime.set).toEqual({ f_regime: '3' });
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
    expect(planChange({ ...change, kind: 'novo' }, [], 'L')).toMatchObject({
      reason: expect.stringMatching(/Incluir/),
    });
    expect(planChange(change, [], 'L')).toMatchObject({
      reason: expect.stringMatching(/não existe mais/),
    });
    expect(planChange(change, resolvePath(working, change.path), 'L')).toMatchObject({
      kind: 'resumo',
    });
  });
});

describe('conector: aplicar no Lattes simulado', () => {
  it('grava, relê e confere só os campos da operação', async () => {
    const lattes = await lattesFor();
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'teste — conector'));
    const r = await applyOp(op, lattes.port);
    expect(r).toMatchObject({ key: op.key, status: 'conferido' });
    expect(getAttr(vinculoIn(lattes.state), 'OUTRAS-INFORMACOES-INGLES')).toBe('teste — conector');
    const [post] = postsOf(lattes);
    expect(post!.proc).toBe('PKG_ATIV.VINCULOS');
    expect(post!.fields.f_vinculo).toBe('Celetista');
    expect('salvar' in post!.fields).toBe(false);
  });

  it('marca e desmarca caixa e muda a situação junto com o fim', async () => {
    const lattes = await lattesFor();
    const op = vinculoOp((v) => {
      setAttr(v, 'FLAG-DEDICACAO-EXCLUSIVA', 'SIM');
      setAttr(v, 'ANO-FIM', '');
      setAttr(v, 'MES-FIM', '');
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const v = vinculoIn(lattes.state);
    expect(getAttr(v, 'FLAG-DEDICACAO-EXCLUSIVA')).toBe('SIM');
    expect(getAttr(v, 'ANO-FIM')).toBe('');
  });

  it('não envia nada quando o Lattes não está como o editor espera', async () => {
    const lattes = await lattesFor();
    setAttr(vinculoIn(lattes.state), 'ANO-INICIO', '2009');
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Ano de início',
      status: 'divergente',
    });
    expect(postsOf(lattes)).toHaveLength(0);
  });

  it('vínculo de mesmo início com outro fim ou outra carga não recebe a gravação', async () => {
    for (const [attr, value, field] of [
      ['ANO-FIM', '2015', 'Ano de fim'],
      ['MES-FIM', '06', 'Mês de fim'],
      ['CARGA-HORARIA-SEMANAL', '20', 'Carga horária'],
    ]) {
      const lattes = await lattesFor();
      setAttr(vinculoIn(lattes.state), attr!, value!);
      const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
      expect(await applyOp(op, lattes.port)).toMatchObject({
        detail: `O Lattes não está como o editor espera: ${field}`,
        status: 'divergente',
      });
      expect(postsOf(lattes)).toHaveLength(0);
    }
    // Número com outro zero à esquerda é o mesmo número.
    const zeros = await lattesFor();
    setAttr(vinculoIn(zeros.state), 'CARGA-HORARIA-SEMANAL', '040');
    const same = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    expect((await applyOp(same, zeros.port)).status).toBe('conferido');
    // Números longos se comparam dígito a dígito, sem arredondar.
    expect(identityMismatches({ x: ['12345678901234567'] }, () => '12345678901234568')).toEqual([
      'x',
    ]);
    expect(identityMismatches({ x: ['0'] }, () => '000')).toEqual([]);
    // O fim alterado pela própria operação sai da identidade e vai no antes.
    const op = vinculoOp((v) => setAttr(v, 'ANO-FIM', '2013')) as VinculoOp;
    expect(op.identity).not.toHaveProperty('f_ano_fim');
    expect(op.identity).toMatchObject({ f_carga: ['40'], f_mes_fim: ['12'] });
  });

  it('recusa valor acima do limite do campo', async () => {
    const lattes = await lattesFor();
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'a'.repeat(2001)));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: expect.stringMatching(/limite/),
      status: 'erro',
    });
    expect(postsOf(lattes)).toHaveLength(0);
  });

  it('acusa campo não gravado e efeito colateral', async () => {
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    const dropped = await lattesFor({
      intercept: faults.afterPost((_req, state) =>
        setAttr(vinculoIn(state), 'OUTRAS-INFORMACOES-INGLES', ''),
      ),
    });
    expect(await applyOp(op, dropped.port)).toMatchObject({
      detail: expect.stringMatching(/não gravou/),
      status: 'divergente',
    });
    await dropped.close();
    const side = await lattesFor({
      intercept: faults.afterPost((_req, state) =>
        setAttr(vinculoIn(state), 'CARGA-HORARIA-SEMANAL', '20'),
      ),
    });
    expect(await applyOp(op, side.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: Carga horária',
      status: 'divergente',
    });
  });

  it('para quando a sessão cai, em qualquer passo', async () => {
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    for (const step of [1, 2, 3, 4]) {
      const lattes = await lattesFor({ intercept: faults.logonAtGet(step) });
      expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'sessao' });
      await lattes.close();
      open = undefined;
    }
  });

  it('acusa atuação, vínculo ou resumo que não acha', async () => {
    const op = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    const lattes = await lattesFor();
    expect(await applyOp({ ...op, seqAtiv: '9' } as BridgeOp, lattes.port)).toMatchObject({
      detail: expect.stringMatching(/Atuação 9/),
      status: 'erro',
    });
    expect(await applyOp({ ...op, seqHist: '7' } as BridgeOp, lattes.port)).toMatchObject({
      detail: expect.stringMatching(/Vínculo 7/),
      status: 'erro',
    });
    const empty = { ...lattes.port, menuHtml: () => '' };
    expect(await applyOp(op, empty)).toMatchObject({
      detail: expect.stringMatching(/menu/),
      status: 'erro',
    });
    const resumo: BridgeOp = {
      expect: {},
      key: 'r',
      kind: 'resumo',
      label: 'R',
      set: { F_TEXTO: 'n' },
    };
    expect(await applyOp(resumo, empty)).toMatchObject({
      detail: expect.stringMatching(/Resumo/),
      status: 'erro',
    });
  });

  it('acusa formulário ausente, fora do modo de alteração e falha da rede', async () => {
    const resumo: BridgeOp = {
      expect: { F_TEXTO: 'Resumo' },
      key: 'r',
      kind: 'resumo',
      label: 'R',
      set: { F_TEXTO: 'Novo' },
    };
    const lattes = await lattesFor();
    expect(await applyOp(resumo, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(resumoIn(lattes.state), 'TEXTO-RESUMO-CV-RH')).toBe('Novo');

    const noForm = { ...lattes.port, readForm: () => undefined };
    expect(await applyOp(resumo, noForm)).toMatchObject({
      detail: expect.stringMatching(/RES não encontrado/),
      status: 'erro',
    });

    const failing = { ...lattes.port, get: () => Promise.reject(new Error('rede')) };
    expect(await applyOp(resumo, failing)).toMatchObject({ detail: 'rede', status: 'erro' });
    const weird = { ...lattes.port, get: () => Promise.reject('?') };
    expect(await applyOp(resumo, weird)).toMatchObject({
      detail: 'Falha inesperada',
      status: 'erro',
    });

    const logonPost = {
      ...lattes.port,
      post: () => Promise.resolve('<form action="pkg_sec.logon">'),
    };
    expect(
      await applyOp({ ...resumo, expect: {}, set: { F_TEXTO: 'x' } }, logonPost),
    ).toMatchObject({
      status: 'sessao',
    });
    await lattes.close();

    const other = await lattesFor({
      intercept: faults.rewritePages(/^pkg_resume\./i, (html) =>
        html.replace('name="f_ctr" value="U"', 'name="f_ctr" value="I"'),
      ),
    });
    expect(await applyOp({ ...resumo, expect: {} }, other.port)).toMatchObject({
      detail: expect.stringMatching(/alteração/),
      status: 'erro',
    });
  });

  it('aplica em ordem, para no primeiro problema e quando pedem', async () => {
    const ok = vinculoOp((v) => setAttr(v, 'OUTRAS-INFORMACOES-INGLES', 'x'));
    const bad = { ...ok, key: 'b', seqHist: '7' } as BridgeOp;
    const seen: string[] = [];
    const lattes = await lattesFor();
    const results = await applyAll([bad, ok], lattes.port, {
      onResult: (r) => seen.push(r.status),
    });
    expect(seen).toEqual(['erro']);
    expect(results).toHaveLength(1);
    expect(await applyAll([ok], lattes.port, { shouldStop: () => true })).toEqual([]);
    expect(await applyAll([ok], lattes.port)).toMatchObject([{ status: 'conferido' }]);
  });
});

describe('conector: idioma', () => {
  it('mapeia proficiência para caixa e rádio, e NAO_INFORMADO para vazio', () => {
    const { ops } = idiomaOp('EN', (el) => {
      setAttr(el, 'PROFICIENCIA-DE-ESCRITA', 'RAZOAVELMENTE');
      setAttr(el, 'PROFICIENCIA-DE-FALA', 'NAO_INFORMADO');
    });
    expect(ops[0]).toMatchObject({ code: 'EN', kind: 'idioma' });
    expect(ops[0]!.set).toEqual({
      FC_CONVERSA: null,
      FC_ESCREVE: 'on',
      F_CONVERSA: null,
      F_ESCREVE: 'R',
    });
    expect(ops[0]!.expect).toEqual({
      FC_CONVERSA: 'on',
      FC_ESCREVE: 'on',
      F_CONVERSA: 'B',
      F_ESCREVE: 'B',
    });
  });

  it('recusa tirar a última proficiência e campo que não é proficiência', () => {
    const last = idiomaOp('ES', (el) => setAttr(el, 'PROFICIENCIA-DE-LEITURA', ''));
    expect(last.unsupported[0]!.reason).toMatch(/ao menos uma/);
    const other = idiomaOp('ES', (el) => setAttr(el, 'DESCRICAO-DO-IDIOMA', 'Castelhano'));
    expect(other.unsupported[0]!.reason).toMatch(/Campos não suportados/);
    const { changes, working } = changesAfter((root) =>
      setAttr(find(root, 'IDIOMA'), 'PROFICIENCIA-DE-FALA', 'POUCO'),
    );
    const chain = resolvePath(working, changes[0]!.path);
    setAttr(chain.at(-1)!, 'IDIOMA', '');
    expect(planChange(changes[0]!, chain, 'L')).toMatchObject({
      reason: expect.stringMatching(/sem código/),
    });
  });

  it('acha o idioma pelo código, grava e confere', async () => {
    const lattes = await lattesFor();
    const { ops } = idiomaOp('ES', (el) => {
      setAttr(el, 'PROFICIENCIA-DE-LEITURA', 'BEM');
      setAttr(el, 'PROFICIENCIA-DE-FALA', 'POUCO');
    });
    expect(await applyOp(ops[0]!, lattes.port)).toMatchObject({ status: 'conferido' });
    const es = idiomaIn(lattes.state, 'ES');
    expect(getAttr(es, 'PROFICIENCIA-DE-FALA')).toBe('POUCO');
    expect(getAttr(es, 'PROFICIENCIA-DE-LEITURA')).toBe('BEM');
    expect(getAttr(idiomaIn(lattes.state, 'EN'), 'PROFICIENCIA-DE-LEITURA')).toBe('BEM');
    expect(postsOf(lattes)[0]!.proc).toBe('PKG_IDIOMA.FORM');
  });

  it('não envia quando o idioma não está no Lattes ou difere do esperado', async () => {
    const { ops } = idiomaOp('EN', (el) => setAttr(el, 'PROFICIENCIA-DE-ESCRITA', 'POUCO'));
    const op = ops[0]!;
    const lattes = await lattesFor();
    expect(await applyOp({ ...op, code: 'FR' } as BridgeOp, lattes.port)).toMatchObject({
      detail: expect.stringMatching(/Idioma FR não encontrado/),
      status: 'erro',
    });
    setAttr(idiomaIn(lattes.state, 'EN'), 'PROFICIENCIA-DE-ESCRITA', 'RAZOAVELMENTE');
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(lattes)).toHaveLength(0);
    const empty = { ...lattes.port, menuHtml: () => '' };
    expect(await applyOp(op, empty)).toMatchObject({
      detail: expect.stringMatching(/Idiomas/),
      status: 'erro',
    });
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

describe('de quem é o currículo da sessão', () => {
  it('lê o identificador público no menu e só aceita o mesmo currículo', () => {
    expect(lattesIdFrom('<a href="http://lattes.cnpq.br/1234567890123456">CV</a>')).toBe(
      '1234567890123456',
    );
    expect(lattesIdFrom('sem link')).toBeUndefined();
    expect(sameCv('1234567890123456', '1234567890123456')).toBe(true);
    expect(sameCv('1234567890123456', '0000000000000001')).toBe(false);
    expect(sameCv(undefined, '1234567890123456')).toBe(false);
    expect(sameCv('1234567890123456', undefined)).toBe(false);
    // O editor sem lattesId manda '' para a extensão (lattes-tab.ts): recusa.
    expect(sameCv('', '1234567890123456')).toBe(false);
  });
});

describe('cópia de um ponto do histórico', () => {
  it('nomeia o arquivo com a data e a hora do ponto', () => {
    expect(copyFileName('CV_123.xml', new Date(2026, 9, 11, 15, 7))).toBe(
      'CV_123-copia-2026-10-11-1507.xml',
    );
    expect(copyFileName('CV_123.zip', new Date(2026, 0, 2, 3, 4))).toBe(
      'CV_123-copia-2026-01-02-0304.xml',
    );
    expect(fieldLabel('f_outras_inf_en')).toBe('Outras informações (inglês)');
    expect(fieldLabel('f_desconhecido')).toBe('f_desconhecido');
    const rows = opRows({
      expect: { FC_LE: 'on', F_LE: 'B', f_regime: null, f_status: 'N', f_x: '' },
      set: { FC_LE: null, F_LE: null, f_regime: '3', f_status: 'S', f_x: 'y' },
    });
    expect(rows.map((r) => `${r.label}: ${r.before} → ${r.after}`)).toEqual([
      'Leitura: Bem → Não informado',
      'Dedicação exclusiva: Não → Sim',
      'Situação: Anterior → Atual',
      'f_x: (vazio) → y',
    ]);
  });
});
