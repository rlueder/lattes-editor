// O que as especificações das produções técnicas e artísticas têm em comum:
// as conversões que só elas usam (caixa de marcar, lista cujo valor é o
// próprio texto, data) e os campos que todo formulário desses tipos tem.

import { foldText } from '../../../model/fold-text.ts';
import { formDate } from '../../create-registro-rules.ts';
import { country, language, media, yesNo } from '../mappers.ts';
import type { FieldMap } from '../types.ts';

/** As quatro grades que todo formulário de produção técnica e artística tem no censo. */
export const ALL_GRIDS = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l'] as const;

/**
 * Caixa de marcar com valor S (f_itinerante, f_catalogo, f_inedito). Marcada
 * é SIM; desmarcada vai vazia, como o navegador, que não manda a caixa.
 * Inferido: que o Lattes grave NAO quando a caixa chega vazia.
 */
export const checkbox = (v: string): string | undefined =>
  v === 'SIM' ? 'S' : v === 'NAO' || v === '' ? '' : undefined;

/**
 * Lista cujo valor de cada opção é o próprio rótulo (f_disp, f_unidade,
 * f_tpo_evento): o texto do XML vai com a grafia da opção; fora das opções,
 * fica à mão.
 */
export const oneOf =
  (options: readonly string[]) =>
  (v: string): string | undefined =>
    v ? options.find((o) => foldText(o) === foldText(v)) : '';

/** Data do XML (DDMMAAAA) → dd/mm/aaaa, como o check_data() das páginas (seção 21). */
export const slashDate = (v: string): string | undefined => (v ? formDate(v) : '');

/** Os campos de um filho do item, com a chave "FILHO@ATRIBUTO" que o motor usa. */
export function under(
  child: string,
  map: Record<string, FieldMap | string>,
): Record<string, FieldMap | string> {
  return Object.fromEntries(Object.entries(map).map(([attr, f]) => [`${child}@${attr}`, f]));
}

/**
 * Título, ano, país, idioma, relevância e título em inglês, que todos têm.
 * O nome do atributo do título muda por tipo.
 */
export function basics(title: string, titleEn: string): Record<string, FieldMap | string> {
  return {
    ANO: 'f_ano',
    'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
    IDIOMA: { field: 'F_IDIOMA', toForm: language },
    PAIS: { field: 'f_pais', toForm: country },
    [title]: 'f_titulo',
    [titleEn]: 'f_titulo_en',
  };
}

export const MEDIA: FieldMap = { field: 'f_meio', toForm: media };
export const OUTREACH: FieldMap = { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo };

/**
 * As informações adicionais. f_ref_en está em todos os formulários do censo
 * de 15/10/2026. Inferido: f_ref ("Outras informações", área 3950). A
 * captura de 15/10/2026 não registrou o f_ref em formulário nenhum, mas a
 * recaptura (censo-2026-10-15b.json) o leu no artigo e no programa de
 * computador, e a seção 16 de lattes_internals.md no trabalho técnico; nos
 * formulários daqui ele não foi visto.
 */
export const INFO = under('INFORMACOES-ADICIONAIS', {
  'DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
  'DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
});
