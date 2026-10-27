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
// o efeito do POST. As datas em campo de texto (cultivares e desenho) são
// dd/mm/aaaa, observado na recaptura de 15/10/2026; a ligação de cada uma com o
// atributo do XML é inferida pelo rótulo.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
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
import { applyRegistryGrids, registryGridScripts } from './registro-grades.ts';
import { html, type SimResponse } from './tipos.ts';

const PATH = ['PRODUCAO-TECNICA'];

/** f_cod_tipo → elemento do XML e rótulo da lista. */
export const REGISTRY_ITEMS: Record<string, [string, string]> = {
  CP: ['CULTIVAR-PROTEGIDA', 'Cultivar protegida'],
  CR: ['CULTIVAR-REGISTRADA', 'Cultivar registrada'],
  DI: ['DESENHO-INDUSTRIAL', 'Desenho industrial'],
  MR: ['MARCA', 'Marca'],
  PC: ['SOFTWARE', 'Programa de computador'],
  TC: ['TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', 'Topografia de circuito integrado'],
};

const BASICS = ['DADOS-BASICOS-'];
const DETAIL = ['DETALHAMENTO-'];
const REGISTRY = ['DETALHAMENTO-', 'REGISTRO-OU-PATENTE'];

function field(entry: string, name: string) {
  const found = capturedForm(entry).fields.find((f) => f.name === name);
  if (!found) throw new Error(`O censo não tem o campo ${name} em ${entry}`);
  return found;
}

/** TIPO-PATENTE da marca pelo código no fim do valor do XSD (MARCA_REGISTRADA_DE_PRODUTO_MPD ↔ MPD). */
const BRAND_TYPES = (
  (lattesSchema.elements['REGISTRO-OU-PATENTE']?.attributes ?? []).find(
    (a) => a.name === 'TIPO-PATENTE',
  )?.enum ?? []
).filter((v) => v.startsWith('MARCA_REGISTRADA_'));
const brandType: Pick<FieldLink, 'toForm' | 'toXml'> = {
  toForm: (xml) => (xml.startsWith('MARCA_REGISTRADA_') ? (xml.split('_').at(-1) ?? '') : ''),
  toXml: (form) => BRAND_TYPES.find((v) => v.endsWith(`_${form}`)) ?? '',
};

/** As ligações campo ↔ atributo de um tipo (inferidas, pelo rótulo do campo). */
function links(tipo: string): Record<string, FieldLink> {
  const entry = `registro-${tipo}`;
  const cultivar = tipo === 'CP' || tipo === 'CR';
  const software = tipo === 'PC';
  const out: Record<string, FieldLink> = {
    f_cod_reg: { attr: 'CODIGO-DO-REGISTRO-OU-PATENTE', under: REGISTRY },
    f_inst: { attr: 'INSTITUICAO-DEPOSITO-REGISTRO', under: REGISTRY },
    f_pais: { attr: 'PAIS', under: BASICS, ...byLabel(field(entry, 'f_pais')) },
    f_sta_inovacao: { attr: 'FLAG-POTENCIAL-INOVACAO', under: BASICS, ...yesNo },
    f_titulo: {
      attr: cultivar ? 'DENOMINACAO' : software ? 'TITULO-DO-SOFTWARE' : 'TITULO',
      under: BASICS,
    },
    f_titulo_en: {
      attr: cultivar
        ? 'DENOMINACAO-INGLES'
        : software
          ? 'TITULO-DO-SOFTWARE-INGLES'
          : 'TITULO-INGLES',
      under: BASICS,
    },
  };
  const form = capturedForm(entry);
  const has = (name: string) => form.fields.some((f) => f.name === name);
  if (has('f_ano')) {
    out.f_ano = {
      attr: cultivar ? 'ANO-SOLICITACAO' : software ? 'ANO' : 'ANO-DESENVOLVIMENTO',
      under: BASICS,
    };
  }
  if (has('f_plataforma')) out.f_plataforma = { attr: 'PLATAFORMA', under: DETAIL };
  if (has('f_finalidade')) out.f_finalidade = { attr: 'FINALIDADE', under: DETAIL };
  if (has('f_inst_financ')) out.f_inst_financ = { attr: 'INSTITUICAO-FINANCIADORA', under: DETAIL };
  // Datas em campo de texto, dd/mm/aaaa (recaptura de 15/10/2026); no XML, DDMMAAAA.
  const date: Pick<FieldLink, 'toForm' | 'toXml'> = {
    toForm: (xml) =>
      /^\d{8}$/.test(xml) ? `${xml.slice(0, 2)}/${xml.slice(2, 4)}/${xml.slice(4)}` : '',
    toXml: (form) => form.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$1$2$3'),
  };
  if (has('f_dta_dep')) {
    out.f_dta_dep = { attr: 'DATA-PEDIDO-DE-DEPOSITO', under: REGISTRY, ...date };
  }
  if (has('f_dta_conc')) out.f_dta_conc = { attr: 'DATA-DE-CONCESSAO', under: REGISTRY, ...date };
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
  return (
    (basics &&
      (getAttr(basics, 'TITULO') ||
        getAttr(basics, 'TITULO-DO-SOFTWARE') ||
        getAttr(basics, 'DENOMINACAO'))) ??
    ''
  );
};

/**
 * Os inventores do f_autores_l: linhas unidas por "@" e valores por "|". O
 * simulado lê só as linhas escolhidas na sugestão (l, c, t, como o autorDP do
 * menu; observado), e grava nome e citação. Como o servidor grava os autores
 * é inferido.
 */
function writeAuthors(item: XElement, grid: string): void {
  grid
    .split('@')
    .filter(Boolean)
    .forEach((row, i) => {
      const [l, c, t] = row.split('|');
      if (!l || c === undefined || !/^\d*$/.test(c)) return;
      insertInSchemaOrder(
        lattesSchema,
        item,
        element('AUTORES', {
          'NOME-COMPLETO-DO-AUTOR': l,
          'NOME-PARA-CITACAO': t ?? '',
          'ORDEM-DE-AUTORIA': String(i + 1),
        }),
      );
    });
}

export function registroLista(state: LattesState, tipo: string, reg = ''): SimResponse {
  const [, label] = REGISTRY_ITEMS[tipo]!;
  const rows = registros(state, tipo)
    .map(
      (r) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_PATENTE_REGISTRO.form?f_cod=${state.code}&amp;f_cod_tipo=${tipo}&amp;f_seq=${getAttr(r, 'SEQUENCIA-PRODUCAO')}',true); return false;">${h.esc(titleOf(r))}</a></td></tr>`,
    )
    .join('\n');
  // O link de inclusão com os parâmetros da seção 17 (f_reg,
  // F_STA_DIVULGACAO_CIENTIFICA, f_cod, f_cod_tipo); a ordem deles é inferida.
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_PATENTE_REGISTRO.form?f_reg=${reg}&amp;F_STA_DIVULGACAO_CIENTIFICA=&amp;f_cod=${state.code}&amp;f_cod_tipo=${tipo}',true); return false;">Incluir novo item</a>`;
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
  // A página que tira o ano da data do registro antes de enviar (lido em
  // 19/10/2026): o desenho industrial e a cultivar protegida.
  const derived =
    item && DERIVED_YEAR.has(tipo) ? '<script>\n dc.f_ano.value = anoDep;\n</script>' : '';
  const grids = item ? registryGridScripts(item, { withHolders: HOLDER_TYPES.has(tipo) }) : '';
  const programs = item && tipo === 'PC' ? programScripts(item) : '';
  return html(
    h.page(
      label,
      `${renderCensusForm(screen(tipo), item, hidden, state)}\n${grids}${programs}${derived}`,
    ),
  );
}

/** Alguns tipos de programa do programaDP real (lido em 27/10/2026). */
const PROGRAM_TYPES = ['Aplicativos', 'Automação bancária', 'Utilitários'];

const softwareDetail = (item: XElement) =>
  childElements(item).find((c) => c.name === 'DETALHAMENTO-DO-SOFTWARE');

/**
 * Os vetores do ambiente do programa de computador: programaDP, a lista, e
 * programaProvider, as linhas do item, com a linha vazia do fim, como a
 * página. O AMBIENTE do XML une os c por "|" (exportação de 27/10/2026).
 */
function programScripts(item: XElement): string {
  const dp = PROGRAM_TYPES.map((c) => ({ c, l: c, n: '1' }));
  const ambiente = (softwareDetail(item) && getAttr(softwareDetail(item)!, 'AMBIENTE')) ?? '';
  const rows = ambiente
    .split('|')
    .filter(Boolean)
    .map((c) => ({ c, l: c, n: '1' }));
  return `<script>\nvar programaDP = ${JSON.stringify(dp)};\nprogramaProvider = \n${JSON.stringify([...rows, {}])};\n</script>`;
}

/** Os tipos com grade de depositantes ou titulares na página (marca e topografia não têm). */
const HOLDER_TYPES = new Set(['CP', 'CR', 'DI', 'PC']);

/** Os tipos em que o check() põe em f_ano o ano de f_dta_dep. */
const DERIVED_YEAR = new Set(['CP', 'DI']);

export function registroPost(req: SimRequest, state: LattesState, tipo: string): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=${tipo}&f_cod=${state.code}`);
  if (ctr === 'I') {
    state.nextProduction += 1;
    const item = element(REGISTRY_ITEMS[tipo]![0], {
      'SEQUENCIA-PRODUCAO': String(state.nextProduction),
    });
    applyCensusForm(screen(tipo), item, req, state);
    writeAuthors(item, req.get('f_autores_l') ?? '');
    insertInSchemaOrder(lattesSchema, state.ensurePath(PATH), item);
    state.touch();
    return html(back);
  }
  const item = registros(state, tipo).find(
    (r) => getAttr(r, 'SEQUENCIA-PRODUCAO') === req.get('f_seq'),
  );
  if (!item) return html(h.page(REGISTRY_ITEMS[tipo]![1], '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(PATH)!, item);
  else if (ctr === 'U') {
    // Sem o ano que o check() tira da data, o Lattes não grava nada (19/10/2026).
    if (DERIVED_YEAR.has(tipo) && !req.get('f_ano')) return html(back);
    applyCensusForm(screen(tipo), item, req, state);
    applyRegistryGrids(item, req, { withHolders: HOLDER_TYPES.has(tipo) });
    const detail = tipo === 'PC' ? softwareDetail(item) : undefined;
    const ambiente = req.get('f_ambiente');
    if (detail && ambiente !== null && ambiente !== undefined)
      setAttr(detail, 'AMBIENTE', ambiente);
  } else return html(back);
  state.touch();
  return html(back);
}
