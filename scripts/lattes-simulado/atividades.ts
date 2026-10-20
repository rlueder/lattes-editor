// As atividades de uma atuação no Lattes simulado: o formulário GN_ATIV_CARGO
// (pkg_ativ.cargo), de inclusão por natureza e de alteração, e o POST
// PKG_ATIV.cargo, com a grade de descrições em f_espec_l.
//
// Observado (lote 3 da recaptura de 15/10/2026): os campos de cada natureza,
// as opções do nível e do período, e o formato de f_espec_l
// ("<n>@<c>?<nome>!", oito linhas). Inferido: a ligação de cada campo com o
// XML, o link de cada atividade na tela de cargos e vínculos (com
// f_seq_funcao), o efeito do POST. Só a atividade de ensino grava; as outras
// naturezas respondem que o envio não é simulado.

import { ACTIVITY_TYPES } from '../../src/bridge/edit-atividade.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { COURSES, ORGANS } from './buscas.ts';
import { notSimulated } from './censo.ts';
import type { LattesState } from './estado.ts';
import { applyCensusForm, type FieldLink, renderCensusForm } from './formulario-censo.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type SimResponse } from './tipos.ts';

const LEVELS: Record<string, string> = {
  '401': 'GRADUACAO',
  '402': 'POS-GRADUACAO',
  '403': 'ESPECIALIZACAO',
  '404': 'APERFEICOAMENTO',
  '405': 'ENSINO-FUNDAMENTAL',
  '406': 'ENSINO-MEDIO',
  '409': 'OUTRO',
};
const toForm = Object.fromEntries(Object.entries(LEVELS).map(([c, x]) => [x, c]));

const LINKS: Record<string, FieldLink> = {
  f_ano_fim: { attr: 'ANO-FIM' },
  f_ano_ini: { attr: 'ANO-INICIO' },
  f_curso: { attr: 'NOME-CURSO' },
  f_mes_fim: { attr: 'MES-FIM' },
  f_mes_ini: { attr: 'MES-INICIO' },
  f_nivel: {
    attr: 'TIPO-ENSINO',
    toForm: (x) => toForm[x] ?? '',
    toXml: (f) => LEVELS[f] ?? '',
  },
  f_status: {
    attr: 'FLAG-PERIODO',
    toForm: (x) => ({ ANTERIOR: 'N', ATUAL: 'S' })[x] ?? '',
    toXml: (f) => ({ N: 'ANTERIOR', S: 'ATUAL' })[f] ?? '',
  },
};

/** O período, que todas as naturezas têm (edição lida em 19/10/2026). */
const PERIOD_LINKS: Record<string, FieldLink> = {
  ...Object.fromEntries(
    ['f_ano_fim', 'f_ano_ini', 'f_mes_fim', 'f_mes_ini', 'f_status'].map((f) => [f, LINKS[f]!]),
  ),
  // O texto do órgão, desabilitado na página, como o atribuir() da janela o
  // escreve ("órgão/\nunidade"); a unidade sai na leitura do item (cargoForm).
  f_orgao: { attr: 'NOME-ORGAO' },
};

/** Os campos da alteração, com o texto do órgão como a página o mostra (com a unidade). */
function withOrganText(item: XElement): Record<string, FieldLink> {
  const unit = getAttr(item, 'NOME-UNIDADE') ?? '';
  return {
    ...PERIOD_LINKS,
    f_orgao: { attr: 'NOME-ORGAO', toForm: (v) => (unit ? `${v}/\n${unit}` : v) },
  };
}

/** Todas as atividades da atuação, com a natureza de cada uma. */
export function activities(atuacao: XElement): { el: XElement; natur: string }[] {
  const out: { el: XElement; natur: string }[] = [];
  for (const group of childElements(atuacao)) {
    for (const el of childElements(group)) {
      const type = ACTIVITY_TYPES[el.name];
      if (type) out.push({ el, natur: type.natur });
    }
  }
  return out;
}

/**
 * A grade de descrições da edição: a descrição do XML numa linha, com c 1; no
 * ensino, as disciplinas, com o c da sequência delas (lido em 20/10/2026).
 */
function descriptionScript(item: XElement): string {
  if (item.name === 'ENSINO') {
    const rows = childElements(item, 'DISCIPLINA').map((d) =>
      Object.fromEntries([
        ['l', textOf(d)],
        ['c', getAttr(d, 'SEQUENCIA-ESPECIFICACAO') ?? ''],
      ]),
    );
    return `<script>\nvar providerDetAtiv = \n${JSON.stringify([...rows, {}])};\n</script>`;
  }
  const attr = ACTIVITY_TYPES[item.name]?.description;
  const text = attr ? getAttr(item, attr) : '';
  const rows = text
    ? [
        Object.fromEntries([
          ['l', text],
          ['c', '1'],
        ]),
      ]
    : [];
  return `<script>\nvar providerDetAtiv = \n${JSON.stringify([...rows, {}])};\n</script>`;
}

/** As atividades de ensino da atuação. */
export function teaching(atuacao: XElement): XElement[] {
  const container = childElements(atuacao, 'ATIVIDADES-DE-ENSINO')[0];
  return container ? childElements(container, 'ENSINO') : [];
}

/** O formulário da natureza, como o lote 3 o leu; sem natureza, o do censo. */
const entryFor = (nature: string) =>
  ['1', '2', '4', '5', '6', '7', '8', '9', 'B'].includes(nature)
    ? `atividade-${nature}`
    : 'atividade';

export function cargoForm(req: SimRequest, state: LattesState, atuacao?: XElement): SimResponse {
  const seq = req.get('f_seq_funcao');
  const asked = (req.get('f_natur_ativ') ?? '').toUpperCase();
  const found =
    seq && atuacao
      ? activities(atuacao).find(
          (a) =>
            getAttr(a.el, 'SEQUENCIA-FUNCAO-ATIVIDADE') === seq && (!asked || a.natur === asked),
        )
      : undefined;
  const item = found?.el;
  const nature = found ? found.natur : asked;
  const codeOf = (el: XElement | undefined) => (el && getAttr(el, 'CODIGO-CURSO')) || '';
  const course = codeOf(item);
  const hidden = {
    f_cod: state.code,
    f_cod_curso: course,
    f_codinst: req.get('f_codinst') ?? '',
    f_ctr: item ? 'U' : 'I',
    f_natur_ativ: nature,
    f_seq_ativ: req.get('f_seq_ativ') ?? '',
    f_seq_funcao: seq ?? '',
  };
  const screen = {
    entry: entryFor(nature),
    links: nature === '4' ? LINKS : item ? withOrganText(item) : {},
  };
  return html(
    h.page(
      'Atividade',
      `${renderCensusForm(screen, item, hidden, state)}${item ? descriptionScript(item) : ''}`,
    ),
  );
}

/** Grava a atividade de ensino: os campos ligados, o curso pelo código e as disciplinas de f_espec_l. */
export function cargoPost(req: SimRequest, state: LattesState, atuacao?: XElement): SimResponse {
  if (atuacao && req.get('f_ctr') === 'U') return cargoUpdate(req, state, atuacao);
  if (!atuacao || req.get('f_natur_ativ') !== '4' || req.get('f_ctr') !== 'I')
    return notSimulated();
  const container = state.ensure(atuacao, 'ATIVIDADES-DE-ENSINO');
  const seq = state.nextSeq(atuacao, 'ENSINO', 'SEQUENCIA-FUNCAO-ATIVIDADE');
  const item = element('ENSINO', { 'SEQUENCIA-FUNCAO-ATIVIDADE': seq });
  applyCensusForm({ entry: 'atividade-4', links: LINKS }, item, req, state);
  const code = req.get('f_cod_curso') || req.get('f_cod_curso2');
  if (code) {
    const hit = Object.values(COURSES)
      .flat()
      .find(([value]) => value.trim().slice(1) === code);
    setAttr(item, 'CODIGO-CURSO', code);
    if (hit) setAttr(item, 'NOME-CURSO', hit[1]);
  }
  for (const [, n, name] of (req.get('f_espec_l') ?? '').matchAll(/(\d+)@[^?]*\?([^!]*)!/g)) {
    if (!name) continue;
    item.children.push(
      element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': n! }, [{ kind: 'text', value: name }]),
    );
  }
  insertInSchemaOrder(lattesSchema, container, item);
  state.touch();
  return html(
    h.savedScript(
      `PKG_ATIV.cargos_vinculos?f_cod=${state.code}&f_seq_ativ=${getAttr(atuacao, 'SEQUENCIA-ATIVIDADE')}`,
    ),
  );
}

/** As linhas preenchidas de f_espec_l ("n@c?nome!"). */
const specRows = (spec: string) =>
  [...spec.matchAll(/\d+@([^?]*)\?([^!]*)!/g)]
    .map((m) => ({ c: m[1]!, l: m[2]! }))
    .filter((r) => r.l !== '');

const textOf = (el: XElement) =>
  el.children.map((c) => (c.kind === 'text' ? c.value : '')).join('');

/**
 * A alteração de uma atividade (19/10/2026): o período pelos campos, o
 * órgão ou a unidade pelos ocultos da janela de órgãos e a descrição pela
 * primeira linha de f_espec_l (no ensino, a grade inteira são as disciplinas). Sem descrição o check() da
 * página não envia; o simulado não grava nada nesse caso.
 */
function cargoUpdate(req: SimRequest, state: LattesState, atuacao: XElement): SimResponse {
  const found = activities(atuacao).find(
    (a) => getAttr(a.el, 'SEQUENCIA-FUNCAO-ATIVIDADE') === req.get('f_seq_funcao'),
  );
  if (!found) return html(h.page('Atividade', '<p>Registro não encontrado.</p>'));
  const first = /^1@[^?]*\?([^!]*)!/.exec(req.get('f_espec_l') ?? '')?.[1] ?? '';
  const back = h.savedScript(
    `PKG_ATIV.cargos_vinculos?f_cod=${state.code}&f_seq_ativ=${getAttr(atuacao, 'SEQUENCIA-ATIVIDADE')}`,
  );
  if (!first) return html(back);
  applyCensusForm({ entry: entryFor(found.natur), links: PERIOD_LINKS }, found.el, req, state);
  const attr = ACTIVITY_TYPES[found.el.name]?.description;
  if (attr) setAttr(found.el, attr, first);
  // O órgão escolhido na janela: o código em f_codorgao, o texto em f_orgao_old.
  // O órgão (tipo 0) em f_codorgao; a unidade em f_codorgao2, com o texto
  // "órgão/\nunidade" que o atribuir() da janela monta.
  const organCode = req.get('f_codorgao');
  const unitCode = req.get('f_codorgao2');
  const [organName = '', unitName = ''] = (req.get('f_orgao_old') ?? '').split(/\/\r?\n/);
  // A janela do simulado dá tipo 0 também às unidades: vale o texto.
  const picked = unitCode || organCode;
  if (picked && unitName) {
    setAttr(found.el, 'CODIGO-UNIDADE', picked);
    setAttr(found.el, 'NOME-UNIDADE', unitName);
    setAttr(found.el, 'NOME-ORGAO', organName);
    // O órgão de cima não vem no POST: o servidor o sabe pela unidade (inferido).
    const above = Object.values(ORGANS)
      .flat()
      .find((o) => o.units.some(([code]) => code.trim() === picked));
    if (above) setAttr(found.el, 'CODIGO-ORGAO', above.code);
  } else if (picked) {
    setAttr(found.el, 'CODIGO-ORGAO', picked);
    setAttr(found.el, 'NOME-ORGAO', organName);
    setAttr(found.el, 'CODIGO-UNIDADE', '');
    setAttr(found.el, 'NOME-UNIDADE', '');
  }
  // No ensino, a grade inteira são as disciplinas: o servidor grava como chegou.
  if (found.el.name === 'ENSINO') {
    found.el.children = specRows(req.get('f_espec_l') ?? '').map(({ c, l }, i) =>
      element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': c && c !== '0' ? c : String(i + 1) }, [
        { kind: 'text', value: l },
      ]),
    );
    found.el.selfClosing = found.el.children.length === 0;
  }
  state.touch();
  return html(back);
}
