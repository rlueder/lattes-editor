// Demais trabalhos no Lattes simulado: a lista pkg_demais.lista e o
// formulário GN_DEMAIS, postado para PKG_DEMAIS.FORM com f_ctr I, U ou E.
// Observados: o nome da lista (seção 3 de docs/lattes_internals.md) e os
// campos do formulário, do censo de 27/10/2026, que formulario-censo.ts lê.
// Inferidos: o link de cada linha (com f_seq, como as outras produções), a
// ligação dos campos com o XML, que é a do conector (targets/demais.ts), e o
// efeito do POST.

import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import { mapOf, writeFields } from '../../src/bridge/refresh/from-form.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import {
  applyCensusForm,
  type CensusScreen,
  type FieldLink,
  renderCensusForm,
} from './formulario-censo.ts';
import { applyGrids, gridScripts } from './grades.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const PATH = ['OUTRA-PRODUCAO'];
const BASICS = 'DADOS-BASICOS-DE-DEMAIS-TRABALHOS';
const TARGET = PRODUCTION_TARGETS.find((t) => t.id === 'demais-trabalhos')!;

/** Os campos ligados como o conector os grava: o valor da página é o toForm do XML. */
const SCREEN: CensusScreen = {
  entry: 'demais-trabalhos',
  links: Object.fromEntries(
    Object.entries(TARGET.fields).map(([key, m]): [string, FieldLink] => {
      const [child, attr] = key.split('@') as [string, string];
      const map = mapOf(m);
      return [
        map.field,
        {
          attr,
          under: [child],
          ...(map.toForm ? { toForm: (xml: string) => map.toForm!(xml, 'before') ?? '' } : {}),
        },
      ];
    }),
  ),
};

function demais(state: LattesState): XElement[] {
  const container = state.find(PATH);
  return container ? childElements(container, 'DEMAIS-TRABALHOS') : [];
}

const bySeq = (state: LattesState, seq: string | undefined) =>
  demais(state).find((d) => getAttr(d, 'SEQUENCIA-PRODUCAO') === seq);

function lista(state: LattesState): SimResponse {
  const rows = demais(state)
    .map((d) => {
      const title = getAttr(childElements(d, BASICS)[0] ?? element(''), 'TITULO') ?? '';
      return `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_demais.form?f_cod=${state.code}&amp;f_seq=${getAttr(d, 'SEQUENCIA-PRODUCAO')}',true); return false;">${h.esc(title)}</a></td></tr>`;
    })
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_demais.form?f_cod=${state.code}',true); return false;">Incluir novo item</a>`;
  return html(
    h.page(
      'Demais trabalhos',
      `${rows ? `<table>${rows}</table>` : '<p>Nenhum registro cadastrado</p>'}\n<p>${novo}</p>`,
    ),
  );
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const item = seq ? bySeq(state, seq) : undefined;
  if (seq && !item) return html(h.page('Demais trabalhos', '<p>Registro não encontrado.</p>'));
  const hidden = { f_cod: state.code, f_ctr: item ? 'U' : 'I', f_seq: seq ?? '' };
  return html(
    h.page(
      'Demais trabalhos',
      `${renderCensusForm(SCREEN, item, hidden, state)}\n${gridScripts(item)}`,
    ),
  );
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`pkg_demais.lista?f_cod=${state.code}`);
  if (ctr === 'I') {
    state.nextProduction += 1;
    const item = element('DEMAIS-TRABALHOS', {
      'SEQUENCIA-PRODUCAO': String(state.nextProduction),
    });
    applyCensusForm({ ...SCREEN, links: {} }, item, req, state);
    writeFields(TARGET, item, (field) => req.get(field));
    applyGrids(item, req);
    insertInSchemaOrder(lattesSchema, state.ensurePath(PATH), item);
    state.touch();
    return html(back);
  }
  const item = bySeq(state, req.get('f_seq'));
  if (!item) return html(h.page('Demais trabalhos', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(PATH)!, item);
  else if (ctr === 'U') {
    applyCensusForm({ ...SCREEN, links: {} }, item, req, state);
    writeFields(TARGET, item, (field) => req.get(field));
    applyGrids(item, req);
  } else return html(back);
  state.touch();
  return html(back);
}

export const DEMAIS_ROUTES: Routes = {
  'pkg_demais.form': (req, state) => (req.method === 'POST' ? post(req, state) : form(req, state)),
  'pkg_demais.lista': (_req, state) => lista(state),
};
