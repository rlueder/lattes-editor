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
  // O artigo abre por abreUrlModal, os outros por setarUrl.
  return [...html.matchAll(/(?:setarUrl|abreUrlModal)\('([^']+)'/g)]
    .map((m) => m[1]!.replace(/&amp;/g, '&'))
    .filter((p) => /[?&]f_seq[a-z_]*=\d/i.test(p));
}

/** O pacote de um caminho do Lattes (pkg_orient.form → pkg_orient), sem caixa. */
export const packageOf = (path: string) => path.split(/[.?]/)[0]!.toLowerCase();

/** Os tipos da passada: os nomes de formulário e os pacotes das listas e páginas deles. */
export interface DonorWant {
  forms: Set<string>;
  /** Os pacotes das listas a abrir (as atuações também, quando há projeto). */
  packages: Set<string>;
  /** Os pacotes dos formulários dos tipos: só essas páginas de item são lidas. */
  pages: Set<string>;
}

/**
 * Um item seu de cada formulário que o currículo já tem: as listas do menu e,
 * dentro de cada atuação, a tela de cargos e vínculos (atividades, projetos,
 * revisor). Só os campos de busca e de lugar entram (donorValues).
 */

async function collectDonors(
  get: (path: string) => Promise<{ html: string }>,
  want?: DonorWant,
): Promise<Record<string, Record<string, string>>> {
  const donors: Record<string, Record<string, string>> = {};
  const menu = document.documentElement.outerHTML;
  // Com want, só as listas dos pacotes dos tipos da passada: o teto de pedidos
  // de cada tarefa (src/bridge/transport.ts) não comporta todas.
  const lists = [
    ...new Set(
      [...menu.matchAll(/setarUrl\('([^']+)'/g)]
        .map((m) => m[1]!.replace(/&amp;/g, '&'))
        .filter((p) => /lista/i.test(p))
        .filter((p) => !want || want.packages.has(packageOf(p))),
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
  const wanted = want ? pages.filter((p) => want.pages.has(packageOf(p))) : pages;
  for (const path of wanted.slice(0, 120)) {
    if (want && [...want.forms].every((f) => donors[f])) break;
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
  /** As agências da lista do Lattes: cada variante de teste fica com outra. */
  agencies: { code: string; name: string }[];
  agency?: { code: string; name: string };
  /** Campos de busca e de lugar de um item seu, por nome de formulário (DONOR_FIELD). */
  donors: Record<string, Record<string, string>>;
  /** Um periódico da busca do Lattes, como a janela dela grava (selecionar). */
  journal?: { issn: string; seq: string; title: string };
  lookups: Record<string, string>;
  /**
   * O projeto de teste numa atuação escolhida (BatchOptions.project): os
   * campos que seleciona() e atribuir() das janelas gravariam.
   */
  project?: Record<string, string>;
}

/**
 * A Nature pela busca de periódicos do Lattes (f_ctr=S, só consulta): o
 * artigo pede o título, o ISSN e o código que a janela de busca grava.
 */
async function findJournal(code: string, get: (path: string) => Promise<{ html: string }>) {
  const html = (await get(`PRC_PERIODICO?f_nome=nature&f_ctr=S&f_origem=R&f_cod=${code}`)).html;
  const options = [...html.matchAll(/<option value="(\d+)#([^"]+)">([^<(]+)/g)].map((m) => ({
    issn: m[2]!,
    seq: m[1]!,
    title: m[3]!.trim(),
  }));
  return options.find((o) => o.issn === '0028-0836') ?? options[0];
}

export const context: Context = { agencies: [], donors: {}, lookups: {} };

/**
 * Instituição e curso de uma formação sua (o check() exige, e a página só os
 * preenche pela busca) e a primeira agência da lista do Lattes, lidos uma vez.
 */
export async function prepareContext(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  want?: DonorWant,
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
  context.donors = await collectDonors(get, want);
  const agencies = (await get(`prc_agencia?f_cod=${code}`)).html;
  context.agencies = [...agencies.matchAll(/atribuir\(\s*'([^']*)'\s*,\s*'([^']*)'/g)]
    .slice(0, 40)
    .map((m) => ({ code: m[1]!, name: m[2]!.trim() }));
  context.agency = context.agencies[0];
  context.journal = await findJournal(code, get);
}

/** Os pacotes do contexto já lido ('' para todos), para não reaproveitar o de outros tipos. */
let prepared: string | undefined;

/** Uma captura nova invalida o contexto lido para a anterior. */
export function forgetContext(): void {
  prepared = undefined;
}

/**
 * O contexto, lido uma vez por carregamento do censo: sem a marca, uma
 * formação sem instituição e curso fazia o lote reler tudo a cada vez.
 */
export async function ensureContext(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  want?: DonorWant,
): Promise<boolean> {
  const key = want ? [...want.packages].sort().join(',') : '';
  // Sem want (o lote), vale o contexto que a preparação leu, mesmo só de
  // alguns tipos: o lote cria só os tipos de only.
  if (prepared === key || (!want && prepared !== undefined)) return false;
  await prepareContext(code, get, want);
  prepared = key;
  return true;
}

/**
 * A atuação nova não fica dentro de outra: o formulário dela se chama GN_ATIV
 * como o do revisor, e o lugar do revisor (f_codinst, f_seq_ativ) fazia o
 * Lattes gravar o código da atuação doadora na coluna da instituição.
 */
export const PLACELESS = /^PKG_ATIV\.inclui/i;

/** O caminho do formulário dentro de uma atuação sua, quando o formulário pede (atividade, projeto). */
export function placed(job: TestJob): string {
  const donor = context.donors[job.form];
  if (!donor?.f_seq_ativ || /f_seq_ativ=/.test(job.path) || PLACELESS.test(job.path)) {
    return job.path;
  }
  const extra = `f_codinst=${donor.f_codinst ?? ''}&f_seq_ativ=${donor.f_seq_ativ}`;
  return `${job.path}${job.path.includes('?') ? '&' : '?'}${extra}`;
}

/**
 * Os campos do projeto de teste numa atuação sua, como a página os grava:
 * seleciona() da janela de instituições com vínculo (PKG_PROJETO.pp_lista_inst,
 * lida em 18/10/2026: o código sem a letra em f_cod_inst com V, senão em
 * f_cod_inst2, e o nome em f_inst e f_inst_old) e, com organ, o primeiro órgão
 * da janela de órgãos (atribuir(), tipo 0 em f_codorgao). Só GET.
 */
export async function projectFields(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  institution: string,
  organ: boolean,
): Promise<Record<string, string>> {
  const list = (await get(`PKG_PROJETO.pp_lista_inst?f_pgm=INSTVINCULO&f_cod=${code}`)).html;
  const hit = [...list.matchAll(/seleciona\('([^']*)'\s*,\s*'([^']*)'/g)].find(
    (m) => m[1] === institution,
  );
  if (!hit) throw new Error(`A instituição ${institution} não está entre as das suas atuações`);
  const rest = institution.slice(1);
  const v = institution.startsWith('V');
  const fields: Record<string, string> = {
    f_cod_inst: v ? rest : '',
    f_cod_inst2: v ? '' : rest,
    f_inst: hit[2]!,
    f_inst_old: hit[2]!,
  };
  if (!organ) return fields;
  const window = (
    await get(
      `pkg_projeto.pp_orgao_cargo?f_origem=&f_modal_cv=2&f_cod=${code}&f_cod_inst=${institution}&f_cod_inst2=`,
    )
  ).html;
  const first = /atribuir\('(\d{12})'\s*,\s*'([^']*)'\s*,\s*(\d+)/.exec(window);
  if (!first) throw new Error('A janela de órgãos da instituição veio vazia');
  return {
    ...fields,
    f_codorgao: first[3] === '0' ? first[1]! : '',
    f_codorgao2: first[3] === '0' ? '' : first[1]!,
    f_orgao: first[2]!,
    f_orgao_old: first[2]!,
  };
}
