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

/** A parte do item (dados básicos ou detalhamento), criada quando falta. */
function part(item: XElement, which: 'basics' | 'detail'): XElement {
  const name = which === 'basics' ? basicsName(item.name) : detailName(item.name);
  let el = childElements(item, name)[0];
  if (!el) {
    el = element(name);
    insertInSchemaOrder(lattesSchema, item, el);
  }
  return el;
}

/** A mesma ligação, lida e gravada numa parte do item. */
function on(which: 'basics' | 'detail', b: Binding): Binding {
  return {
    ...b,
    read: (item) => b.read(part(item, which)),
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
      // A lista nasce vazia e montaTipoApres() a enche no clique da forma
      // (observado). Com um tipo já gravado, o simulado mostra só ele, marcado:
      // como o Lattes marca o tipo gravado não foi visto.
      kind: 'select',
      name: 'F_TPO',
      read: (item) => getAttr(part(item, 'basics'), 'TIPO-PARTICIPACAO') ?? '',
      write: (item, value) => setAttr(part(item, 'basics'), 'TIPO-PARTICIPACAO', value),
    },
    on('detail', attr('f_nme_evento', 'NOME-DO-EVENTO', 'text', { maxLength: 400 })),
    on('basics', attr('f_ano', 'ANO', 'text', { maxLength: 4 })),
    { kind: 'radio', name: 'f_classif', options: h.capturedList('L33'), read: () => '' },
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

/** Opções do F_TPO: as do valor gravado (ver bindings), ou nenhuma. */
function withTypeOptions(list: Binding[], item: XElement | undefined): Binding[] {
  return list.map((b) => {
    if (b.name !== 'F_TPO') return b;
    const current = item ? b.read(item) : '';
    return { ...b, options: current ? [[current, current]] : [] };
  });
}

function lista(state: LattesState): SimResponse {
  const base = `PKG_EVENTO.form?f_cod=${state.code}&amp;F_STA_DIVULGACAO_CIENTIFICA=`;
  const rows = eventItems(state)
    .map((item) => {
      const name = getAttr(part(item, 'detail'), 'NOME-DO-EVENTO') ?? '';
      const year = getAttr(part(item, 'basics'), 'ANO') ?? '';
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
  else return lista(state);
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
  'pkg_evento.lista': (_req, state) => lista(state),
  prc_midias_sociais: midiasSociais,
};
