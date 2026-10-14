import { describe, expect, it } from 'vitest';

import { applyOp, type LattesPort } from '../src/bridge/apply.ts';
import {
  blocksKind,
  checkContract,
  type Contract,
  lacksSample,
  LATTES_CONTRACT,
} from '../src/bridge/contract.ts';
import {
  countryName,
  EDIT_ITEMS_ENABLED,
  editContract,
  EVENTO_SPEC,
  type EventoOp,
  planEvento,
} from '../src/bridge/edit-items.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { withCheckRules } from '../src/bridge/form.ts';
import { type BridgeOp, planChanges, type Unsupported } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { splitByRoute } from '../src/import-export/send-routes.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { readHtmlForm } from './helpers/html-form.ts';

// ---------------------------------------------------------------- currículo

const ouvinte = (seq: string, item: string, sub: string, extra = '') =>
  `<${item} SEQUENCIA-PRODUCAO="${seq}">
    <DADOS-BASICOS-${sub} NATUREZA="Congresso" TITULO="" ANO="2019" PAIS="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="NAO_INFORMADO" HOME-PAGE-DO-TRABALHO="" FLAG-RELEVANCIA="NAO" TIPO-PARTICIPACAO="" FORMA-PARTICIPACAO="Ouvinte" DOI="" TITULO-INGLES="" FLAG-DIVULGACAO-CIENTIFICA="NAO" ${extra}/>
    <DETALHAMENTO-${sub} NOME-DO-EVENTO="Congresso Brasileiro de Exemplo" CODIGO-INSTITUICAO="" NOME-INSTITUICAO="" LOCAL-DO-EVENTO="" CIDADE-DO-EVENTO="Porto Alegre" NOME-DO-EVENTO-INGLES=""/>
    <PALAVRAS-CHAVE PALAVRA-CHAVE-1="exemplo"/>
  </${item}>`;

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS>
${ouvinte('12', 'PARTICIPACAO-EM-CONGRESSO', 'DA-PARTICIPACAO-EM-CONGRESSO')}
<PARTICIPACAO-EM-SEMINARIO SEQUENCIA-PRODUCAO="13">
  <DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO NATUREZA="Seminário" TITULO="Palestra" ANO="2020" PAIS="Brasil" TIPO-PARTICIPACAO="Conferencista" FORMA-PARTICIPACAO="Convidado" FLAG-DIVULGACAO-CIENTIFICA="NAO"/>
  <DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO NOME-DO-EVENTO="Seminário de Exemplo"/>
</PARTICIPACAO-EM-SEMINARIO>
${ouvinte('14', 'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS', 'DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS')}
<PARTICIPACAO-EM-ENCONTRO>
  <DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO ANO="2021" FORMA-PARTICIPACAO="Ouvinte"/>
</PARTICIPACAO-EM-ENCONTRO>
</PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES></CURRICULO-VITAE>`;

function find(root: XElement, name: string, seq?: string): XElement {
  const stack = [root];
  while (stack.length) {
    const el = stack.pop()!;
    if (el.name === name && (!seq || getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)) return el;
    for (const c of el.children) if (c.kind === 'element') stack.push(c);
  }
  throw new Error(name);
}

const child = (item: XElement, prefix: string) =>
  item.children.find((c): c is XElement => c.kind === 'element' && c.name.startsWith(prefix))!;

/** As mudanças depois de editar a cópia, e o plano com a chave ligada (ou não). */
function planAfter(edit: (root: XElement) => void, editItems = true) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const changes = diffDocuments(original, working);
  return {
    changes,
    plan: planChanges(
      changes.map((change) => ({ change, itemTitle: 'Congresso Brasileiro de Exemplo' })),
      working,
      { editItems },
    ),
    working,
  };
}

const congress = (root: XElement) => find(root, 'PARTICIPACAO-EM-CONGRESSO', '12');
const basics = (root: XElement) => child(congress(root), 'DADOS-BASICOS');
const detail = (root: XElement) => child(congress(root), 'DETALHAMENTO');

function onlyOp(edit: (root: XElement) => void): EventoOp {
  const { plan } = planAfter(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0] as EventoOp;
}

function onlyReason(edit: (root: XElement) => void): string {
  const { plan } = planAfter(edit);
  expect(plan.ops).toEqual([]);
  return plan.unsupported.map((u) => u.reason).join(' | ');
}

// ---------------------------------------------------------------- Lattes falso

/** Estado de um evento no Lattes falso: valor de cada campo do GN_TEC. */
type EventState = Record<string, string>;

const COD = 'K000000000';

const event = (seq: string, over: Partial<EventState> = {}): EventState => ({
  f_ano: '2019',
  f_cidade: 'Porto Alegre',
  f_classif: 'N',
  f_cod: COD,
  F_COD_PROD: 'A31',
  f_ctr: 'U',
  F_FORMA: '40',
  f_homepage: '',
  f_nme_evento: 'Congresso Brasileiro de Exemplo',
  f_pais: 'BRA',
  f_seq: seq,
  F_STA_DIVULGACAO_CIENTIFICA: 'N',
  f_tipo_privacidade: '1',
  f_titulo: '',
  f_titulo_en: '',
  ...over,
});

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const radios = (name: string, state: EventState, options: [string, string][]) =>
  options
    .map(
      ([value, label]) =>
        `<input type="radio" name="${name}" value="${value}"${state[name] === value ? ' checked' : ''}> ${label}`,
    )
    .join('\n');

const select = (name: string, state: EventState, options: [string, string][]) =>
  `<select name="${name}">${options
    .map(
      ([value, label]) =>
        `<option value="${value}"${state[name] === value ? ' selected' : ''}>${label}</option>`,
    )
    .join('')}</select>`;

const text = (name: string, state: EventState, max: number) =>
  `<input type="text" name="${name}" maxlength="${max}" value="${esc(state[name] ?? '')}">`;

/** A página do formulário de eventos como a seção 16 de lattes_internals.md descreve. */
function eventPage(state: EventState, opts: { titleMax?: number } = {}): string {
  return `<html><head><script>function montaTipoApres(){} function check(){}</script></head><body>
<form name="GN_TEC" method="post" action="PKG_EVENTO.FORM">
${radios('F_FORMA', state, [
  ['38', 'Convidado'],
  ['39', 'Participante'],
  ['40', 'Ouvinte'],
])}
<select name="F_TPO"></select>
${text('f_nme_evento', state, 400)}
${text('f_ano', state, 4)}
${radios('f_classif', state, [
  ['I', 'Internacional'],
  ['N', 'Nacional'],
  ['R', 'Regional'],
  ['L', 'Local'],
])}
${select('F_COD_PROD', state, [
  ['', 'Selecione'],
  ['A31', 'Congresso'],
  ['A32', 'Seminário'],
  ['A35', 'Encontro'],
  ['A39', 'Outra'],
])}
${text('f_cidade', state, 255)}
${select('f_pais', state, [
  ['BRA', 'Brasil'],
  ['EUA', 'Estados Unidos'],
  ['RFA', 'Alemanha'],
])}
${text('f_homepage', state, 250)}
${text('f_titulo', state, opts.titleMax ?? 255)}
${radios('F_STA_DIVULGACAO_CIENTIFICA', state, [
  ['S', 'sim'],
  ['N', 'não'],
])}
${text('f_titulo_en', state, 400)}
${select('f_tipo_privacidade', state, [
  ['1', 'Público'],
  ['2', 'Privado'],
])}
<input type="hidden" name="f_ctr" value="${state.f_ctr}">
<input type="hidden" name="f_cod" value="${state.f_cod}">
<input type="hidden" name="f_seq" value="${state.f_seq}">
<input type="button" name="salvar" value="Salvar" onclick="check()">
</form></body></html>`;
}

const row = (seq: string) =>
  `<tr onclick="self.parent.modalCV2.setarUrl('PKG_EVENTO.form?f_cod=${COD}&F_STA_DIVULGACAO_CIENTIFICA=&f_seq=${seq}',true)"><td>Evento ${seq}</td></tr>`;
const NEW_ROW = `<a onclick="self.parent.modalCV2.setarUrl('PKG_EVENTO.form?f_cod=${COD}&F_STA_DIVULGACAO_CIENTIFICA=',true)">Incluir novo item</a>`;

const MENU = `<a onclick="modalCV1.setarUrl(&quot;pkg_evento.LISTA?f_sta_divulgacao_cientifica=S&amp;f_cod=${COD}&quot;, true)">Divulgação científica</a>
<a onclick="modalCV1.setarUrl(&quot;pkg_evento.lista?f_cod=${COD}&quot;, true)">Participação em eventos</a>
<a onclick="modalCV1.setarUrl(&quot;pkg_idioma.lista?f_cod=${COD}&quot;, true)">Idiomas</a>`;

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
  /** Os eventos do Lattes, por f_seq. */
  events?: Record<string, EventState>;
  /** A sessão cai no GET de número n. */
  logonAtGet?: number;
  menu?: string;
  /** O POST também muda outro campo. */
  sideEffect?: [string, string];
  titleMax?: number;
}

function fakeLattes(opts: FakeOptions = {}) {
  const events = opts.events ?? { '12': event('12'), '14': event('14', { F_COD_PROD: 'A39' }) };
  const posts: { body: string; pairs: [string, string][]; path: string }[] = [];
  const gets: string[] = [];
  const port: LattesPort = {
    async get(path) {
      gets.push(path);
      if (opts.logonAtGet === gets.length) {
        return '<SCRIPT>location="pkg_sec.logon?f_cod=ini"</SCRIPT>';
      }
      if (/^pkg_evento\.lista\?/i.test(path)) {
        // A lista filtrada só mostra o que é divulgação científica.
        const filtered = /f_sta_divulgacao_cientifica=S/i.test(path);
        const seqs = Object.keys(events).filter(
          (s) => !filtered || events[s]!.F_STA_DIVULGACAO_CIENTIFICA === 'S',
        );
        return `<table>${seqs.map(row).join('\n')}</table>${NEW_ROW}`;
      }
      if (path.startsWith('PKG_EVENTO.form')) {
        const seq = /f_seq=(\d+)/.exec(path)?.[1];
        const state = seq ? events[seq] : undefined;
        return state ? eventPage(state, opts) : '<p>Erro</p>';
      }
      return '';
    },
    menuHtml: () => opts.menu ?? MENU,
    async post(path, body) {
      const pairs = decodeForm(body);
      posts.push({ body, pairs, path });
      const seq = pairs.find(([k]) => k === 'f_seq')?.[1] ?? '';
      const state = events[seq]!;
      for (const [k, v] of pairs) {
        if (k in state && k !== opts.dropField) state[k] = v;
      }
      if (opts.sideEffect) state[opts.sideEffect[0]] = opts.sideEffect[1];
      return `<script>self.parent.modalCV1.setarUrl('pkg_evento.lista?f_cod=${COD}',true)</script>`;
    },
    readForm: readHtmlForm,
  };
  return { events, gets, port, posts };
}

// ---------------------------------------------------------------- testes

describe('alteração de evento: chave', () => {
  it('fica desligada por padrão: o evento segue à mão e o contrato não confere o formulário', () => {
    expect(EDIT_ITEMS_ENABLED).toBe(false);
    expect(LATTES_CONTRACT.forms.evento).toBeUndefined();
    expect(LATTES_CONTRACT.menu).not.toContain('pkg_evento.lista');
    const edit = (root: XElement) => setAttr(basics(root), 'TITULO', 'Novo título');
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    edit(working);
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    const off = planChanges(entries, working);
    expect(off.ops).toEqual([]);
    expect(off.unsupported[0]!.reason).toBe('Formulário não suportado ainda');
    expect(planAfter(edit, false).plan.ops).toEqual([]);
    expect(planAfter(edit).plan.ops.map((o) => o.kind)).toEqual(['evento']);
  });

  it('com a chave ligada, a alteração vai pelo conector no painel Enviar ao Lattes', () => {
    const edit = (root: XElement) => {
      setAttr(basics(root), 'TITULO', 'Novo título');
      setAttr(detail(root), 'CIDADE-DO-EVENTO', 'Canoas');
    };
    const { changes, plan } = planAfter(edit);
    const groups = [
      {
        entries: changes.map((change) => ({ change, itemTitle: 'Congresso' })),
        importable: false,
        label: 'Participação em eventos',
      },
    ];
    const routed = splitByRoute(groups, new Set(plan.ops.map((o) => o.key)));
    expect(routed.conector[0]!.entries.map((e) => e.change.element)).toEqual([
      'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO',
    ]);
    expect(routed.mao[0]!.entries.map((e) => e.change.element)).toEqual([
      'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO',
    ]);
    const off = planAfter(edit, false).plan;
    expect(splitByRoute(groups, new Set(off.ops.map((o) => o.key))).conector).toEqual([]);
  });

  it('acrescenta o formulário e a lista ao contrato só quando ligada', () => {
    expect(editContract(false)).toEqual({ forms: {}, menu: [] });
    expect(editContract(true)).toEqual({
      forms: { evento: EVENTO_SPEC },
      menu: ['pkg_evento.lista'],
    });
  });
});

describe('alteração de evento: plano', () => {
  it('leva os dados básicos para os campos do formulário, com o antes e a identidade', () => {
    const op = onlyOp((root) => {
      const b = basics(root);
      setAttr(b, 'TITULO', 'Título … novo');
      setAttr(b, 'PAIS', 'Alemanha');
      setAttr(b, 'FLAG-DIVULGACAO-CIENTIFICA', 'SIM');
      setAttr(b, 'HOME-PAGE-DO-TRABALHO', 'https://exemplo.org');
      setAttr(b, 'TITULO-INGLES', 'New title');
    });
    expect(op).toMatchObject({ kind: 'evento', seq: '12' });
    expect(op.set).toEqual({
      f_homepage: 'https://exemplo.org',
      f_pais: 'RFA',
      F_STA_DIVULGACAO_CIENTIFICA: 'S',
      f_titulo: 'Título … novo',
      f_titulo_en: 'New title',
    });
    expect(op.expect).toEqual({
      f_ano: '2019',
      F_COD_PROD: 'A31',
      F_FORMA: '40',
      f_homepage: '',
      f_pais: 'BRA',
      F_STA_DIVULGACAO_CIENTIFICA: 'N',
      f_titulo: '',
      f_titulo_en: '',
    });
  });

  it('o ano alterado vira o antes, e o nome do evento vem do detalhamento', () => {
    const ano = onlyOp((root) => setAttr(basics(root), 'ANO', '2018'));
    expect(ano.set).toEqual({ f_ano: '2018' });
    expect(ano.expect).toMatchObject({ f_ano: '2019' });
    const nome = onlyOp((root) => setAttr(detail(root), 'NOME-DO-EVENTO', 'Congresso Novo'));
    expect(nome.set).toEqual({ f_nme_evento: 'Congresso Novo' });
    expect(nome.expect).toEqual({
      F_COD_PROD: 'A31',
      F_FORMA: '40',
      f_nme_evento: 'Congresso Brasileiro de Exemplo',
    });
    const nome2 = onlyOp((root) => {
      const outro = find(root, 'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS', '14');
      setAttr(child(outro, 'DETALHAMENTO'), 'NOME-DO-EVENTO', 'Outro');
    });
    expect(nome2).toMatchObject({ expect: { F_COD_PROD: 'A39' }, seq: '14' });
  });

  it('o rádio da divulgação sem valor no XML conta como desmarcado', () => {
    const xml = XML.replace(
      'FLAG-DIVULGACAO-CIENTIFICA="NAO" />',
      'FLAG-DIVULGACAO-CIENTIFICA="" />',
    );
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    setAttr(basics(working), 'FLAG-DIVULGACAO-CIENTIFICA', 'SIM');
    const [change] = diffDocuments(original, working);
    const planned = planEvento(change!, resolvePath(working, change!.path), 'x') as EventoOp;
    expect(planned.set).toEqual({ F_STA_DIVULGACAO_CIENTIFICA: 'S' });
    expect(planned.expect.F_STA_DIVULGACAO_CIENTIFICA).toBeNull();
  });

  it('deixa à mão o que o formulário não tem ou o que não foi conferido', () => {
    expect(onlyReason((root) => setAttr(basics(root), 'IDIOMA', 'Inglês'))).toBe(
      'O formulário de eventos do Lattes não tem: Idioma',
    );
    expect(onlyReason((root) => setAttr(detail(root), 'CIDADE-DO-EVENTO', 'Canoas'))).toMatch(
      /^Campos não suportados ainda: /,
    );
    expect(onlyReason((root) => setAttr(basics(root), 'NATUREZA', 'Outra'))).toMatch(
      /^Campos não suportados ainda: /,
    );
    expect(onlyReason((root) => setAttr(basics(root), 'PAIS', 'Atlântida'))).toMatch(
      /^Campos não suportados ainda: /,
    );
    expect(onlyReason((root) => setAttr(basics(root), 'FLAG-DIVULGACAO-CIENTIFICA', ''))).toMatch(
      /^Campos não suportados ainda: /,
    );
    expect(
      onlyReason((root) =>
        setAttr(child(congress(root), 'PALAVRAS-CHAVE'), 'PALAVRA-CHAVE-1', 'outra'),
      ),
    ).toMatch(/não tem palavras-chave/);
    expect(onlyReason((root) => setAttr(basics(root), 'ANO', ''))).toMatch(/não aceita .* vazio/);
    expect(onlyReason((root) => setAttr(detail(root), 'NOME-DO-EVENTO', ' '))).toMatch(
      /não aceita .* vazio/,
    );
  });

  it('só ouvinte: convidado, participante ou forma alterada ficam à mão', () => {
    const seminario = (root: XElement) =>
      child(find(root, 'PARTICIPACAO-EM-SEMINARIO', '13'), 'DADOS-BASICOS');
    expect(onlyReason((root) => setAttr(seminario(root), 'TITULO', 'Outra palestra'))).toMatch(
      /só a participação como ouvinte; a edição como Convidado/,
    );
    expect(onlyReason((root) => setAttr(basics(root), 'FORMA-PARTICIPACAO', ''))).toMatch(
      /forma não informada/,
    );
    // Forma trocada para ouvinte no editor: a mudança da forma não vai pelo conector.
    expect(onlyReason((root) => setAttr(seminario(root), 'FORMA-PARTICIPACAO', 'Ouvinte'))).toMatch(
      /^Campos não suportados ainda: /,
    );
    expect(
      onlyReason((root) =>
        setAttr(child(find(root, 'PARTICIPACAO-EM-ENCONTRO'), 'DADOS-BASICOS'), 'ANO', '2022'),
      ),
    ).toBe('Evento sem número de sequência');
  });

  it('não reconhece o que não é evento', () => {
    const root = parseXml(XML).root;
    const change = {
      element: 'RESUMO-CV',
      fields: [],
      form: 'Resumo',
      key: 'x',
      kind: 'alterado' as const,
      path: [],
    };
    expect(planEvento(change, [root], 'x')).toBeUndefined();
    expect(planEvento(change, [], 'x')).toBeUndefined();
  });
});

const opFor = (edit: (root: XElement) => void): EventoOp => onlyOp(edit);

describe('alteração de evento: aplicar no Lattes (falso)', () => {
  it('acha o evento pela lista, envia só os campos da operação e confere', async () => {
    const fake = fakeLattes();
    const op = opFor((root) => {
      setAttr(basics(root), 'TITULO', 'Apresentação … São Paulo');
      setAttr(basics(root), 'PAIS', 'Estados Unidos');
    });
    const r = await applyOp(op, fake.port);
    expect(r).toEqual({
      detail: 'Gravado e conferido no Lattes',
      key: op.key,
      status: 'conferido',
    });
    expect(fake.events['12']).toMatchObject({
      f_pais: 'EUA',
      f_titulo: 'Apresentação … São Paulo',
    });
    expect(fake.posts).toHaveLength(1);
    const post = fake.posts[0]!;
    expect(post.path).toBe('PKG_EVENTO.FORM');
    // Latin-1: "ã" vai como %E3; as reticências, fora do Latin-1, como referência numérica.
    expect(post.body).toContain('f_titulo=Apresenta%E7%E3o+%26%238230%3B+S%E3o+Paulo');
    expect(post.pairs).toContainEqual(['F_TPO', '']);
    expect(post.pairs).toContainEqual(['f_ctr', 'U']);
    expect(post.pairs).toContainEqual(['f_seq', '12']);
    expect(post.pairs).toContainEqual(['f_classif', 'N']);
    expect(post.pairs.map(([k]) => k)).not.toContain('salvar');
    // A lista inteira é lida antes da filtrada por divulgação científica.
    expect(fake.gets[0]).toBe(`pkg_evento.lista?f_cod=${COD}`);
  });

  it('procura na lista filtrada quando a inteira não tem o evento', async () => {
    const fake = fakeLattes({
      menu: `<a onclick="modalCV1.setarUrl(&quot;pkg_evento.lista?f_cod=${COD}&quot;, true)">x</a>
             <a onclick="modalCV1.setarUrl(&quot;pkg_evento.LISTA?f_sta_divulgacao_cientifica=S&amp;f_cod=${COD}&quot;, true)">y</a>`,
    });
    // A lista inteira falsa mostra tudo; aqui o evento 12 só aparece na filtrada.
    const get = fake.port.get.bind(fake.port);
    fake.port.get = async (path) => {
      if (!/^pkg_evento\.lista\?f_cod/.test(path)) return get(path);
      fake.gets.push(path);
      return `<table>${row('14')}</table>`;
    };
    fake.events['12']!.F_STA_DIVULGACAO_CIENTIFICA = 'S';
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'T'));
    expect((await applyOp(op, fake.port)).status).toBe('conferido');
    expect(fake.gets.slice(0, 2)).toEqual([
      `pkg_evento.lista?f_cod=${COD}`,
      `pkg_evento.LISTA?f_sta_divulgacao_cientifica=S&f_cod=${COD}`,
    ]);
  });

  it('não envia nada quando a linha do Lattes não é a que o editor pensa', async () => {
    const cases: Partial<EventState>[] = [
      { F_FORMA: '39' },
      { F_COD_PROD: 'A32' },
      { f_ano: '2017' },
      { f_titulo: 'Já mudou no Lattes' },
    ];
    for (const over of cases) {
      const fake = fakeLattes({ events: { '12': event('12', over) } });
      const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
      const r = await applyOp(op, fake.port);
      expect(r.status).toBe('divergente');
      expect(r.detail).toMatch(/^O Lattes não está como o editor espera: /);
      expect(fake.posts).toEqual([]);
    }
  });

  it('acusa evento, lista ou formulário que não acha, sem enviar', async () => {
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
    const semEvento = fakeLattes({ events: { '14': event('14') } });
    expect(await applyOp(op, semEvento.port)).toMatchObject({
      detail: 'Evento 12 não encontrado no Lattes',
      status: 'erro',
    });
    const semLista = fakeLattes({ menu: '<a href="pkg_idioma.lista?f_cod=K000000000">x</a>' });
    expect(await applyOp(op, semLista.port)).toMatchObject({
      detail: 'Participação em eventos não encontrada no menu do Lattes',
      status: 'erro',
    });
    const semForm = fakeLattes();
    semForm.port.readForm = () => undefined;
    expect(await applyOp(op, semForm.port)).toMatchObject({
      detail: 'Formulário GN_TEC não encontrado',
      status: 'erro',
    });
    const inclusao = fakeLattes({ events: { '12': event('12', { f_ctr: 'I' }) } });
    expect((await applyOp(op, inclusao.port)).detail).toBe(
      'O formulário não está em modo de alteração',
    );
    for (const fake of [semEvento, semLista, semForm, inclusao]) expect(fake.posts).toEqual([]);
  });

  it('recusa valor acima do limite do campo', async () => {
    const fake = fakeLattes({ titleMax: 10 });
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Um título comprido demais'));
    expect(await applyOp(op, fake.port)).toMatchObject({
      detail: 'f_titulo passa do limite do Lattes (10 caracteres)',
      status: 'erro',
    });
    expect(fake.posts).toEqual([]);
  });

  it('acusa campo não gravado e outro campo que mudou junto', async () => {
    const op = () => opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
    const naoGravou = fakeLattes({ dropField: 'f_titulo' });
    expect(await applyOp(op(), naoGravou.port)).toMatchObject({
      detail: 'O Lattes não gravou: f_titulo',
      status: 'erro',
    });
    const colateral = fakeLattes({ sideEffect: ['f_cidade', 'Canoas'] });
    expect(await applyOp(op(), colateral.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: f_cidade',
      status: 'erro',
    });
  });

  it('para quando a sessão cai, antes ou depois de enviar', async () => {
    for (const at of [1, 2, 3]) {
      const fake = fakeLattes({ logonAtGet: at });
      const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
      expect((await applyOp(op, fake.port)).status).toBe('sessao');
    }
  });

  it('desfaz pelo registro do enviado, voltando o antes', async () => {
    const fake = fakeLattes();
    const op = opFor((root) => {
      setAttr(basics(root), 'TITULO', 'Novo');
      setAttr(basics(root), 'PAIS', 'Alemanha');
    });
    expect((await applyOp(op, fake.port)).status).toBe('conferido');
    const entry = { ...sentEntry(op, '1', 1000), id: 7 };
    expect(entry.rows).toEqual([
      { after: 'Novo', before: '(vazio)', label: 'Título', name: 'f_titulo' },
      { after: 'Alemanha', before: 'Brasil', label: 'País', name: 'f_pais' },
    ]);
    const undo = undoOp(entry)!;
    expect(undo).toMatchObject({
      expect: { F_COD_PROD: 'A31', F_FORMA: '40', f_pais: 'RFA', f_titulo: 'Novo' },
      kind: 'evento',
      seq: '12',
      set: { f_pais: 'BRA', f_titulo: '' },
    });
    expect((await applyOp(undo, fake.port)).status).toBe('conferido');
    expect(fake.events['12']).toMatchObject({ f_pais: 'BRA', f_titulo: '' });
  });
});

describe('alteração de evento: contrato', () => {
  const contract: Contract = {
    forms: { ...LATTES_CONTRACT.forms, ...editContract(true).forms },
    menu: [...LATTES_CONTRACT.menu, ...editContract(true).menu],
  };
  const evento = (report: Awaited<ReturnType<typeof checkContract>>) =>
    report.forms.find((f) => f.kind === 'evento')!;

  it('confere o formulário de um evento existente, só lendo', async () => {
    const fake = fakeLattes();
    const report = await checkContract(fake.port, contract);
    expect(evento(report)).toEqual({ drifts: [], form: 'GN_TEC', kind: 'evento', status: 'ok' });
    expect(report.menu).toContainEqual({ found: true, proc: 'pkg_evento.lista' });
    expect(fake.posts).toEqual([]);
  });

  it('aponta campo que mudou e trava a fila de eventos', async () => {
    const report = await checkContract(fakeLattes({ titleMax: 300 }).port, contract);
    expect(evento(report).drifts).toEqual([
      { expected: '255', field: 'f_titulo', form: 'GN_TEC', kind: 'limite-mudou', observed: '300' },
    ]);
    const noTpo = fakeLattes();
    const read = noTpo.port.readForm;
    noTpo.port.readForm = (html, form) => read(html, form)?.filter((c) => c.name !== 'F_TPO');
    const broken = await checkContract(noTpo.port, contract);
    expect(blocksKind(broken, 'evento')).toEqual([
      { field: 'F_TPO', form: 'GN_TEC', kind: 'campo-sumiu' },
    ]);
  });

  it('sem evento cadastrado fica sem amostra; sem a lista, o link sumiu', async () => {
    const vazio = await checkContract(fakeLattes({ events: {} }).port, contract);
    expect(evento(vazio)).toMatchObject({
      detail: 'O currículo não tem participação em eventos',
      status: 'sem-amostra',
    });
    expect(lacksSample(vazio, 'evento')).toBeDefined();
    const semLista = await checkContract(
      fakeLattes({ menu: `<a href="pkg_idioma.lista?f_cod=${COD}">x</a>` }).port,
      contract,
    );
    expect(evento(semLista)).toMatchObject({
      drifts: [{ field: 'pkg_evento.lista', kind: 'link-sumiu' }],
      status: 'nao-encontrado',
    });
  });
});

describe('alteração de evento: rótulos e regras do envio', () => {
  it('mostra país pelo nome e a divulgação como sim ou não', () => {
    const op: BridgeOp = {
      expect: { f_pais: 'BRA', F_STA_DIVULGACAO_CIENTIFICA: null },
      key: 'k',
      kind: 'evento',
      label: 'Evento',
      seq: '1',
      set: { f_pais: 'RFA', F_STA_DIVULGACAO_CIENTIFICA: 'S' },
    };
    expect(opRows(op)).toEqual([
      { after: 'Alemanha', before: 'Brasil', label: 'País', name: 'f_pais' },
      {
        after: 'Sim',
        before: '(vazio)',
        label: 'Divulgação científica',
        name: 'F_STA_DIVULGACAO_CIENTIFICA',
      },
    ]);
    expect(countryName('EUA')).toBe('Estados Unidos');
    expect(countryName('XXX')).toBeUndefined();
  });

  it('manda F_TPO vazio só no evento de ouvinte, quando a lista veio vazia', () => {
    const tpo = { name: 'F_TPO', selected: [], type: 'select-one', value: '' };
    const ouvinte: [string, string][] = [['F_FORMA', '40']];
    expect(withCheckRules('GN_TEC', [tpo], ouvinte)).toEqual([
      ['F_FORMA', '40'],
      ['F_TPO', ''],
    ]);
    expect(withCheckRules('GN_TEC', [tpo], [['F_FORMA', '38']])).toEqual([['F_FORMA', '38']]);
    expect(withCheckRules('GN_TEC', [], ouvinte)).toEqual(ouvinte);
    const already: [string, string][] = [...ouvinte, ['F_TPO', 'x']];
    expect(withCheckRules('GN_TEC', [tpo], already)).toEqual(already);
    expect(withCheckRules('GN_IDIOMA', [tpo], ouvinte)).toEqual(ouvinte);
  });

  it('o plano devolve Unsupported com chave e rótulo', () => {
    const { plan } = planAfter((root) => setAttr(basics(root), 'IDIOMA', 'Inglês'));
    const u: Unsupported = plan.unsupported[0]!;
    expect(u.key).toContain('PARTICIPACAO-EM-CONGRESSO[SEQUENCIA-PRODUCAO=12]');
    expect(u.label).toMatch(/ · Congresso Brasileiro de Exemplo$/);
  });
});
