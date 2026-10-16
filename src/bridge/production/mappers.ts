// Conversões de valor do XML para o formulário do Lattes, comuns a vários
// tipos de produção. Fonte: as opções capturadas no censo de 15/10/2026
// (docs/lattes-formularios/), ligadas ao enumerado do XML pelo rótulo
// (inferido onde o censo não tinha um item de cada valor).

import { foldText } from '../../model/fold-text.ts';
import { formDate } from '../create-registro-rules.ts';
import { countryCode } from '../edit-items.ts';
import idiomas from './idiomas-lattes.json' with { type: 'json' };

/** Rádio S/N (F_RELEV, F_STA_DIVULGACAO_CIENTIFICA); vazio não vai (o rádio não desmarca). */
export const yesNo = (v: string): string | undefined =>
  v === 'SIM' ? 'S' : v === 'NAO' ? 'N' : undefined;

/** País do XML (o nome) → código do f_pais. */
export const country = (v: string): string | undefined => (v ? countryCode(v) : '');

const LANGUAGES = new Map(
  Object.entries(idiomas as Record<string, string>).map(([label, code]) => [foldText(label), code]),
);

/** Idioma do XML (o nome) → código do F_IDIOMA (lista f_idioma do censo, 152 idiomas). */
export const language = (v: string): string | undefined => (v ? LANGUAGES.get(foldText(v)) : '');

/**
 * MEIO-DE-DIVULGACAO → f_meio (opções I, M, D, F, H, O, V do censo). WEB não
 * tem opção no formulário; NAO_INFORMADO é a opção vazia.
 */
const MEDIA: Record<string, string> = {
  FILME: 'F',
  HIPERTEXTO: 'H',
  IMPRESSO: 'I',
  MEIO_DIGITAL: 'D',
  MEIO_MAGNETICO: 'M',
  NAO_INFORMADO: '',
  OUTRO: 'O',
  VARIOS: 'V',
};
export const media = (v: string): string | undefined => (v ? MEDIA[v] : '');

/** Um enumerado do XML → valor da opção, por uma tabela; fora da tabela, à mão. */
export const byTable =
  (table: Record<string, string>) =>
  (v: string): string | undefined =>
    v ? table[v] : '';

/**
 * Data do XML (DDMMAAAA) → dd/mm/aaaa, como o check_data() dos formulários
 * pede (seção 21 de lattes_internals.md); fora desse formato, à mão.
 */
export const date = (v: string): string | undefined => (v ? formDate(v) : '');
