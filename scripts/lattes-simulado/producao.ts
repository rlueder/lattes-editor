// As telas de alteração no lugar de produções, orientações e bancas no Lattes
// simulado, montadas da especificação de cada tipo (src/bridge/production/):
// a lista do menu com um link por item, o formulário com os campos que a
// especificação liga ao XML e as grades (grades.ts), e o POST, que grava os
// campos de volta no XML e as grades como chegaram.
//
// Inferido, e de propósito: o desenho das páginas (só os controles que o
// conector lê) e que o servidor grave cada campo como chega. A forma real de
// cada formulário está no censo (docs/lattes-formularios/), e os testes de
// cada família conferem a especificação contra ele.

import idiomas from '../../src/bridge/production/idiomas-lattes.json' with { type: 'json' };
import { country, date, language } from '../../src/bridge/production/mappers.ts';
import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import type { FieldMap, ProductionTarget } from '../../src/bridge/production/types.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import { applyGrids, GRID_HIDDEN, gridScripts } from './grades.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, notFound, type Routes, type SimResponse } from './tipos.ts';

/** Os tipos com tela própria no simulado (censo.ts, grades.ts), fora daqui. */
const CUSTOM = new Set(['trabalho-tecnico']);

const mapOf = (m: FieldMap | string): FieldMap => (typeof m === 'string' ? { field: m } : m);

function itemsOf(state: LattesState, t: ProductionTarget): XElement[] {
  const out: XElement[] = [];
  const walk = (el: XElement) => {
    for (const c of childElements(el)) {
      if (c.name === t.element) out.push(c);
      else walk(c);
    }
  };
  walk(state.root);
  return out;
}

const seqOf = (item: XElement) =>
  getAttr(item, 'SEQUENCIA-PRODUCAO') ?? getAttr(item, 'SEQUENCIA-ORIENTACAO') ?? '';

const partOf = (item: XElement, child: string) => childElements(item, child)[0];

/** O valor do formulário de volta para o XML: o candidato cujo toForm dá o mesmo valor. */
function fromForm(element: string, attr: string, map: FieldMap, value: string): string | undefined {
  if (!map.toForm) return value;
  if (value === '') return '';
  if (map.toForm === country) return h.countryName(value);
  if (map.toForm === date) return value.replace(/\//g, '');
  if (map.toForm === language) {
    return Object.entries(idiomas as Record<string, string>).find(([, c]) => c === value)?.[0];
  }
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  const candidates = [...(spec?.enum ?? []), 'SIM', 'NAO'];
  return candidates.find((c) => map.toForm!(c) === value);
}

function list(state: LattesState, t: ProductionTarget): string {
  const extra = Object.entries(t.list.params ?? {})
    .map(([k, v]) => `&amp;${k}=${v}`)
    .join('');
  return itemsOf(state, t)
    .map((item) => {
      const title = getAttr(partOf(item, t.title.child) ?? element(''), t.title.attr) ?? '';
      return `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('${t.list.formProc}?f_cod=${state.code}${extra}&amp;f_seq=${seqOf(item)}',true); return false;">${h.esc(title)}</a></td></tr>`;
    })
    .join('\n');
}

function form(req: SimRequest, state: LattesState, t: ProductionTarget): SimResponse {
  // Sem f_seq é a inclusão, que este arquivo não simula (o censo a lê como ausente).
  if (!req.get('f_seq')) return notFound(t.list.formProc);
  const item = itemsOf(state, t).find((i) => seqOf(i) === req.get('f_seq'));
  if (!item) return html(h.page(t.id, '<p>Registro não encontrado.</p>'));
  const controls = Object.entries(t.fields).map(([key, m]) => {
    const [child, attr] = key.split('@') as [string, string];
    const { field, toForm } = mapOf(m);
    const raw = getAttr(partOf(item, child) ?? element(''), attr) ?? '';
    return h.text(field, (toForm ? toForm(raw) : raw) ?? '');
  });
  // Dois atributos no mesmo campo: o controle sai uma vez só.
  const unique = [...new Set(controls)].join('\n');
  const body = `<form name="${t.form.name}" method="post" action="${t.form.action}">
${unique}
${h.hidden('f_ctr', 'U')}${h.hidden('f_cod', state.code)}${h.hidden('f_seq', req.get('f_seq') ?? '')}${GRID_HIDDEN}
${h.formButtons(true)}
</form>
${gridScripts(item)}
${h.formScripts(t.form.name, 'Deseja realmente excluir esta produção?')}`;
  return html(h.page(t.id, body));
}

function post(req: SimRequest, state: LattesState, t: ProductionTarget): SimResponse {
  const back = h.savedScript(`${t.list.proc}?f_cod=${state.code}`);
  if (req.get('f_ctr') !== 'U') return html(back);
  const item = itemsOf(state, t).find((i) => seqOf(i) === req.get('f_seq'));
  if (!item) return html(h.page(t.id, '<p>Registro não encontrado.</p>'));
  writeFields(t, item, req);
  applyGrids(item, req);
  state.touch();
  return html(back);
}

/** As rotas de cada tipo: a lista (escolhida pelos parâmetros), o formulário e o POST. */
export function productionRoutes(): Routes {
  const routes: Routes = {};
  const targets = PRODUCTION_TARGETS.filter((t) => !CUSTOM.has(t.id));
  for (const t of targets) {
    const listKey = t.list.proc.toLowerCase();
    if (!routes[listKey]) {
      routes[listKey] = (req, state) => {
        const match = targets.filter(
          (x) =>
            x.list.proc.toLowerCase() === listKey &&
            Object.entries(x.list.params ?? {}).every(([k, v]) => req.get(k) === v),
        );
        const rows = match.map((x) => list(state, x)).join('\n');
        return html(h.page(t.id, `<table>${rows}</table>`));
      };
    }
    routes[t.list.formProc.toLowerCase()] = (req, state) =>
      req.method === 'POST' ? post(req, state, t) : form(req, state, t);
    // O POST costuma ir ao mesmo procedimento do formulário, que já responde aos dois.
    const action = t.form.action.toLowerCase();
    if (action !== t.list.formProc.toLowerCase())
      routes[action] = (req, state) => post(req, state, t);
  }
  return routes;
}

/** Os campos da especificação, do POST de volta para o XML; o que não chegou fica como está. */
export function writeFields(t: ProductionTarget, item: XElement, req: SimRequest): void {
  for (const [key, m] of Object.entries(t.fields)) {
    const [child, attr] = key.split('@') as [string, string];
    const map = mapOf(m);
    const value = req.get(map.field);
    if (value === null || value === undefined) continue;
    const saved = fromForm(child, attr, map, value);
    if (saved === undefined) continue;
    let part = partOf(item, child);
    if (!part) {
      part = element(child, {});
      insertInSchemaOrder(lattesSchema, item, part);
    }
    setAttr(part, attr, saved);
  }
}
