// As licenças no Lattes simulado: a lista pkg_licenca.lista e o formulário
// GN_LICENCA, postado para PKG_LICENCA.FORM com f_ctr I, U ou E. Os campos são
// os da captura de 13/10/2026 (seção 21): o tipo (lista L23), as datas de
// início e fim e a data de nascimento ou adoção, que a exportação traz em
// DATA-NASCIMENTO-ADOCAO (vista em 29/10/2026). As datas vão em dd/mm/aaaa e
// o XML as guarda em DDMMAAAA. O f_seq é um id do simulado.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const TYPES: Record<string, string> = { A: 'ADOCAO', M: 'MATERNIDADE', P: 'PATERNIDADE' };

const licencas = (state: LattesState) => {
  const box = state.find(['DADOS-GERAIS', 'LICENCAS']);
  return box ? childElements(box, 'LICENCA') : [];
};

const toForm = (xml: string) =>
  /^\d{8}$/.test(xml) ? `${xml.slice(0, 2)}/${xml.slice(2, 4)}/${xml.slice(4)}` : xml;
const toXml = (form: string) => form.replace(/\//g, '');

function lista(state: LattesState): SimResponse {
  const rows = licencas(state)
    .map(
      (el) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_licenca.form?f_cod=${state.code}&amp;f_seq=${state.idOf(el)}',true); return false;">${h.esc(getAttr(el, 'TIPO-LICENCA') ?? '')} ${h.esc(toForm(getAttr(el, 'DATA-INICIO-LICENCA') ?? ''))}</a></td></tr>`,
    )
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_licenca.form?f_cod=${state.code}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Licenças', `<table>${rows}</table>\n<p>${novo}</p>`));
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const el = seq ? licencas(state).find((l) => state.idOf(l) === seq) : undefined;
  if (seq && !el) return html(h.page('Licenças', '<p>Registro não encontrado.</p>'));
  const type = Object.entries(TYPES).find(
    ([, x]) => x === getAttr(el ?? element(''), 'TIPO-LICENCA'),
  );
  const value = (attr: string) => (el ? toForm(getAttr(el, attr) ?? '') : '');
  const body = `<form name="GN_LICENCA" method="post" action="PKG_LICENCA.FORM">
<p>${h.select('f_tipo_licenca', h.capturedList('L23'), type?.[0] ?? '')}</p>
<p>${h.text('f_dta_inicio', value('DATA-INICIO-LICENCA'), { maxLength: 10 })}</p>
<p>${h.text('f_dta_fim', value('DATA-FIM-LICENCA'), { maxLength: 10 })}</p>
<p>${h.text('f_dta_nasc_adoc', value('DATA-NASCIMENTO-ADOCAO'), { maxLength: 10 })}</p>
<p>${h.select('f_tipo_privacidade', h.PRIVACY, '1')}</p>
${h.hidden('f_ctr', el ? 'U' : 'I')}${h.hidden('f_cod', state.code)}${h.hidden('f_seq', seq ?? '')}
${h.formButtons(Boolean(el))}
</form>
${h.formScripts('GN_LICENCA', el ? 'Deseja realmente excluir esta licença?' : undefined)}`;
  return html(h.page('Licenças', body));
}

function write(el: XElement, req: SimRequest): void {
  setAttr(el, 'TIPO-LICENCA', TYPES[req.get('f_tipo_licenca') ?? ''] ?? '');
  setAttr(el, 'FORMATO-DATA-INICIO-LICENCA', 'DDMMAAAA');
  setAttr(el, 'DATA-INICIO-LICENCA', toXml(req.get('f_dta_inicio') ?? ''));
  setAttr(el, 'FORMATO-DATA-FIM-LICENCA', 'DDMMAAAA');
  setAttr(el, 'DATA-FIM-LICENCA', toXml(req.get('f_dta_fim') ?? ''));
  setAttr(el, 'DATA-NASCIMENTO-ADOCAO', toXml(req.get('f_dta_nasc_adoc') ?? ''));
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`pkg_licenca.lista?f_cod=${state.code}`);
  // O check() exige o tipo, as datas e a de nascimento ou adoção (seção 21).
  const missing = ['f_tipo_licenca', 'f_dta_inicio', 'f_dta_fim', 'f_dta_nasc_adoc'].some(
    (n) => !req.get(n),
  );
  if (ctr === 'I') {
    if (missing) return html('<script>alert("Preencha os campos obrigatórios.");</script>');
    const box = state.ensurePath(['DADOS-GERAIS', 'LICENCAS']);
    const el = element('LICENCA', {});
    insertInSchemaOrder(lattesSchema, box, el);
    box.selfClosing = false;
    write(el, req);
    state.touch();
    return html(back);
  }
  const el = licencas(state).find((l) => state.idOf(l) === req.get('f_seq'));
  if (!el) return html(h.page('Licenças', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(['DADOS-GERAIS', 'LICENCAS'])!, el);
  else if (ctr === 'U' && !missing) write(el, req);
  else return html(back);
  state.touch();
  return html(back);
}

export const LICENCAS_ROUTES: Routes = {
  'pkg_licenca.form': (req, state) => (req.method === 'POST' ? post(req, state) : form(req, state)),
  'pkg_licenca.lista': (_req, state) => lista(state),
};
