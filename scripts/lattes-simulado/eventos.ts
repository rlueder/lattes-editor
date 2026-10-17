// Participação em eventos no Lattes simulado: a lista pkg_evento.lista, o
// formulário GN_TEC (PKG_EVENTO.form) de alteração e inclusão, e o POST
// PKG_EVENTO.FORM com f_ctr U, I ou E (docs/lattes_internals.md, seção 16).
// Também prc_midias_sociais, um formulário de inclusão que só existe aqui
// para a conferência das listas de país e idioma (src/bridge/list-watch.ts).

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { productionRoutes } from './producao.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

export const EVENTS_PATH = ['DADOS-COMPLEMENTARES', 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS'];

/** F_COD_PROD → elemento do evento (inferido pelo rótulo da natureza). */
const EVENT_ELEMENTS: Record<string, string> = {
  A31: 'PARTICIPACAO-EM-CONGRESSO',
  A32: 'PARTICIPACAO-EM-SEMINARIO',
  A33: 'PARTICIPACAO-EM-SIMPOSIO',
  A34: 'PARTICIPACAO-EM-OFICINA',
  A35: 'PARTICIPACAO-EM-ENCONTRO',
  A36: 'PARTICIPACAO-EM-OLIMPIADA',
  A37: 'PARTICIPACAO-EM-FEIRA',
  A38: 'PARTICIPACAO-EM-EXPOSICAO',
  A39: 'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS',
};
const EVENT_CODES = Object.fromEntries(Object.entries(EVENT_ELEMENTS).map(([c, e]) => [e, c]));

const basicsName = (item: string) =>
  item.startsWith('OUTRAS-') ? `DADOS-BASICOS-DE-${item}` : `DADOS-BASICOS-DA-${item}`;
const detailName = (item: string) =>
  item.startsWith('OUTRAS-') ? `DETALHAMENTO-DE-${item}` : `DETALHAMENTO-DA-${item}`;

const partName = (item: XElement, which: 'basics' | 'detail') =>
  which === 'basics' ? basicsName(item.name) : detailName(item.name);

/**
 * A parte do item (dados básicos ou detalhamento) para ler: a que existe, ou
 * uma vazia fora do currículo. Ler nunca muda o estado.
 */
function partOf(item: XElement, which: 'basics' | 'detail'): XElement {
  return childElements(item, partName(item, which))[0] ?? element(partName(item, which));
}

/** A parte do item para gravar, criada no currículo quando falta. */
function part(item: XElement, which: 'basics' | 'detail'): XElement {
  let el = childElements(item, partName(item, which))[0];
  if (!el) {
    el = element(partName(item, which));
    insertInSchemaOrder(lattesSchema, item, el);
  }
  return el;
}

/** A mesma ligação, lida e gravada numa parte do item. */
function on(which: 'basics' | 'detail', b: Binding): Binding {
  return {
    ...b,
    read: (item) => b.read(partOf(item, which)),
    write: b.write && ((item, value) => b.write!(part(item, which), value)),
  };
}

export function eventItems(state: LattesState): XElement[] {
  const container = state.find(EVENTS_PATH);
  return container ? childElements(container).filter((el) => el.name in EVENT_CODES) : [];
}

const bySeq = (state: LattesState, seq: string | undefined) =>
  eventItems(state).find((el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq);

function bindings(state: LattesState, ids: Record<string, string>): Binding[] {
  return [
    on(
      'basics',
      mapped(
        'F_FORMA',
        'FORMA-PARTICIPACAO',
        'radio',
        { Convidado: '38', Ouvinte: '40', Participante: '39' },
        {
          options: h.capturedList('L55'),
        },
      ),
    ),
    {
      // A lista nasce só com a opção vazia e montaTipoApres() a enche por
      // script (observado: censo de 15/10/2026, scriptFilled). Como a edição
      // de um convidado mostra o tipo gravado não foi visto; o simulado faz
      // como a página observada e não o mostra no HTML (withTypeOptions). O
      // POST grava o tipo que vier.
      kind: 'select',
      name: 'F_TPO',
      read: (item) => getAttr(partOf(item, 'basics'), 'TIPO-PARTICIPACAO') ?? '',
      write: (item, value) => setAttr(part(item, 'basics'), 'TIPO-PARTICIPACAO', value),
    },
    on('detail', attr('f_nme_evento', 'NOME-DO-EVENTO', 'text', { maxLength: 400 })),
    on('basics', attr('f_ano', 'ANO', 'text', { maxLength: 4 })),
    {
      // Sem atributo no XSD: o simulado guarda o valor ao lado do item (formOnly).
      kind: 'radio',
      name: 'f_classif',
      options: h.capturedList('L33'),
      read: (item) => state.formOnly(item).f_classif ?? '',
      write: (item, value) => {
        state.formOnly(item).f_classif = value;
      },
    },
    {
      kind: 'select',
      name: 'F_COD_PROD',
      options: h.capturedList('L54'),
      read: (item) => EVENT_CODES[item.name] ?? '',
    },
    on('detail', attr('f_cidade', 'CIDADE-DO-EVENTO', 'text', { maxLength: 255 })),
    on('basics', {
      kind: 'select',
      name: 'f_pais',
      options: [['', ''], ...h.COUNTRIES],
      read: (el) => h.countryCode(getAttr(el, 'PAIS')),
      write: (el, value) => setAttr(el, 'PAIS', h.countryName(value)),
    }),
    on('basics', attr('f_homepage', 'HOME-PAGE-DO-TRABALHO', 'text', { maxLength: 250 })),
    on('basics', attr('f_titulo', 'TITULO', 'text', { maxLength: 255 })),
    on(
      'basics',
      mapped(
        'F_STA_DIVULGACAO_CIENTIFICA',
        'FLAG-DIVULGACAO-CIENTIFICA',
        'radio',
        { NAO: 'N', SIM: 'S' },
        {
          options: h.capturedList('L6'),
        },
      ),
    ),
    on('basics', attr('f_titulo_en', 'TITULO-INGLES', 'text', { maxLength: 400 })),
    {
      kind: 'select',
      name: 'f_tipo_privacidade',
      options: h.PRIVACY,
      read: (el) => state.privacy.get(el) ?? '1',
      write: (el, value) => state.privacy.set(el, value || '1'),
    },
    fixed('f_ctr', ids.f_ctr ?? 'U'),
    fixed('f_cod', state.code),
    fixed('f_seq', ids.f_seq ?? ''),
  ];
}

/**
 * Opções do F_TPO no HTML: só a vazia, como a página observada (o script é que
 * monta as outras). Nos testes, `tpoRendered` mostra o tipo gravado, marcado,
 * para simular uma edição que o traga no HTML.
 */
function withTypeOptions(
  list: Binding[],
  item: XElement | undefined,
  tpoRendered: boolean,
): Binding[] {
  return list.map((b) => {
    if (b.name !== 'F_TPO') return b;
    const current = item && tpoRendered ? b.read(item) : '';
    return { ...b, options: current ? [[current, current]] : [['', '']] };
  });
}

/**
 * A lista inteira, ou só a de divulgação científica com
 * f_sta_divulgacao_cientifica=S (as duas estão no menu, observado; que o
 * filtro seja FLAG-DIVULGACAO-CIENTIFICA é inferido).
 */
function lista(req: SimRequest, state: LattesState): SimResponse {
  const base = `PKG_EVENTO.form?f_cod=${state.code}&amp;F_STA_DIVULGACAO_CIENTIFICA=`;
  const filtered = req.get('f_sta_divulgacao_cientifica')?.toUpperCase() === 'S';
  const rows = eventItems(state)
    .filter((item) => getAttr(item, 'SEQUENCIA-PRODUCAO'))
    .filter(
      (item) =>
        !filtered || getAttr(partOf(item, 'basics'), 'FLAG-DIVULGACAO-CIENTIFICA') === 'SIM',
    )
    .map((item) => {
      const name = getAttr(partOf(item, 'detail'), 'NOME-DO-EVENTO') ?? '';
      const year = getAttr(partOf(item, 'basics'), 'ANO') ?? '';
      return `<tr onclick="self.parent.modalCV2.setarUrl('${base}&amp;f_seq=${getAttr(item, 'SEQUENCIA-PRODUCAO')}',true)"><td>${h.esc(name)}, ${h.esc(year)}</td></tr>`;
    })
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('${base}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Participação em eventos', `<table>${rows}</table>\n<p>${novo}</p>`));
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const item = seq ? bySeq(state, seq) : undefined;
  if (seq && !item) return html(h.page('Evento', '<p>Registro não encontrado.</p>'));
  const list = withTypeOptions(
    bindings(state, { f_ctr: item ? 'U' : 'I', f_seq: seq ?? '' }),
    item,
    state.tpoRendered,
  );
  const body = `<form name="GN_TEC" method="post" action="PKG_EVENTO.FORM">
${renderFields(list, item)}
${h.formButtons(Boolean(item))}
</form>
${h.formScripts('GN_TEC', item ? '\n\nDeseja realmente excluir esta produção?\n\n' : undefined)}`;
  return html(h.page('Participação em eventos', body));
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const container = state.ensurePath(EVENTS_PATH);
  if (ctr === 'I') {
    const name = EVENT_ELEMENTS[req.get('F_COD_PROD') ?? ''];
    if (!name) return html('<script>alert("Informe a natureza do evento.");</script>');
    state.nextProduction += 1;
    const item = element(name, { 'SEQUENCIA-PRODUCAO': String(state.nextProduction) });
    applyFields(bindings(state, {}), item, req);
    // Inferido: o formulário não tem participantes, e o servidor põe a própria pessoa.
    insertInSchemaOrder(
      lattesSchema,
      item,
      element('PARTICIPANTE-DE-EVENTOS-CONGRESSOS', {
        'NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS': state.personName,
        'ORDEM-PARTICIPANTE': '1',
      }),
    );
    insertInSchemaOrder(lattesSchema, container, item);
    state.touch();
    return html(h.eventSavedScript());
  }
  const item = bySeq(state, req.get('f_seq'));
  if (!item) return html(h.page('Evento', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(container, item);
  else if (ctr === 'U') applyFields(bindings(state, {}), item, req);
  else return lista(req, state);
  state.touch();
  return html(h.eventSavedScript());
}

/** Só leitura: os combos de país e idioma, para a conferência das listas. */
function midiasSociais(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<form name="GN_TEC" method="post" action="PRC_MIDIAS_SOCIAIS">
<p>${h.text('f_titulo', '', { maxLength: 400 })}</p>
<p>${h.select('f_pais', h.COUNTRIES, 'BRA')}</p>
<p>${h.select('F_IDIOMA', h.LANGUAGES, 'PT')}</p>
${h.hidden('f_ctr', 'I')}${h.hidden('f_cod', state.code)}
</form>`;
  return html(h.page('Redes sociais, websites e blogs', body));
}

export const EVENTOS_ROUTES: Routes = {
  'pkg_evento.form': (req, state) => (req.method === 'POST' ? post(req, state) : form(req, state)),
  'pkg_evento.lista': lista,
  // Com f_seq (e no POST), a alteração de uma rede social, site ou blog (producao.ts).
  prc_midias_sociais: (req, state) => {
    const edit = productionRoutes().prc_midias_sociais;
    return (req.get('f_seq') || req.method === 'POST') && edit
      ? edit(req, state)
      : midiasSociais(req, state);
  },
};
