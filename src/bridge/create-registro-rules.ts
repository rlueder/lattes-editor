// O que o formulário de patente e registros pede, como a recaptura de
// 15/10/2026 o leu no código das páginas (docs/lattes_internals.md, seção 21):
// o formato das datas, a grade de datas da patente, os campos de data de cada
// tipo e o que o check() de cada tipo exige, e como achar as linhas e a
// inclusão na lista de cada tipo. Usado por create-registro.ts.

import { foldText } from '../model/fold-text.ts';
import { findLinks, type LattesLink } from './lattes-html.ts';

/**
 * DDMMAAAA do XML → dd/mm/aaaa, como check_data() dos formulários exige (seção
 * 21). Uma data já digitada como dd/mm/aaaa passa como está.
 */
export function formDate(xml: string): string | undefined {
  const value = xml.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`
    : undefined;
}

/**
 * Data do XML → situação da grade de datas da patente (seção 21): o código e o
 * rótulo da opção do combo.
 */
export const PATENT_DATE_CODES: Record<string, [string, string]> = {
  'DATA-DE-CONCESSAO': ['3', 'Concessão'],
  'DATA-DE-PEDIDO-DE-EXAME': ['5', 'Pedido do Exame'],
  'DATA-DEPOSITO-PCT': ['2', 'Depósito PCT'],
  'DATA-PEDIDO-DE-DEPOSITO': ['1', 'Depósito'],
};

/**
 * O atributo do REGISTRO-OU-PATENTE cuja data é a de uma situação do
 * histórico da patente, pela descrição dela (o rótulo da linha da grade de
 * situações, observado em 20/10/2026), sem acento nem caixa.
 */
export function patentDateAttrOf(description: string): string | undefined {
  return Object.entries(PATENT_DATE_CODES).find(
    ([, [, label]]) => foldText(label) === foldText(description),
  )?.[0];
}

/**
 * O f_dados_grid_datas da patente como array2xml("item", "root", …) o monta a
 * partir das linhas {id, contato, endereco} (seção 21), na ordem dada.
 */
export function patentDateGrid(rows: { code: string; date: string; label: string }[]): string {
  const items = rows
    .map(
      (r) =>
        `<item>\n\t<id>${r.code}</id>\n\t<contato>${r.label}</contato>\n\t<endereco>${r.date}</endereco>\n</item >\n`,
    )
    .join('');
  return `<root>${items}</root >`;
}

/** Os campos de data de cada tipo com data em campo de texto (seção 21). */
export const DATE_FIELDS: Record<string, Record<string, string>> = {
  CP: { 'DATA-DE-CONCESSAO': 'f_dta_conc', 'DATA-PEDIDO-DE-DEPOSITO': 'f_dta_dep' },
  CR: { 'DATA-PEDIDO-DE-DEPOSITO': 'f_dta_dep' },
  DI: { 'DATA-DE-CONCESSAO': 'f_dta_conc', 'DATA-PEDIDO-DE-DEPOSITO': 'f_dta_dep' },
};

/** O que o check() de cada tipo exige além de título, número, instituição e país (seção 21). */
export const REQUIRED_BY_TYPE: Record<string, [string, string][]> = {
  DI: [
    ['f_dta_dep', 'a data do registro'],
    ['f_finalidade', 'a finalidade'],
    ['f_inst_financ', 'a instituição financiadora'],
  ],
  MR: [
    ['f_natureza', 'a natureza'],
    ['f_tipo', 'o tipo'],
  ],
  TC: [
    ['f_finalidade', 'a finalidade'],
    ['f_inst_financ', 'a instituição financiadora'],
  ],
};

/**
 * Rótulos dos atributos dos registros nas mensagens de "vai à mão". A mudança
 * nova só lista os atributos do item, não os das partes; os rótulos ficam aqui
 * porque o conector não carrega os do editor (html-text.ts).
 */
export const ATTR_LABELS: Record<string, string> = {
  'ANO-DESENVOLVIMENTO': 'Ano de desenvolvimento',
  'ANO-SOLICITACAO': 'Ano de solicitação',
  'CODIGO-DO-REGISTRO-OU-PATENTE': 'Número do registro',
  DENOMINACAO: 'Denominação',
  'DENOMINACAO-INGLES': 'Denominação em inglês',
  FINALIDADE: 'Finalidade',
  'FINALIDADE-INGLES': 'Finalidade em inglês',
  'FLAG-POTENCIAL-INOVACAO': 'Potencial de inovação',
  'FLAG-RELEVANCIA': 'Relevância',
  'HOME-PAGE': 'Home page',
  'INSTITUICAO-DEPOSITO-REGISTRO': 'Instituição de registro',
  'INSTITUICAO-FINANCIADORA': 'Instituição financiadora',
  NATUREZA: 'Natureza',
  'NOME-DO-DEPOSITANTE': 'Depositante',
  'NOME-DO-TITULAR': 'Titular',
  'NUMERO-DEPOSITO-PCT': 'Número do depósito PCT',
  PAIS: 'País',
  'TIPO-PATENTE': 'Tipo',
  TITULO: 'Título',
  'TITULO-INGLES': 'Título em inglês',
  'TITULO-PATENTE': 'Título da patente',
};

/** Por que o registro criado fica divergente: a grade de inventores não é relida. */
export const INVENTORS_UNREAD =
  'Criado no Lattes, com os campos conferidos; confira a lista de inventores no Lattes, que o conector não relê';

/** Por que a patente vai à mão hoje (seção 22 de docs/lattes_internals.md). */
export const PATENT_BY_HAND =
  'A patente vai à mão: o Lattes exige o titular ou depositante, numa grade cuja linha ainda não foi lida';

// A lista de cada tipo -------------------------------------------------------------

const sameType = (l: LattesLink, tipo: string) =>
  (l.params.f_cod_tipo ?? '').toUpperCase() === tipo;

/**
 * As linhas da lista: links do formulário com f_seq (inferido, como nas outras
 * produções). Sem filtrar pelo f_cod_tipo do link, também inferido: a lista já
 * é a do tipo, e o tipo de cada linha se confere no oculto do formulário.
 */
export const registryRows = (html: string) =>
  findLinks(html, 'PKG_PATENTE_REGISTRO.form').filter((l) => l.params.f_seq);

/**
 * Links do formulário que não são linha nem a inclusão do tipo: linhas num
 * formato que o conector não reconhece. Com elas, a conferência de duplicata
 * não vale, e nada se envia.
 */
export const unknownLinks = (html: string, inclusion: string | undefined) =>
  findLinks(html, 'PKG_PATENTE_REGISTRO.form').filter(
    (l) => !l.params.f_seq && l.path !== inclusion,
  );

/**
 * O formulário de inclusão do tipo. Na patente, a lista abre a janela prévia
 * (infDadPat) e o conector abre o formulário pelo endereço que a janela usa,
 * sem f_ctr=R; nos outros, o link "Incluir novo item" da lista.
 */
export function registryInclusion(listHtml: string, tipo: string, cv: string): string | undefined {
  if (tipo === 'PP') return `pkg_patente_registro.form?f_sta_inovacao=&f_cod=${cv}&f_cod_tipo=PP`;
  return findLinks(listHtml, 'PKG_PATENTE_REGISTRO.form').find(
    (l) => !l.params.f_seq && sameType(l, tipo),
  )?.path;
}

/** A lista do tipo no menu: PKG_PATENTE_REGISTRO.LISTA com o f_cod_tipo. */
export const registryList = (menu: string, tipo: string) =>
  findLinks(menu, 'PKG_PATENTE_REGISTRO.LISTA').find((l) => sameType(l, tipo));
