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

/** Formulários de registro único ou que dependem de outra tela: fora da passada. */
export const NOT_CREATABLE = new Set([
  'areas-de-atuacao',
  'atividade',
  'endereco',
  'identificacao',
  'linha-de-pesquisa',
  'outras-informacoes',
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

/** O valor de teste de um campo de texto, dentro do limite dele. */
export function textValue(name: string, maxLength: number, variant: number, tag: string): string {
  const max = maxLength > 0 ? maxLength : 200;
  const year = String(2005 + (variant % 15));
  if (/ano/i.test(name) && max <= 4) return year;
  if (/dta|data/i.test(name) && max <= 10) {
    const day = String(10 + (variant % 18)).padStart(2, '0');
    const month = String(1 + (variant % 12)).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
  if (/mes/i.test(name) && max <= 2) return String(1 + (variant % 12)).padStart(2, '0');
  if (NUMERIC.test(name) && max <= 8) return String(10 + variant).slice(0, max);
  if (/home|url|site|link/i.test(name)) return `https://exemplo.org/${tag}/${name}`.slice(0, max);
  if (/mail/i.test(name)) return 'teste@exemplo.org';
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
