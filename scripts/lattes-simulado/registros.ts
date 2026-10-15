// Os registros de Patentes e Registros no Lattes simulado, menos a patente
// (patente.ts): cultivar protegida (CP), cultivar registrada (CR), desenho
// industrial (DI), marca (MR) e topografia de circuito integrado (TC). Todos
// são PKG_PATENTE_REGISTRO.form com f_cod_tipo, POST para
// PKG_PATENTE_REGISTRO.FORM (docs/lattes_internals.md, seção 17).
//
// Observados (censo de 15/10/2026): os campos de cada formulário, com tipo,
// limite e opções, os ocultos e o nome do formulário, que formulario-censo.ts
// lê da captura; os parâmetros do link de inclusão das listas (seção 17).
// Inferidos: as listas dos outros tipos no menu e o link de
// inclusão delas, o link de cada linha (com f_seq), a ligação de cada campo
// com o atributo do XML (nenhum item desses no currículo de quem capturou) e
// o efeito do POST. As datas não são ligadas: o formato que o formulário
// espera não foi observado, e o conector não as manda.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import {
  applyCensusForm,
  byLabel,
  capturedForm,
  type CensusScreen,
  type FieldLink,
  renderCensusForm,
  yesNo,
} from './formulario-censo.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type SimResponse } from './tipos.ts';

const PATH = ['PRODUCAO-TECNICA'];

/** f_cod_tipo → elemento do XML e rótulo da lista. */
export const REGISTRY_ITEMS: Record<string, [string, string]> = {
  CP: ['CULTIVAR-PROTEGIDA', 'Cultivar protegida'],
  CR: ['CULTIVAR-REGISTRADA', 'Cultivar registrada'],
  DI: ['DESENHO-INDUSTRIAL', 'Desenho industrial'],
  MR: ['MARCA', 'Marca'],
  TC: ['TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', 'Topografia de circuito integrado'],
};

const BASICS = ['DADOS-BASICOS-'];
const DETAIL = ['DETALHAMENTO-'];
const REGISTRY = ['DETALHAMENTO-', 'REGISTRO-OU-PATENTE'];

const field = (entry: string, name: string) =>
  capturedForm(entry).fields.find((f) => f.name === name)!;

/** TIPO-PATENTE da marca pelo código no fim do valor do XSD (MARCA_REGISTRADA_DE_PRODUTO_MPD ↔ MPD). */
const BRAND_TYPES = (lattesSchema.elements['REGISTRO-OU-PATENTE']?.attributes ?? [])
  .find((a) => a.name === 'TIPO-PATENTE')!
  .enum!.filter((v) => v.startsWith('MARCA_REGISTRADA_'));
const brandType: Pick<FieldLink, 'toForm' | 'toXml'> = {
  toForm: (xml) => (xml.startsWith('MARCA_REGISTRADA_') ? (xml.split('_').at(-1) ?? '') : ''),
  toXml: (form) => BRAND_TYPES.find((v) => v.endsWith(`_${form}`)) ?? '',
};

/** As ligações campo ↔ atributo de um tipo (inferidas, pelo rótulo do campo). */
function links(tipo: string): Record<string, FieldLink> {
  const entry = `registro-${tipo}`;
  const cultivar = tipo === 'CP' || tipo === 'CR';
  const out: Record<string, FieldLink> = {
    f_cod_reg: { attr: 'CODIGO-DO-REGISTRO-OU-PATENTE', under: REGISTRY },
    f_inst: { attr: 'INSTITUICAO-DEPOSITO-REGISTRO', under: REGISTRY },
    f_pais: { attr: 'PAIS', under: BASICS, ...byLabel(field(entry, 'f_pais')) },
    f_sta_inovacao: { attr: 'FLAG-POTENCIAL-INOVACAO', under: BASICS, ...yesNo },
    f_titulo: { attr: cultivar ? 'DENOMINACAO' : 'TITULO', under: BASICS },
    f_titulo_en: { attr: cultivar ? 'DENOMINACAO-INGLES' : 'TITULO-INGLES', under: BASICS },
  };
  const form = capturedForm(entry);
  const has = (name: string) => form.fields.some((f) => f.name === name);
  if (has('f_ano')) {
    out.f_ano = { attr: cultivar ? 'ANO-SOLICITACAO' : 'ANO-DESENVOLVIMENTO', under: BASICS };
  }
  if (has('f_finalidade')) out.f_finalidade = { attr: 'FINALIDADE', under: DETAIL };
  if (has('f_inst_financ')) out.f_inst_financ = { attr: 'INSTITUICAO-FINANCIADORA', under: DETAIL };
  if (tipo === 'MR') {
    out.f_tipo = { attr: 'TIPO-PATENTE', under: REGISTRY, ...brandType };
    out.f_natureza = { attr: 'NATUREZA', under: DETAIL };
  }
  return out;
}

const screen = (tipo: string): CensusScreen => ({ entry: `registro-${tipo}`, links: links(tipo) });

export function registros(state: LattesState, tipo: string): XElement[] {
  const container = state.find(PATH);
  const name = REGISTRY_ITEMS[tipo]?.[0];
  return container && name ? childElements(container, name) : [];
}

const titleOf = (item: XElement) => {
  const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS-'));
  return (basics && (getAttr(basics, 'TITULO') || getAttr(basics, 'DENOMINACAO'))) ?? '';
};

export function registroLista(state: LattesState, tipo: string): SimResponse {
  const [, label] = REGISTRY_ITEMS[tipo]!;
  const rows = registros(state, tipo)
    .map(
      (r) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_PATENTE_REGISTRO.form?f_cod=${state.code}&amp;f_cod_tipo=${tipo}&amp;f_seq=${getAttr(r, 'SEQUENCIA-PRODUCAO')}',true); return false;">${h.esc(titleOf(r))}</a></td></tr>`,
    )
    .join('\n');
  // O link de inclusão com os parâmetros da seção 17 (f_reg,
  // F_STA_DIVULGACAO_CIENTIFICA, f_cod, f_cod_tipo); a ordem deles é inferida.
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_PATENTE_REGISTRO.form?f_reg=&amp;F_STA_DIVULGACAO_CIENTIFICA=&amp;f_cod=${state.code}&amp;f_cod_tipo=${tipo}',true); return false;">Incluir novo item</a>`;
  return html(
    h.page(
      label,
      `${rows ? `<table>${rows}</table>` : '<p>Nenhum registro cadastrado</p>'}\n<p>${novo}</p>`,
    ),
  );
}

export function registroForm(req: SimRequest, state: LattesState, tipo: string): SimResponse {
  const [, label] = REGISTRY_ITEMS[tipo]!;
  const seq = req.get('f_seq');
  const item = seq
    ? registros(state, tipo).find((r) => getAttr(r, 'SEQUENCIA-PRODUCAO') === seq)
    : undefined;
  if (seq && !item) return html(h.page(label, '<p>Registro não encontrado.</p>'));
  const hidden = {
    f_cod: state.code,
    f_cod_tipo: tipo,
    f_ctr: item ? 'U' : 'I',
    f_seq: seq ?? '',
  };
  return html(h.page(label, renderCensusForm(screen(tipo), item, hidden, state)));
}

export function registroPost(req: SimRequest, state: LattesState, tipo: string): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=${tipo}&f_cod=${state.code}`);
  if (ctr === 'I') {
    state.nextProduction += 1;
    const item = element(REGISTRY_ITEMS[tipo]![0], {
      'SEQUENCIA-PRODUCAO': String(state.nextProduction),
    });
    applyCensusForm(screen(tipo), item, req, state);
    insertInSchemaOrder(lattesSchema, state.ensurePath(PATH), item);
    state.touch();
    return html(back);
  }
  const item = registros(state, tipo).find(
    (r) => getAttr(r, 'SEQUENCIA-PRODUCAO') === req.get('f_seq'),
  );
  if (!item) return html(h.page(REGISTRY_ITEMS[tipo]![1], '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(PATH)!, item);
  else if (ctr === 'U') applyCensusForm(screen(tipo), item, req, state);
  else return html(back);
  state.touch();
  return html(back);
}
