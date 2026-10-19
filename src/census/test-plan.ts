// O plano dos itens de teste da passada completa (docs/lattes-formularios/
// itens-de-teste.md): um item por opção de cada escolha pequena de cada
// formulário de inclusão, com valores marcados em todo campo de texto. Lidos
// de volta na edição e na exportação, os marcadores dizem que campo grava
// que atributo, e as variantes, que opção vira que valor do XML.
//
// Só o plano e os valores; quem abre e envia os formulários é a página
// (extension/src/censo-test-items.ts), e só quando a pessoa roda.

import type { CensusEntry, CensusFile } from './run.ts';

/** O começo de todo texto de teste: é por ele que a remoção acha os itens. */
export const TEST_MARK = 'TESTE EDITOR APAGAR';

/** Listas grandes, que a pessoa escolhe pelo rótulo: um valor só, o do Brasil ou do português. */
export const BIG_LISTS = new Set([
  'F_IDIOMA',
  'F_IDIOMA_OBRA',
  'f_area',
  'f_idioma',
  'f_pais',
  'f_pais_i',
  'f_tipo_privacidade',
  'f_uf',
]);

/**
 * Formulários de registro único ou que dependem de outra tela: fora da
 * passada. O idioma também: a língua é a chave do item, e a variante trocaria
 * o nível de uma língua que a pessoa já tem.
 */
export const NOT_CREATABLE = new Set([
  'areas-de-atuacao',
  'idioma',
  'atividade',
  'endereco',
  'identificacao',
  'linha-de-pesquisa',
  'outras-informacoes',
  // A patente pede um depositante com código de pessoa: só os seus coautores
  // têm, e pôr um deles numa patente de teste poderia pedir validação a ele.
  'patente',
  'patente-janela',
  'prefacio-outras',
  'resumo',
  'vinculo',
]);

/** Escolhas com mais opções que isto não variam (são listas, não naturezas). */
const MAX_VARIED = 40;

export interface TestJob {
  form: string;
  id: string;
  path: string;
  tag: string;
  variant: number;
}

/** Quantas variantes o formulário pede: a maior escolha pequena dele. */
export function variantCount(entry: CensusEntry): number {
  const form = entry.page?.forms[0];
  if (!form) return 0;
  let n = 1;
  for (const f of form.fields) {
    if (f.type !== 'radio' && f.type !== 'select-one') continue;
    if (BIG_LISTS.has(f.name) || !Array.isArray(f.options)) continue;
    const count = f.options.filter((o) => o.value !== '').length;
    if (count > 1 && count <= MAX_VARIED) n = Math.max(n, count);
  }
  return n;
}

/** Todos os itens a criar, na ordem da captura. */
export function testJobs(file: CensusFile): TestJob[] {
  const jobs: TestJob[] = [];
  for (const entry of file.entries) {
    const form = entry.page?.forms[0];
    if (NOT_CREATABLE.has(entry.id) || !form || !entry.path || entry.status !== 'ok') continue;
    for (let variant = 0; variant < variantCount(entry); variant++) {
      jobs.push({
        form: form.name,
        id: entry.id,
        path: entry.path,
        tag: `${entry.id}-v${variant}`,
        variant,
      });
    }
  }
  return jobs;
}

const NUMERIC = /(duracao|pag|^f_num|nro|qtd|volume|^f_vol|carga|fasc|serie|edic)/i;

/** ISSN e ISBN válidos (o check() confere o dígito): os de exemplo das normas. */
export const VALID_ISSN = '0028-0836';
export const VALID_ISBN = '9780306406157';

/** O valor de teste de um campo de texto, dentro do limite dele. */
/** Dígitos estáveis de uma etiqueta (registro-PC-v2), para um número único por item. */
function uniqueDigits(tag: string): string {
  let h = 0;
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) % 1_000_000_007;
  return String(h).padStart(10, '0');
}

export function textValue(name: string, maxLength: number, variant: number, tag: string): string {
  const max = maxLength > 0 ? maxLength : 200;
  // O artigo aceito tem o ano previsto, que não pode ser antes deste.
  const year = tag.startsWith('artigo-aceito')
    ? String(new Date().getFullYear())
    : String(2005 + (variant % 15));
  if (/doi/i.test(name)) return '';
  // O número do registro ou da patente é único por instituição: o marcador
  // cortado em 16 caracteres repetia entre os itens.
  if (/cod_reg/i.test(name)) return `TESTE${uniqueDigits(tag)}`.slice(0, max);
  // Tipo de atividade dos autores (arte "outra"): sem limite na página, 23
  // na coluna (ORA-12899). Só o marcador.
  if (/^f_tpo_ativ$/i.test(name)) return TEST_MARK.slice(0, Math.min(max, 23));
  if (/issn/i.test(name)) return VALID_ISSN.slice(0, max);
  if (/isbn/i.test(name)) return VALID_ISBN.slice(0, max);
  if (/ano/i.test(name) && max <= 4) return year;
  if (/dta|data/i.test(name) && max <= 10) {
    const day = String(10 + (variant % 18)).padStart(2, '0');
    const month = String(1 + (variant % 12)).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
  if (/mes/i.test(name) && max <= 2) return String(1 + (variant % 12)).padStart(2, '0');
  if (/home|url|site|link/i.test(name)) return `https://exemplo.org/${tag}/${name}`.slice(0, max);
  if (/mail/i.test(name)) return 'teste@exemplo.org';
  if (NUMERIC.test(name)) return String(10 + variant).slice(0, max);
  return `${TEST_MARK} ${tag} ${name}`.slice(0, max);
}

/** A opção escolhida numa escolha: a da variante; nas listas grandes, Brasil ou português. */
export function pickOption<T extends { text: string; value: string }>(
  name: string,
  options: T[],
  variant: number,
): T | undefined {
  const real = options.filter((o) => o.value !== '');
  if (real.length === 0) return undefined;
  if (BIG_LISTS.has(name)) {
    return (
      real.find(
        (o) => /^bra/i.test(o.value) || /^brasil/i.test(o.text) || /portugu/i.test(o.text),
      ) ?? real[0]
    );
  }
  return real[variant % real.length];
}

/**
 * Campos que a página preenche por uma busca ou janela (instituição, curso,
 * órgão, periódico, agência, vínculo) e o lugar do item na atuação: copiados
 * de um item seu do mesmo formulário.
 */
export const DONOR_FIELD =
  /^f_(cod_?inst2?|codinst|cod_curso2?|curso_old|inst_?old|instold|codorgao2?|orgao_old|inst|curso|orgao|agencia|nme_agencia(_h)?|seq_per|issn(_h)?|titulo_periodico(_h)?|vinc|vinculo|seq_ativ)$/i;

/** O que copiar de um item seu: só os campos de busca e de lugar, com valor. */
export function donorValues(fields: [string, string][]): Record<string, string> {
  return Object.fromEntries(fields.filter(([n, v]) => v && DONOR_FIELD.test(n)));
}

/** Os campos de busca que a página preenche (instituição, curso), copiados de um item seu. */
export const LOOKUP_FIELDS = [
  'f_cod_curso',
  'f_cod_curso2',
  'f_cod_inst',
  'f_cod_inst2',
  'f_curso',
  'f_curso_old',
  'f_inst',
  'f_inst_old',
];

/** Os mesmos códigos nas instituições do doutorado sanduíche e da cotutela. */
export function lookupValues(donor: Record<string, string>): Record<string, string> {
  const inst = donor.f_cod_inst || donor.f_cod_inst2 || '';
  const name = donor.f_inst ?? '';
  const out: Record<string, string> = { ...donor };
  for (const suffix of ['', '_sw', '_ct']) {
    out[`f_cod_inst_dout${suffix}`] = inst;
    out[`f_inst_dout${suffix}`] = name;
  }
  return out;
}

/**
 * O que o check() das formações pede em função das escolhas da variante:
 * término só fora do andamento, obtenção só com o curso concluído, agência
 * só com bolsa.
 */
export function consistencyFixes(
  values: Record<string, string>,
  agency?: { code: string; name: string },
): Record<string, string> {
  const fixes: Record<string, string> = {};
  // Em andamento: sem término nem obtenção. Incompleto: o término é o ano de
  // interrupção (obrigatório), e a obtenção sai.
  if (values.F_STATUS === 'N') Object.assign(fixes, { f_ano_fim: '' });
  if (values.F_STATUS && values.F_STATUS !== 'S') {
    Object.assign(fixes, { f_ano_obten: '', f_mes_obten: '' });
  }
  // Atividade, atuação e revisor: o período atual não tem fim.
  if (values.f_status === 'S') Object.assign(fixes, { f_ano_fim: '', f_mes_fim: '' });
  // Projeto: o ano de fim só com a situação concluída.
  if (values.F_TPO_SITUACAO && values.F_TPO_SITUACAO !== 'C') fixes.F_ANO_FIM = '';
  // Banca: o tipo (acadêmico ou profissional) só no mestrado (A11).
  if (
    'f_sub_prod' in values &&
    /^A1/.test(values.F_COD_PROD ?? '') &&
    values.F_COD_PROD !== 'A11'
  ) {
    fixes.f_sub_prod = '';
  }
  // Projeto de empresa pede a empresa, por outra busca: o teste fica no "não".
  if ('f_tpo_pesq_emp' in values) fixes.f_tpo_pesq_emp = 'N';
  if ('F_BOLSA' in values) {
    const on = values.F_BOLSA === 'S' && agency;
    fixes.f_agencia = on ? agency.code : '';
    fixes.f_nme_agencia = on ? agency.name : '';
  }
  return fixes;
}

/**
 * Um item criado sem campo de texto para o marcador (licença, idioma) se
 * reconhece pelos valores que levou: todos aparecem na página de edição.
 */
export function matchesCreated(html: string, values: Record<string, string>): boolean {
  const own = Object.entries(values).filter(
    ([k, v]) =>
      v && v !== 'on' && !BIG_LISTS.has(k) && (/dta|data/i.test(k) || v.includes(TEST_MARK)),
  );
  return own.length > 0 && own.every(([, v]) => html.includes(v));
}
