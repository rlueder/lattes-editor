import { afterEach, describe, expect, it } from 'vitest';

import { applyOp, type LattesPort } from '../src/bridge/apply.ts';
import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import {
  blocksKind,
  checkContract,
  type Contract,
  lacksSample,
  LATTES_CONTRACT,
} from '../src/bridge/contract.ts';
import {
  countryCode,
  countryName,
  EDIT_OUVINTE_ENABLED,
  editContract,
  EVENTO_SPEC,
  type EventoOp,
  planEvento,
} from '../src/bridge/edit-items.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { withCheckRules } from '../src/bridge/form.ts';
import {
  type BridgeOp,
  planChanges,
  planOptionsFor,
  type Unsupported,
} from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { splitByRoute } from '../src/import-export/send-routes.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import listas from '../src/schema/listas-lattes.json' with { type: 'json' };
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

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
function planAfter(edit: (root: XElement) => void, editOuvinte = true) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const changes = diffDocuments(original, working);
  return {
    changes,
    plan: planChanges(
      changes.map((change) => ({ change, itemTitle: 'Congresso Brasileiro de Exemplo' })),
      working,
      { editOuvinte },
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

// ---------------------------------------------------------------- Lattes simulado

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com o currículo do
// XML acima: os eventos 12 (congresso de ouvinte), 13 (seminário de
// convidado) e 14 (outra participação de ouvinte).
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
  // O evento 12 traz a abrangência nacional, que o XML não guarda.
  open.state.formOnly(itemIn(open, '12')).f_classif = 'N';
  return open;
}

const itemIn = (lattes: LattesSimuladoNoTeste, seq: string) =>
  findIn(lattes.state.root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!;
const basicsIn = (lattes: LattesSimuladoNoTeste, seq = '12') =>
  child(itemIn(lattes, seq), 'DADOS-BASICOS');
const detailIn = (lattes: LattesSimuladoNoTeste, seq = '12') =>
  child(itemIn(lattes, seq), 'DETALHAMENTO');

const gets = (lattes: LattesSimuladoNoTeste) =>
  lattes.state.log
    .filter((l) => l.method === 'GET' && !/^pkg_menu\.menu$/i.test(l.proc))
    .map((l) => l.path);

const menuWith = (lattes: LattesSimuladoNoTeste, html: string): LattesPort => ({
  ...lattes.port,
  menuHtml: () => html.replaceAll('K000000000', lattes.state.code),
});

/** Troca o HTML do formulário de eventos. */
const eventForm = (fn: (html: string) => string) => faults.rewritePages(/^PKG_EVENTO\.form$/i, fn);

// ---------------------------------------------------------------- testes

describe('alteração de evento: chave', () => {
  it('fica ligada: o contrato confere o formulário, e o plano liga com as capacidades da extensão', () => {
    expect(EDIT_OUVINTE_ENABLED).toBe(true);
    expect(LATTES_CONTRACT.forms.evento).toEqual(EVENTO_SPEC);
    expect(LATTES_CONTRACT.menu).toContain('pkg_evento.lista');
    const edit = (root: XElement) => setAttr(basics(root), 'TITULO', 'Novo título');
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    edit(working);
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    // Sem as opções, o evento fica à mão: esquecer as capacidades não manda nada à extensão.
    const semOpcoes = planChanges(entries, working);
    expect(semOpcoes.ops).toEqual([]);
    expect(semOpcoes.unsupported[0]!.reason).toBe('Formulário não suportado ainda');
    expect(planAfter(edit, false).plan.ops).toEqual([]);
    expect(planAfter(edit).plan.ops.map((o) => o.kind)).toEqual(['evento']);
  });

  it('só vai a uma extensão que anuncia a alteração de evento', () => {
    expect(BRIDGE_FEATURES).toContain('alterar-evento');
    expect(planOptionsFor(BRIDGE_FEATURES)).toEqual({ editOuvinte: true });
    expect(planOptionsFor(['estado-lattes', 'curriculo'])).toEqual({ editOuvinte: false });
    expect(planOptionsFor([])).toEqual({ editOuvinte: false });
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(basics(working), 'TITULO', 'Novo título');
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    const antiga = planChanges(entries, working, planOptionsFor(['estado-lattes']));
    expect(antiga.ops).toEqual([]);
    expect(antiga.unsupported.map((u) => u.reason)).toEqual(['Formulário não suportado ainda']);
    const nova = planChanges(entries, working, planOptionsFor(BRIDGE_FEATURES));
    expect(nova.ops.map((o) => o.kind)).toEqual(['evento']);
  });

  it('ligada, convidado e participante continuam à mão, e a exclusão segue desligada', () => {
    const seminario = (root: XElement) =>
      child(find(root, 'PARTICIPACAO-EM-SEMINARIO', '13'), 'DADOS-BASICOS');
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(seminario(working), 'TITULO', 'Outra palestra');
    const container = find(working, 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS');
    container.children = container.children.filter(
      (c) => c.kind !== 'element' || getAttr(c, 'SEQUENCIA-PRODUCAO') !== '14',
    );
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    const { ops, unsupported } = planChanges(entries, working, planOptionsFor(BRIDGE_FEATURES));
    expect(ops).toEqual([]);
    expect(unsupported.map((u) => u.reason)).toEqual([
      expect.stringMatching(/só a participação como ouvinte; a edição como Convidado/),
      'Excluir pelo conector: desligado até um teste acompanhado no Lattes',
    ]);
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
    expect(routed.pendente[0]!.entries.map((e) => e.change.element)).toEqual([
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

  it('só planeja alteração: item novo ou removido não vira gravação', () => {
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(basics(working), 'TITULO', 'Novo');
    const [change] = diffDocuments(original, working);
    const chain = resolvePath(working, change!.path);
    expect(planEvento(change!, chain, 'x')).toMatchObject({ kind: 'evento' });
    expect(planEvento({ ...change!, kind: 'novo' }, chain, 'x')).toBeUndefined();
    expect(planEvento({ ...change!, kind: 'removido' }, chain, 'x')).toBeUndefined();
  });
});

const opFor = (edit: (root: XElement) => void): EventoOp => onlyOp(edit);

describe('alteração de evento: aplicar no Lattes simulado', () => {
  it('acha o evento pela lista, envia só os campos da operação e confere', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => {
      setAttr(basics(root), 'TITULO', 'Apresentação … São Paulo');
      setAttr(basics(root), 'PAIS', 'Estados Unidos');
    });
    const r = await applyOp(op, lattes.port);
    expect(r).toEqual({
      detail: 'Gravado e conferido no Lattes',
      key: op.key,
      status: 'conferido',
    });
    expect(getAttr(basicsIn(lattes), 'PAIS')).toBe('Estados Unidos');
    expect(getAttr(basicsIn(lattes), 'TITULO')).toBe('Apresentação … São Paulo');
    const posts = postsOf(lattes);
    expect(posts).toHaveLength(1);
    const post = lattes.state.log.find((l) => l.method === 'POST')!;
    expect(post.proc).toBe('PKG_EVENTO.FORM');
    // Latin-1: "ã" vai como %E3; as reticências, fora do Latin-1, como referência numérica.
    expect(post.body).toContain('f_titulo=Apresenta%E7%E3o+%26%238230%3B+S%E3o+Paulo');
    expect(post.pairs).toContainEqual(['F_TPO', '']);
    expect(post.pairs).toContainEqual(['f_ctr', 'U']);
    expect(post.pairs).toContainEqual(['f_seq', '12']);
    expect(post.pairs).toContainEqual(['f_classif', 'N']);
    expect(post.pairs!.map(([k]) => k)).not.toContain('salvar');
    // A lista inteira é lida antes da filtrada por divulgação científica.
    expect(gets(lattes)[0]).toBe(`pkg_evento.lista?f_cod=${lattes.state.code}`);
  });

  it('procura na lista filtrada quando a inteira não tem o evento', async () => {
    // A lista inteira esconde o 12; ele só aparece na filtrada.
    const lattes = await lattesFor({
      intercept: async (req, _state, next) => {
        const out = await next();
        const whole =
          /^pkg_evento\.lista$/i.test(req.proc) && !req.get('f_sta_divulgacao_cientifica');
        if (!whole || !('html' in out)) return out;
        return { ...out, html: out.html.replace(/<tr[^>]*f_seq=12'[\s\S]*?<\/tr>/, '') };
      },
    });
    setAttr(basicsIn(lattes), 'FLAG-DIVULGACAO-CIENTIFICA', 'SIM');
    const port = menuWith(
      lattes,
      `<a onclick="modalCV1.setarUrl(&quot;pkg_evento.lista?f_cod=K000000000&quot;, true)">x</a>
       <a onclick="modalCV1.setarUrl(&quot;pkg_evento.LISTA?f_sta_divulgacao_cientifica=S&amp;f_cod=K000000000&quot;, true)">y</a>`,
    );
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'T'));
    expect((await applyOp(op, port)).status).toBe('conferido');
    const code = lattes.state.code;
    expect(gets(lattes).slice(0, 2)).toEqual([
      `pkg_evento.lista?f_cod=${code}`,
      `pkg_evento.LISTA?f_sta_divulgacao_cientifica=S&f_cod=${code}`,
    ]);
  });

  it('não envia nada quando a linha do Lattes não é a que o editor pensa', async () => {
    const cases: ((lattes: LattesSimuladoNoTeste) => void)[] = [
      (l) => setAttr(basicsIn(l), 'FORMA-PARTICIPACAO', 'Participante'),
      (l) => {
        // Outra natureza: o item vira um seminário (F_COD_PROD A32).
        const item = itemIn(l, '12');
        item.name = 'PARTICIPACAO-EM-SEMINARIO';
        for (const c of item.children) {
          if (c.kind === 'element') c.name = c.name.replace('CONGRESSO', 'SEMINARIO');
        }
      },
      (l) => setAttr(basicsIn(l), 'ANO', '2017'),
      (l) => setAttr(basicsIn(l), 'TITULO', 'Já mudou no Lattes'),
    ];
    for (const change of cases) {
      const lattes = await lattesFor();
      change(lattes);
      const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
      const r = await applyOp(op, lattes.port);
      expect(r.status).toBe('divergente');
      expect(r.detail).toMatch(/^O Lattes não está como o editor espera: /);
      expect(postsOf(lattes)).toEqual([]);
    }
  });

  it('acusa evento, lista ou formulário que não acha, sem enviar', async () => {
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
    const semEvento = await lattesFor();
    const container = findIn(
      semEvento.state.root,
      (el) => el.name === 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS',
    )!;
    semEvento.state.remove(container, itemIn(semEvento, '12'));
    expect(await applyOp(op, semEvento.port)).toMatchObject({
      detail: 'Evento 12 não encontrado no Lattes',
      status: 'erro',
    });
    expect(postsOf(semEvento)).toEqual([]);
    const lattes = await lattesFor();
    const semLista = menuWith(lattes, '<a href="pkg_idioma.lista?f_cod=K000000000">x</a>');
    expect(await applyOp(op, semLista)).toMatchObject({
      detail: 'Participação em eventos não encontrada no menu do Lattes',
      status: 'erro',
    });
    const semForm = { ...lattes.port, readForm: () => undefined };
    expect(await applyOp(op, semForm)).toMatchObject({
      detail: 'Formulário GN_TEC não encontrado',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
    const inclusao = await lattesFor({
      intercept: eventForm((html) =>
        html.replace('name="f_ctr" value="U"', 'name="f_ctr" value="I"'),
      ),
    });
    expect((await applyOp(op, inclusao.port)).detail).toBe(
      'O formulário não está em modo de alteração',
    );
    expect(postsOf(inclusao)).toEqual([]);
  });

  it('recusa valor acima do limite do campo', async () => {
    const lattes = await lattesFor({
      intercept: eventForm((html) =>
        html.replace(/(name="f_titulo"[^>]*maxlength=")255"/, '$110"'),
      ),
    });
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Um título comprido demais'));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'f_titulo passa do limite do Lattes (10 caracteres)',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('acusa campo não gravado e outro campo que mudou junto', async () => {
    const op = () => opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
    const naoGravou = await lattesFor({
      intercept: faults.afterPost((_req, state) =>
        setAttr(
          child(
            findIn(state.root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === '12')!,
            'DADOS-BASICOS',
          ),
          'TITULO',
          '',
        ),
      ),
    });
    expect(await applyOp(op(), naoGravou.port)).toMatchObject({
      detail: 'O Lattes não gravou: f_titulo',
      status: 'erro',
    });
    const colateral = await lattesFor({
      intercept: faults.afterPost((_req, state) =>
        setAttr(
          child(
            findIn(state.root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === '12')!,
            'DETALHAMENTO',
          ),
          'CIDADE-DO-EVENTO',
          'Canoas',
        ),
      ),
    });
    expect(await applyOp(op(), colateral.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: f_cidade',
      status: 'erro',
    });
  });

  it('para quando a sessão cai, antes ou depois de enviar', async () => {
    for (const at of [1, 2, 3]) {
      const lattes = await lattesFor({ intercept: faults.logonAtGet(at) });
      const op = opFor((root) => setAttr(basics(root), 'TITULO', 'Novo'));
      expect((await applyOp(op, lattes.port)).status).toBe('sessao');
    }
  });

  it('desfaz pelo registro do enviado, voltando o antes', async () => {
    const lattes = await lattesFor();
    const op = opFor((root) => {
      setAttr(basics(root), 'TITULO', 'Novo');
      setAttr(basics(root), 'PAIS', 'Alemanha');
    });
    expect((await applyOp(op, lattes.port)).status).toBe('conferido');
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
    expect((await applyOp(undo, lattes.port)).status).toBe('conferido');
    expect(getAttr(basicsIn(lattes), 'PAIS')).toBe('Brasil');
    expect(getAttr(basicsIn(lattes), 'TITULO')).toBe('');
    expect(getAttr(detailIn(lattes), 'CIDADE-DO-EVENTO')).toBe('Porto Alegre');
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
    const lattes = await lattesFor();
    const report = await checkContract(lattes.port, contract);
    expect(evento(report)).toEqual({ drifts: [], form: 'GN_TEC', kind: 'evento', status: 'ok' });
    expect(report.menu).toContainEqual({ found: true, proc: 'pkg_evento.lista' });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('aponta campo que mudou e trava a fila de eventos', async () => {
    const longer = await lattesFor({
      intercept: eventForm((html) =>
        html.replace(/(name="f_titulo"[^>]*maxlength=")255"/, '$1300"'),
      ),
    });
    const report = await checkContract(longer.port, contract);
    expect(evento(report).drifts).toEqual([
      { expected: '255', field: 'f_titulo', form: 'GN_TEC', kind: 'limite-mudou', observed: '300' },
    ]);
    const noTpo = await lattesFor();
    const broken = await checkContract(
      {
        ...noTpo.port,
        readForm: (html, form) =>
          noTpo.port.readForm(html, form)?.filter((c) => c.name !== 'F_TPO'),
      },
      contract,
    );
    expect(blocksKind(broken, 'evento')).toEqual([
      { field: 'F_TPO', form: 'GN_TEC', kind: 'campo-sumiu' },
    ]);
  });

  it('sem evento cadastrado fica sem amostra; sem a lista, o link sumiu', async () => {
    const lattes = await lattesFor();
    const container = findIn(
      lattes.state.root,
      (el) => el.name === 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS',
    )!;
    container.children = [];
    const vazio = await checkContract(lattes.port, contract);
    expect(evento(vazio)).toMatchObject({
      detail: 'O currículo não tem participação em eventos',
      status: 'sem-amostra',
    });
    expect(lacksSample(vazio, 'evento')).toBeDefined();
    const semLista = await checkContract(
      menuWith(lattes, '<a href="pkg_idioma.lista?f_cod=K000000000">x</a>'),
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

  it('todo país da captura com um código só tem código, sem diferença de acento e caixa', () => {
    const names = Object.entries(listas.codigosDosPaises);
    expect(names).toHaveLength(242);
    for (const [name, code] of names) expect(countryCode(name)).toBe(code);
    expect(countryCode('África do Sul')).toBe('AFS');
    expect(countryCode('alemanha')).toBe('RFA');
    // Dois códigos no Lattes (RTC e TCH): fica sem código, e o país vai à mão.
    expect(countryCode('República Tcheca')).toBeUndefined();
    expect(countryCode('Atlântida')).toBeUndefined();
  });

  it('manda F_TPO vazio só no evento de ouvinte, quando a lista veio vazia', () => {
    const tpo = { name: 'F_TPO', selected: [], type: 'select-one', value: '' };
    const forma = { checked: true, name: 'F_FORMA', type: 'radio', value: '40' };
    const ouvinte: [string, string][] = [['F_FORMA', '40']];
    expect(withCheckRules('GN_TEC', [forma, tpo], ouvinte)).toEqual([
      ['F_FORMA', '40'],
      ['F_TPO', ''],
    ]);
    expect(withCheckRules('GN_TEC', [forma, tpo], [['F_FORMA', '38']])).toEqual([
      ['F_FORMA', '38'],
    ]);
    expect(withCheckRules('GN_TEC', [forma], ouvinte)).toEqual(ouvinte);
    const already: [string, string][] = [...ouvinte, ['F_TPO', 'x']];
    expect(withCheckRules('GN_TEC', [forma, tpo], already)).toEqual(already);
    expect(withCheckRules('GN_IDIOMA', [forma, tpo], ouvinte)).toEqual(ouvinte);
    // Editoração também é GN_TEC, mas sem F_FORMA: o envio não ganha F_TPO.
    const editoracao: [string, string][] = [
      ['F_COD_PROD', '2D1'],
      ['F_FORMA', '40'],
    ];
    const codProd = { checked: true, name: 'F_COD_PROD', type: 'radio', value: '2D1' };
    const textoForma = { name: 'F_FORMA', type: 'text', value: '40' };
    expect(withCheckRules('GN_TEC', [codProd, textoForma, tpo], editoracao)).toEqual(editoracao);
  });

  it('reconhece a lista filtrada por divulgação científica em qualquer caixa', async () => {
    const lattes = await lattesFor();
    const port = menuWith(
      lattes,
      `<a href="pkg_evento.LISTA?F_STA_DIVULGACAO_CIENTIFICA=S&amp;f_cod=K000000000">y</a>
       <a href="PKG_EVENTO.lista?f_cod=K000000000">x</a>`,
    );
    const op = opFor((root) => setAttr(basics(root), 'TITULO', 'T'));
    expect((await applyOp(op, port)).status).toBe('conferido');
    expect(gets(lattes)[0]).toBe(`PKG_EVENTO.lista?f_cod=${lattes.state.code}`);
  });

  it('o plano devolve Unsupported com chave e rótulo', () => {
    const { plan } = planAfter((root) => setAttr(basics(root), 'IDIOMA', 'Inglês'));
    const u: Unsupported = plan.unsupported[0]!;
    expect(u.key).toContain('PARTICIPACAO-EM-CONGRESSO[SEQUENCIA-PRODUCAO=12]');
    expect(u.label).toMatch(/ · Congresso Brasileiro de Exemplo$/);
  });
});
