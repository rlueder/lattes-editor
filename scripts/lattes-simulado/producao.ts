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
import type { Change } from '../../src/model/changes.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import {
  childElements,
  element,
  getAttr,
  setAttr,
  walk,
  type XElement,
} from '../../src/model/xml.ts';
import { availabilityToForm } from '../../src/schema/availability.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { AGENCIES, allCourses, institutionsOf, withLetter } from './buscas.ts';
import type { LattesState } from './estado.ts';
import { applyGrids, GRID_HIDDEN, gridScripts } from './grades.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, notFound, type Routes, type SimResponse } from './tipos.ts';

/** Os tipos com tela própria no simulado (censo.ts, grades.ts), fora daqui. */
const CUSTOM = new Set(['projeto', 'trabalho-tecnico']);

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

/**
 * O valor do formulário de volta para o XML: o candidato cujo toForm dá o mesmo
 * valor. `labels`: os valores de texto livre que o tipo conhece (a NATUREZA da
 * qualificação, que o XSD não enumera).
 */
function fromForm(
  element: string,
  attr: string,
  map: FieldMap,
  value: string,
  labels: readonly string[] = [],
): string | undefined {
  if (!map.toForm) return value;
  if (map.toForm === availabilityToForm) {
    return value === '' ? 'NAO_INFORMADO' : value.toUpperCase();
  }
  if (value === '') return '';
  if (map.toForm === country) return h.countryName(value);
  if (map.toForm === date) return value.replace(/\//g, '');
  if (map.toForm === language) {
    return Object.entries(idiomas as Record<string, string>).find(([, c]) => c === value)?.[0];
  }
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  // Por último, o próprio valor (lista cujo valor é o rótulo) e a data sem as
  // barras (dd/mm/aaaa do formulário, DDMMAAAA do XML).
  const candidates = [
    ...(spec?.enum ?? []),
    ...labels,
    'SIM',
    'NAO',
    value.replace(/\//g, ''),
    value,
  ];
  return candidates.find((c) => map.toForm!(c) === value);
}

/**
 * Os campos dos ganchos de parte (partFields: o tipo do mestrado, a natureza
 * do livro), com o valor do item como está: chave "FILHO@ATRIBUTO" e os campos
 * a mais (also) com o valor de agora. Campos virtuais (datas:1) ficam de fora.
 */
function partMaps(t: ProductionTarget, item: XElement) {
  const fields: [string, FieldMap][] = [];
  const also: [string, string][] = [];
  for (const [child, hook] of Object.entries(t.partFields ?? {})) {
    const part = partOf(item, child);
    if (!part) continue;
    const change: Change = {
      element: child,
      fields: part.attrs.map((a) => ({
        after: a.value,
        attr: a.name,
        before: a.value,
        label: a.name,
      })),
      form: '',
      key: '',
      kind: 'alterado',
      path: [],
    };
    const result = hook(change, part, item);
    if ('reason' in result) continue;
    for (const [attr, m] of Object.entries(result.fields)) {
      if (!mapOf(m).field.includes(':')) fields.push([`${child}@${attr}`, mapOf(m)]);
    }
    for (const a of result.also ?? []) also.push([a.field, a.after]);
  }
  return { also, fields };
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
  const parts = partMaps(t, item);
  const controls = [...Object.entries(t.fields), ...parts.fields].map(([key, m]) => {
    const [child, attr] = key.split('@') as [string, string];
    const { field, toForm } = mapOf(m);
    const raw = getAttr(partOf(item, child) ?? element(''), attr) ?? '';
    return h.text(field, (toForm ? toForm(raw) : raw) ?? '');
  });
  // A natureza, que a especificação usa para achar a linha (inferido: um
  // campo de texto com o primeiro valor do tipo, no lugar do rádio).
  if (t.nature && !controls.some((c) => c.includes(`name="${t.nature!.field}"`))) {
    controls.push(h.text(t.nature.field, t.nature.values[0] ?? ''));
  }
  for (const [name, value] of parts.also) {
    if (!controls.some((c) => c.includes(`name="${name}"`))) controls.push(h.hidden(name, value));
  }
  // Os ocultos que a troca da natureza limpa (f_dsc_outra e f_sub_prod da
  // orientação, lidos em 20/10/2026), vazios: o simulado não guarda o subtipo.
  for (const name of t.natureSwap?.clears ?? []) {
    if (!controls.some((c) => c.includes(`name="${name}"`))) controls.push(h.hidden(name, ''));
  }
  // Dois atributos no mesmo campo: o controle sai uma vez só.
  const unique = [...new Set(controls)].join('\n');
  const body = `<form name="${t.form.name}" method="post" action="${t.form.action}">
${unique}
${h.hidden('f_ctr', 'U')}${h.hidden('f_cod', state.code)}${h.hidden('f_seq', req.get('f_seq') ?? '')}${GRID_HIDDEN}
${lookupHidden(state, item, t)}
${h.formButtons(true)}
</form>
${gridScripts(item, t.authors)}
${t.doi?.duplicate ? doiScript(state.code, req.get('f_seq') ?? '') : ''}
${h.formScripts(t.form.name, 'Deseja realmente excluir esta produção?')}`;
  return html(h.page(t.id, body));
}

/** A conferência de DOI duplicado como o check() da página a chama (lida em 20/10/2026). */
const doiScript = (code: string, seq: string) =>
  `<script>\nvar vres = vefificaDoiCadastrado(trim(dc.f_cod_doi.value),"${code}","${seq}")\n</script>`;

/** Os DOIs das produções bibliográficas do simulado, com a sequência de cada uma. */
function doisIn(state: LattesState): { doi: string; seq: string }[] {
  const out: { doi: string; seq: string }[] = [];
  for (const t of PRODUCTION_TARGETS.filter((x) => x.doi)) {
    const key = Object.entries(t.fields).find(([, m]) => mapOf(m).field === 'f_cod_doi')?.[0];
    if (!key) continue;
    const [child, attr] = key.split('@') as [string, string];
    for (const item of itemsOf(state, t)) {
      const doi = getAttr(partOf(item, child) ?? element(''), attr) ?? '';
      if (doi) out.push({ doi, seq: seqOf(item) ?? '' });
    }
  }
  return out;
}

/** pkg_artigo.verifica_doi_duplicado e pkg_artigo.tipodoi, as conferências do DOI. */
const DOI_ROUTES: Routes = {
  'pkg_artigo.tipodoi': (req, state) => {
    const raw = req.get('fcod') ?? '';
    let doi = raw;
    try {
      doi = decodeURIComponent(raw);
    } catch {
      // Um % solto fica como veio.
    }
    return html(state.doiTypes.get(doi) ?? '');
  },
  'pkg_artigo.verifica_doi_duplicado': (req, state) => {
    const doi = (req.get('f_doi') ?? '').toLowerCase();
    const seq = req.get('f_seq') ?? '';
    const dup = doisIn(state).some((d) => d.doi.toLowerCase() === doi && d.seq !== seq);
    return html(`doiDup = ${dup ? 1 : 0};`);
  },
};

function post(req: SimRequest, state: LattesState, t: ProductionTarget): SimResponse {
  const back = h.savedScript(`${t.list.proc}?f_cod=${state.code}`);
  const ctr = req.get('f_ctr');
  if (ctr !== 'U' && ctr !== 'E') return html(back);
  const item = itemsOf(state, t).find((i) => seqOf(i) === req.get('f_seq'));
  if (!item) return html(h.page(t.id, '<p>Registro não encontrado.</p>'));
  // O del() da página: o mesmo formulário com f_ctr=E (seção 15).
  if (ctr === 'E') {
    walk(state.root, (el) => {
      if (el.children.includes(item)) state.remove(el, item);
    });
    state.touch();
    return html(back);
  }
  writeFields(t, item, req);
  writeLookups(state, item, t, req);
  applyGrids(item, req, t.authors);
  state.touch();
  return html(back);
}

/**
 * Os ocultos das buscas (instituição, curso e agência) de um tipo com
 * lookups, como as páginas de orientação e banca os trazem (lidas em
 * 18/10/2026): o código da instituição com a letra (V em f_cod_inst), o do
 * curso sem ela, o nome em f_inst_old e f_curso_old, a agência em f_agencia e
 * no texto f_nme_agencia.
 */
function lookupHidden(state: LattesState, item: XElement, t: ProductionTarget): string {
  const student = t.student
    ? h.hidden(
        'f_id_orientado',
        getAttr(partOf(item, t.student.child) ?? element(''), t.student.idAttr) ?? '',
      ) + h.hidden('f_seq_form_orientado', '')
    : '';
  return student + lookupFields(state, item, t);
}

function lookupFields(state: LattesState, item: XElement, t: ProductionTarget): string {
  const spec = t.lookups;
  if (!spec) return '';
  const part = partOf(item, spec.child) ?? element('');
  const inst = withLetter(state, getAttr(part, spec.institution.code) ?? '');
  const v = inst.startsWith('V');
  let out =
    h.hidden('f_cod_inst', v ? inst : '') +
    h.hidden('f_cod_inst2', v ? '' : inst) +
    h.hidden('f_inst_old', getAttr(part, spec.institution.name) ?? '');
  if (spec.course) {
    const code = getAttr(part, spec.course.code) ?? '';
    const letter = allCourses().find(([value]) => value.trim().slice(1) === code)?.[0][0] ?? 'D';
    out +=
      h.hidden('f_cod_curso', letter === 'V' ? code : '') +
      h.hidden('f_cod_curso2', letter === 'V' ? '' : code) +
      h.hidden('f_curso_old', getAttr(part, spec.course.name) ?? '');
  }
  if (spec.agency) {
    out +=
      h.hidden('f_agencia', getAttr(part, spec.agency.code) ?? '') +
      h.text('f_nme_agencia', getAttr(part, spec.agency.name) ?? '');
  }
  return out;
}

/** Os ocultos das buscas de volta para o XML; o que não chegou fica como está. */
function writeLookups(state: LattesState, item: XElement, t: ProductionTarget, req: SimRequest) {
  const id = req.get('f_id_orientado');
  const holder = t.student && partOf(item, t.student.child);
  if (t.student && holder && id !== null && id !== undefined) setAttr(holder, t.student.idAttr, id);
  const spec = t.lookups;
  const part = spec && partOf(item, spec.child);
  if (!spec || !part) return;
  // O nome sai da lista pelo código (inferido); sem o código na lista, o texto que veio.
  if (req.get('f_cod_inst') !== null) {
    const inst = (req.get('f_cod_inst') || req.get('f_cod_inst2')) ?? '';
    setAttr(part, spec.institution.code, inst.replace(/^[A-Za-z]/, ''));
    const name = institutionsOf(state).find((i) => i.code === inst)?.name;
    setAttr(part, spec.institution.name, name ?? req.get('f_inst_old') ?? '');
  }
  if (spec.course && req.get('f_cod_curso') !== null) {
    const code = (req.get('f_cod_curso') || req.get('f_cod_curso2')) ?? '';
    setAttr(part, spec.course.code, code.trim());
    const name = (req.get('f_curso_old') ?? '').replace(/\s*\([^()]*\)\s*$/, '').trim();
    setAttr(part, spec.course.name, name);
  }
  if (spec.agency && req.get('f_agencia') !== null) {
    const code = req.get('f_agencia') ?? '';
    setAttr(part, spec.agency.code, code);
    const name = AGENCIES.find(([c]) => c === code)?.[1];
    setAttr(part, spec.agency.name, name ?? req.get('f_nme_agencia') ?? '');
  }
}

/** As rotas de cada tipo: a lista (escolhida pelos parâmetros), o formulário e o POST. */
let built: Routes | undefined;

/** As rotas montadas uma vez só (servidor.ts e a rede social de eventos.ts usam as mesmas). */
export function productionRoutes(): Routes {
  built ??= buildRoutes();
  return built;
}

function buildRoutes(): Routes {
  const routes: Routes = { ...DOI_ROUTES };
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
    // O mesmo formulário pode servir a vários tipos (as orientações): vale o
    // tipo do item do f_seq.
    const formKey = t.list.formProc.toLowerCase();
    const sharing = targets.filter((x) => x.list.formProc.toLowerCase() === formKey);
    const targetOf = (req: SimRequest, state: LattesState) =>
      sharing.find((x) => itemsOf(state, x).some((i) => seqOf(i) === req.get('f_seq'))) ?? t;
    routes[formKey] = (req, state) =>
      req.method === 'POST'
        ? post(req, state, targetOf(req, state))
        : form(req, state, targetOf(req, state));
    // O POST costuma ir ao mesmo procedimento do formulário, que já responde aos dois.
    const action = t.form.action.toLowerCase();
    if (action !== formKey) routes[action] = (req, state) => post(req, state, targetOf(req, state));
  }
  return routes;
}

/** Os campos da especificação, do POST de volta para o XML; o que não chegou fica como está. */
export function writeFields(t: ProductionTarget, item: XElement, req: SimRequest): void {
  const write = ([key, m]: [string, FieldMap | string]) => {
    const [child, attr] = key.split('@') as [string, string];
    const map = mapOf(m);
    const value = req.get(map.field);
    if (value === null || value === undefined) return;
    const labels = attr === 'NATUREZA' ? Object.keys(t.lookups?.course?.natures ?? {}) : [];
    const saved = fromForm(child, attr, map, value, labels);
    if (saved === undefined) return;
    let part = partOf(item, child);
    if (!part) {
      part = element(child, {});
      insertInSchemaOrder(lattesSchema, item, part);
    }
    setAttr(part, attr, saved);
  };
  Object.entries(t.fields).forEach(write);
  // Os dos ganchos depois: o código da natureza do livro depende do tipo já gravado.
  partMaps(t, item).fields.forEach(write);
}
