// O que o formulário de patente e registros pede, como a recaptura de
// 15/10/2026 o leu no código das páginas (docs/lattes_internals.md, seção 21):
// o formato das datas, a grade de datas da patente, os campos de data de cada
// tipo e o que o check() de cada tipo exige. Usado por create-registro.ts.

/** DDMMAAAA do XML → dd/mm/aaaa, como check_data() dos formulários exige (seção 21). */
export function formDate(xml: string): string | undefined {
  return /^\d{8}$/.test(xml) ? `${xml.slice(0, 2)}/${xml.slice(2, 4)}/${xml.slice(4)}` : undefined;
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
