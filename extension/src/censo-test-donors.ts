// Os campos de busca e de lugar dos itens de teste (censo-test-items.ts):
// instituição, curso, órgão, periódico, agência e vínculo saem de janelas de
// busca da página, e atividades e projetos ficam dentro de uma atuação. Os
// valores vêm de um item seu do mesmo formulário, lidos uma vez por leitura.

import {
  donorValues,
  LOOKUP_FIELDS,
  lookupValues,
  type TestJob,
} from '../../src/census/test-plan.ts';

/** Os links de edição de todas as listas do menu. */
export function editLinks(html: string): string[] {
  return [...html.matchAll(/setarUrl\('([^']+)'/g)]
    .map((m) => m[1]!.replace(/&amp;/g, '&'))
    .filter((p) => /[?&]f_seq[a-z_]*=\d/i.test(p));
}

/**
 * Um item seu de cada formulário que o currículo já tem: as listas do menu e,
 * dentro de cada atuação, a tela de cargos e vínculos (atividades, projetos,
 * revisor). Só os campos de busca e de lugar entram (donorValues).
 */
async function collectDonors(
  get: (path: string) => Promise<{ html: string }>,
): Promise<Record<string, Record<string, string>>> {
  const donors: Record<string, Record<string, string>> = {};
  const menu = document.documentElement.outerHTML;
  const lists = [
    ...new Set(
      [...menu.matchAll(/setarUrl\('([^']+)'/g)]
        .map((m) => m[1]!.replace(/&amp;/g, '&'))
        .filter((p) => /lista/i.test(p)),
    ),
  ];
  const pages: string[] = [];
  for (const list of lists) {
    const html = (await get(list)).html;
    pages.push(...editLinks(html));
    // A atuação abre a tela de cargos e vínculos, com as atividades e os projetos.
    for (const m of html.matchAll(/setarUrl\('([^']*cargos_vinculos[^']*)'/gi)) {
      pages.push(...editLinks((await get(m[1]!.replace(/&amp;/g, '&'))).html));
    }
  }
  for (const path of pages.slice(0, 120)) {
    const doc = new DOMParser().parseFromString((await get(path)).html, 'text/html');
    for (const form of [...doc.forms]) {
      if (!form.name || donors[form.name]) continue;
      const fields = [...form.elements].map((el) => [
        (el as HTMLInputElement).name,
        (el as HTMLInputElement).value,
      ]) as [string, string][];
      const values = donorValues(fields);
      if (Object.keys(values).length > 0) donors[form.name] = values;
    }
  }
  return donors;
}

/** Grava valores nos campos que existirem, ocultos e desabilitados também. */
export function setFields(form: HTMLFormElement, values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) {
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (el && 'value' in el) el.value = value;
  }
}

interface Context {
  agency?: { code: string; name: string };
  /** Campos de busca e de lugar de um item seu, por nome de formulário (DONOR_FIELD). */
  donors: Record<string, Record<string, string>>;
  lookups: Record<string, string>;
}

export const context: Context = { donors: {}, lookups: {} };

/**
 * Instituição e curso de uma formação sua (o check() exige, e a página só os
 * preenche pela busca) e a primeira agência da lista do Lattes, lidos uma vez.
 */
export async function prepareContext(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
) {
  const list = (await get(`pkg_formacao.lista?f_tipo=FA&f_cod=${code}`)).html;
  for (const path of editLinks(list)) {
    const doc = new DOMParser().parseFromString((await get(path)).html, 'text/html');
    const form = doc.forms.namedItem('GN_FORMACAO2');
    if (!form) continue;
    const donor = Object.fromEntries(
      LOOKUP_FIELDS.map((n) => [
        n,
        (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '',
      ]),
    );
    if ((donor.f_cod_inst || donor.f_cod_inst2) && (donor.f_cod_curso || donor.f_cod_curso2)) {
      context.lookups = lookupValues(donor);
      break;
    }
  }
  context.donors = await collectDonors(get);
  const agencies = (await get(`prc_agencia?f_cod=${code}`)).html;
  const first = /atribuir\(\s*'([^']*)'\s*,\s*'([^']*)'/.exec(agencies);
  if (first) context.agency = { code: first[1]!, name: first[2]! };
}

let prepared = false;

/**
 * O contexto, lido uma vez por carregamento do censo: sem a marca, uma
 * formação sem instituição e curso fazia o lote reler tudo a cada vez.
 */
export async function ensureContext(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
) {
  if (prepared) return;
  await prepareContext(code, get);
  prepared = true;
}

/** O caminho do formulário dentro de uma atuação sua, quando o formulário pede (atividade, projeto). */
export function placed(job: TestJob): string {
  const donor = context.donors[job.form];
  if (!donor?.f_seq_ativ || /f_seq_ativ=/.test(job.path)) return job.path;
  const extra = `f_codinst=${donor.f_codinst ?? ''}&f_seq_ativ=${donor.f_seq_ativ}`;
  return `${job.path}${job.path.includes('?') ? '&' : '?'}${extra}`;
}
