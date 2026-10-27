// Patente no Lattes simulado (docs/lattes_internals.md, seção 17), com a
// inclusão em dois passos: a janela prévia "Incluir nova patente"
// (pkg_patente_registro.informar_dados_patente, formulário fDatpat), que
// pergunta ao servidor se o número já existe (POST
// pkg_patente_registro.verifica_cadastrado) e abre o formulário com f_ctr=R;
// depois, o formulário postado para PKG_PATENTE_REGISTRO.FORM.
//
// Observados: a janela prévia, seus campos e o combo de escritórios, o
// endereço e os parâmetros da consulta e do formulário, os campos do
// formulário. Inferidos: a resposta da consulta além de "1" (já existe), o
// preenchimento de f_inst e f_cod_reg pelo f_ctr=R (o GET sem ele veio com os
// dois vazios), o link de cada linha da lista, a correspondência dos campos
// com o XML e o efeito do POST. O nome do formulário, PKG_PATENTE_REGISTRO,
// veio do censo de 15/10/2026. Os outros registros (f_cod_tipo CP, CR, DI, MR,
// TC) passam pelos mesmos procedimentos e ficam em registros.ts.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { applyFields, type Binding, fixed, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { applyRegistryGrids, registryGridScripts } from './registro-grades.ts';
import { registroForm, registroLista, registroPost, REGISTRY_ITEMS } from './registros.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const PATH = ['PRODUCAO-TECNICA'];

/** Os escritórios do combo escolhe_inst() (observados). */
export const OFFICES = [
  'INPI - Instituto Nacional da Propriedade Industrial',
  'Canadian Intellectual Property Office',
  'German Patent and Trademark Office',
  'Institut National de la Propriete Industrielle',
  'Japanese Patent Office',
  'Oficina de Armonización del Mercado Interior',
  'Oficina Española de Patentes y Marcas',
  'Swiss Federal Institute of Intellectual Property',
  'UK Patent Office',
  'United States Patent and Trademark Office',
  'WIPO',
];

type Part = 'basics' | 'detail' | 'registro';

/** A parte do item para ler (sem mudar nada) ou para gravar (criando). */
function part(item: XElement, which: Part, create: boolean): XElement {
  const names = { basics: 'DADOS-BASICOS-DA-PATENTE', detail: 'DETALHAMENTO-DA-PATENTE' };
  const parent = which === 'registro' ? part(item, 'detail', create) : item;
  const name = which === 'registro' ? 'REGISTRO-OU-PATENTE' : names[which];
  let el = childElements(parent, name)[0];
  if (!el) {
    el = element(name);
    if (create) insertInSchemaOrder(lattesSchema, parent, el);
  }
  return el;
}

function on(
  which: Part,
  name: string,
  attrName: string,
  kind: Binding['kind'],
  extra: Partial<Binding> = {},
): Binding {
  return {
    kind,
    name,
    read: (item) => getAttr(part(item, which, false), attrName) ?? '',
    write: (item, value) => setAttr(part(item, which, true), attrName, value),
    ...extra,
  };
}

function patentes(state: LattesState): XElement[] {
  const container = state.find(PATH);
  return container ? childElements(container, 'PATENTE') : [];
}

const bySeq = (state: LattesState, seq: string | undefined) =>
  patentes(state).find((p) => getAttr(p, 'SEQUENCIA-PRODUCAO') === seq);

function bindings(state: LattesState, ids: Record<string, string>): Binding[] {
  const none = (name: string, kind: Binding['kind'] = 'hidden', max?: number): Binding => ({
    kind,
    maxLength: max,
    name,
    read: () => '',
  });
  const prefill = (name: string, b: Binding): Binding =>
    ids[name] === undefined ? b : { ...b, read: (el) => (el.name ? b.read(el) : ids[name]!) };
  return [
    on('detail', 'f_natureza', 'CATEGORIA', 'radio', {
      options: ['Produto', 'Processo', 'Produto e Processo', 'Outra'].map((v) => [v, v]),
    }),
    prefill(
      'f_cod_reg',
      on('registro', 'f_cod_reg', 'CODIGO-DO-REGISTRO-OU-PATENTE', 'text', { maxLength: 16 }),
    ),
    prefill(
      'f_inst',
      on('registro', 'f_inst', 'INSTITUICAO-DEPOSITO-REGISTRO', 'text', { maxLength: 75 }),
    ),
    on('basics', 'f_pais', 'PAIS', 'select', {
      options: [['', ''], ...h.COUNTRIES],
      read: (item) => h.countryCode(getAttr(part(item, 'basics', false), 'PAIS')),
      write: (item, value) => setAttr(part(item, 'basics', true), 'PAIS', h.countryName(value)),
    }),
    on('registro', 'f_tipo', 'TIPO-PATENTE', 'radio', {
      options: [
        ['PI', 'Patente de Invenção'],
        ['MU', 'Patente de Modelo de Utilidade'],
      ],
    }),
    on('basics', 'f_titulo', 'TITULO', 'text', { maxLength: 400 }),
    on('registro', 'f_nro_deposito_pct', 'NUMERO-DEPOSITO-PCT', 'text', { maxLength: 16 }),
    on('basics', 'f_sta_inovacao', 'FLAG-POTENCIAL-INOVACAO', 'radio', {
      options: [
        ['S', 'Sim'],
        ['N', 'Não'],
      ],
      read: (item) =>
        ({ NAO: 'N', SIM: 'S' })[
          getAttr(part(item, 'basics', false), 'FLAG-POTENCIAL-INOVACAO') ?? ''
        ] ?? '',
      write: (item, value) =>
        setAttr(
          part(item, 'basics', true),
          'FLAG-POTENCIAL-INOVACAO',
          value === 'S' ? 'SIM' : value === 'N' ? 'NAO' : '',
        ),
    }),
    none('f_txt_potencial', 'text', 400),
    { ...none('f_ref', 'textarea', 3950) },
    { ...none('f_ref_en', 'textarea', 3800) },
    on('basics', 'f_home_page', 'HOME-PAGE', 'text', { maxLength: 255 }),
    on('detail', 'f_finalidade', 'FINALIDADE', 'text', { maxLength: 255 }),
    on('detail', 'f_inst_financ', 'INSTITUICAO-FINANCIADORA', 'textarea', { maxLength: 380 }),
    on('basics', 'f_titulo_en', 'TITULO-INGLES', 'text', { maxLength: 400 }),
    {
      kind: 'select',
      name: 'f_tipo_privacidade',
      options: h.PRIVACY,
      read: (el) => state.privacy.get(el) ?? '1',
      write: (el, value) => state.privacy.set(el, value || '1'),
    },
    none('f_dados_grid_datas'),
    // O ano, oculto, que o check() tira da data de depósito (lido em 19/10/2026).
    on('basics', 'f_ano', 'ANO-DESENVOLVIMENTO', 'hidden'),
    ...[
      'F_COD_PROD',
      'f_sta_validado',
      'f_sta_validado_mapa',
      'f_origem',
      'f_dta_dep',
      'f_dta_dep_pct',
      'f_dta_conc',
      'f_dta_exp',
      'f_autores_l',
      'f_plv_l',
      'f_setor_l',
      'f_area_l',
      'f_depositante_pessoa_l',
      'f_depositante_inst_l',
    ].map((n) => none(n)),
    fixed('f_ctr', ids.f_ctr ?? 'I'),
    fixed('f_cod', state.code),
    fixed('f_seq', ids.f_seq ?? ''),
    fixed('f_cod_tipo', 'PP'),
  ];
}

function lista(state: LattesState): SimResponse {
  const rows = patentes(state)
    .map(
      (p) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_PATENTE_REGISTRO.form?f_cod=${state.code}&amp;f_cod_tipo=PP&amp;f_seq=${getAttr(p, 'SEQUENCIA-PRODUCAO')}',true); return false;">${h.esc(getAttr(part(p, 'basics', false), 'TITULO') ?? '')}</a></td></tr>`,
    )
    .join('\n');
  // "Incluir novo item" chama infDadPat(), que abre a janela prévia (observado).
  const novo = `<a href="#" onclick="infDadPat(); return false;">Incluir novo item</a>
<script>function infDadPat(){ self.parent.modalCV2.setarUrl('pkg_patente_registro.informar_dados_patente?ftipo=PP', true); }</script>`;
  return html(
    h.page(
      'Patentes',
      `${rows ? `<table>${rows}</table>` : '<p>Nenhum registro cadastrado</p>'}\n<p>${novo}</p>`,
    ),
  );
}

function prior(state: LattesState): SimResponse {
  const options = OFFICES.map((o) => `<option value="${h.esc(o)}">${h.esc(o)}</option>`).join('');
  const body = `<form name="fDatpat">
<p><select onchange="escolhe_inst(this.value)"><option value=""></option>${options}<option value="OUTRA">Outra (especifique)</option></select></p>
<p>${h.text('f_inst', '', { maxLength: 75 })}</p>
<p>${h.text('f_cod_reg', '', { maxLength: 16 })}</p>
<p><a href="#" onclick="handlePatenteSubmit(); return false;">Confirmar</a></p>
</form>
<script>var f = document.forms['fDatpat'];
function escolhe_inst(v){ f.f_inst.value = v == 'OUTRA' ? '' : v; f.f_inst.readOnly = v != 'OUTRA'; }
function handlePatenteSubmit(){
  if (!f.f_inst.value || !f.f_cod_reg.value) { alert('Informe a instituição e o número.'); return; }
  if (/^INPI/.test(f.f_inst.value) && !/^(PI|MU|BR)\\d+$/.test(f.f_cod_reg.value)) { alert('Número inválido.'); return; }
  var x = new XMLHttpRequest(); x.open('POST', 'pkg_patente_registro.verifica_cadastrado', false);
  x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  x.send('f_pi=' + encodeURIComponent(f.f_cod_reg.value) + '&f_cod=${state.code}&f_inst=' + encodeURIComponent(f.f_inst.value));
  if (x.responseText.trim() == '1') { alert('Esta patente já está cadastrada.'); return; }
  self.parent.modalCV2.setarUrl('pkg_patente_registro.form?f_sta_inovacao=&f_cod=${state.code}&f_cod_tipo=PP&f_inst=' + encodeURIComponent(f.f_inst.value) + '&f_cod_reg=' + encodeURIComponent(f.f_cod_reg.value) + '&f_ctr=R', true);
}</script>`;
  return html(h.page('Incluir nova patente', body));
}

/** "1" quando o número já está cadastrado (observado no código); "0" no resto (inferido). */
function verify(req: SimRequest, state: LattesState): SimResponse {
  const number = req.get('f_pi') ?? '';
  const exists = patentes(state).some(
    (p) => getAttr(part(p, 'registro', false), 'CODIGO-DO-REGISTRO-OU-PATENTE') === number,
  );
  return { contentType: 'text/plain', html: exists ? '1' : '0' };
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const item = seq ? bySeq(state, seq) : undefined;
  if (seq && !item) return html(h.page('Patente', '<p>Registro não encontrado.</p>'));
  const ids: Record<string, string> = { f_ctr: item ? 'U' : 'I', f_seq: seq ?? '' };
  if (!item && req.get('f_ctr') === 'R') {
    ids.f_inst = req.get('f_inst') ?? '';
    ids.f_cod_reg = req.get('f_cod_reg') ?? '';
  }
  // Sem item, os campos leem de um elemento vazio, e só os da janela prévia têm valor.
  const body = `<form name="PKG_PATENTE_REGISTRO" method="post" action="PKG_PATENTE_REGISTRO.FORM">
${renderFields(bindings(state, ids), item ?? element(''))}
${h.formButtons(Boolean(item))}
</form>
${item ? registryGridScripts(item, { dates: true }) : ''}
<script>var dc = document.forms[0]; function enviar(){ dc.submit(); }${item ? " function del(){ if (confirm('Deseja realmente excluir esta produção?')) { dc.f_ctr.value = 'E'; enviar(); } }" : ''}</script>`;
  return html(h.page('Patente', body));
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PP&f_cod=${state.code}`);
  if (ctr === 'I') {
    state.nextProduction += 1;
    const item = element('PATENTE', { 'SEQUENCIA-PRODUCAO': String(state.nextProduction) });
    applyFields(bindings(state, {}), item, req);
    insertInSchemaOrder(lattesSchema, state.ensurePath(PATH), item);
    // As grades, as datas e os depositantes, como na alteração (inferido).
    applyRegistryGrids(item, req, { dates: true });
    state.touch();
    return html(back);
  }
  const item = bySeq(state, req.get('f_seq'));
  if (!item) return html(h.page('Patente', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(PATH)!, item);
  else if (ctr === 'U') {
    applyFields(bindings(state, {}), item, req);
    applyRegistryGrids(item, req, { dates: true });
  } else return html(back);
  state.touch();
  return html(back);
}

/** O f_cod_tipo de um registro que não é a patente, ou undefined. */
function registryType(req: SimRequest): string | undefined {
  const tipo = (req.get('f_cod_tipo') ?? '').toUpperCase();
  return REGISTRY_ITEMS[tipo] ? tipo : undefined;
}

export const PATENTE_ROUTES: Routes = {
  'pkg_patente_registro.form': (req, state) => {
    const tipo = registryType(req);
    if (tipo) {
      return req.method === 'POST'
        ? registroPost(req, state, tipo)
        : registroForm(req, state, tipo);
    }
    return req.method === 'POST' ? post(req, state) : form(req, state);
  },
  'pkg_patente_registro.informar_dados_patente': (_req, state) => prior(state),
  'pkg_patente_registro.lista': (req, state) => {
    const tipo = registryType(req);
    // A lista do programa sem registro (f_reg=N) inclui com o mesmo f_reg (27/10/2026).
    return tipo ? registroLista(state, tipo, req.get('f_reg') ?? '') : lista(state);
  },
  'pkg_patente_registro.verifica_cadastrado': verify,
};
