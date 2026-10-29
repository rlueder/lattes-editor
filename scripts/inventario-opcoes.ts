// Inventário das escolhas dos formulários do Lattes, para a passada que
// exercita toda opção: para cada formulário do censo (docs/lattes-formularios/)
// e cada campo de escolha (rádio, lista, caixa), as opções e, pela ligação
// com que o conector grava, quais delas um valor do XML alcança. As que
// nenhum valor alcança só se conferem escolhendo a opção na página e lendo a
// exportação; as outras, criando um item com o valor do XML e lendo o
// formulário de alteração.
//
//   node scripts/inventario-opcoes.ts            # resumo no terminal
//   node scripts/inventario-opcoes.ts --json     # e docs/lattes-formularios/opcoes.json

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import censo from '../docs/lattes-formularios/censo-2026-10-15.json' with { type: 'json' };
import recapturaB from '../docs/lattes-formularios/censo-2026-10-15b.json' with { type: 'json' };
import recapturaC from '../docs/lattes-formularios/censo-2026-10-15c.json' with { type: 'json' };
import recaptura27 from '../docs/lattes-formularios/censo-2026-10-27.json' with { type: 'json' };
import { VINCULO_TEXT } from '../src/bridge/create.ts';
import { IDENT_FIELDS, PREFERENCE } from '../src/bridge/dados-gerais-edit.ts';
import { ACTIVITY_TYPES, PERIOD } from '../src/bridge/edit-atividade.ts';
import {
  EVENT_BASICS_FIELDS,
  EVENT_CODES,
  EVENT_DETAIL_FIELDS,
  FORMA_CODES,
} from '../src/bridge/edit-items.ts';
import { COMPL_LEVELS, listEditFields } from '../src/bridge/edit-lists.ts';
import { TEACHING_LEVELS } from '../src/bridge/ensino-curso.ts';
import { FORMACAO_FIELDS } from '../src/bridge/formacao-edit.ts';
import { IDIOMA_SKILLS, LEVEL } from '../src/bridge/idioma-skills.ts';
import { VINCULO_FIELDS } from '../src/bridge/plan.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import { mapOf } from '../src/bridge/refresh/from-form.ts';
import { foldText } from '../src/model/fold-text.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

type Option = { label: string; value: string };
type Field = { name: string; options?: Option[] | string; scriptFilled?: boolean; type: string };
type Entry = {
  elements?: string[];
  id: string;
  label?: string;
  page?: { forms?: { fields: Field[]; name: string }[] };
};
type Census = { entries: Entry[]; lists?: Record<string, Option[]> };

const CAPTURES = [recaptura27, recapturaC, recapturaB, censo] as unknown as Census[];

/** Listas grandes, mapeadas por tabela de códigos (país, idioma, área, UF): uma amostra basta. */
const BIG = new Set([
  'F_IDIOMA',
  'F_IDIOMA_OBRA',
  'f_area',
  'f_idioma',
  'f_pais',
  'f_pais_i',
  'f_pais_r',
  'f_pais_nacio',
  'f_pais_nasc',
  'fpaispassaporte',
  'f_tipo_privacidade',
  'f_priv_profissional',
  'f_priv_residencial',
  'f_uf',
  'f_uf_nasc',
  'f_uf_rg',
  'F_COD_IDIOMA',
]);

/** Uma ligação campo ↔ atributo: o conversor do XML para o formulário. */
interface Link {
  attr: string;
  element: string;
  toForm?: (xml: string) => string | null | undefined;
}

export const entries = new Map<string, Entry>();
for (const file of CAPTURES) {
  for (const e of file.entries)
    if (!entries.has(e.id) && e.page?.forms?.length) entries.set(e.id, e);
}

const optionsOf = (f: Field): Option[] =>
  (typeof f.options === 'string'
    ? (CAPTURES.map((c) => c.lists?.[f.options as string]).find(Boolean) ?? [])
    : (f.options ?? [])
  ).filter((o) => o.value !== '');

/** As ligações de um formulário, pelas especificações e tabelas do conector. */
export function linksOf(e: Entry): Map<string, Link[]> {
  const out = new Map<string, Link[]>();
  const add = (field: string, link: Link) => out.set(field, [...(out.get(field) ?? []), link]);
  const elements = new Set(e.elements ?? []);
  for (const t of PRODUCTION_TARGETS) {
    if (!elements.has(t.element)) continue;
    for (const [key, m] of Object.entries(t.fields)) {
      const [child, attr] = key.split('@') as [string, string];
      const map = mapOf(m);
      add(map.field, {
        attr,
        element: child,
        toForm: map.toForm && ((v) => map.toForm!(v, 'before')),
      });
    }
  }
  const table = (
    element: string,
    t: Record<string, readonly [string, Link['toForm']]>,
    suffix = '',
  ) => {
    for (const [attr, [field, toForm]] of Object.entries(t))
      add(`${field}${suffix}`, { attr, element, toForm });
  };
  if (e.id === 'identificacao') table('DADOS-GERAIS', IDENT_FIELDS);
  if (e.id === 'endereco') table('ENDERECO', PREFERENCE);
  if (e.id.startsWith('formacao-FA') || e.id.startsWith('formacao-AP')) {
    for (const el of e.elements ?? []) table(el, FORMACAO_FIELDS);
  }
  if (e.id === 'premio') table('PREMIO-TITULO', listEditFields('premio'));
  if (e.id === 'formacao-complementar') {
    for (const el of Object.keys(COMPL_LEVELS)) table(el, listEditFields('formacao-complementar'));
    add('f_nivel', {
      attr: '(elemento)',
      element: 'FORMACAO-COMPLEMENTAR',
      toForm: (v) => COMPL_LEVELS[v],
    });
  }
  if (e.id === 'evento') {
    for (const el of Object.keys(EVENT_CODES)) {
      const basics = `DADOS-BASICOS-${el.startsWith('OUTRAS-') ? 'DE' : 'DA'}-${el}`;
      const detail = `DETALHAMENTO-${el.startsWith('OUTRAS-') ? 'DE' : 'DA'}-${el}`;
      table(basics, EVENT_BASICS_FIELDS);
      table(detail, EVENT_DETAIL_FIELDS);
    }
    add('F_COD_PROD', {
      attr: '(elemento)',
      element: 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS',
      toForm: (v) => EVENT_CODES[v],
    });
    add('F_FORMA', {
      attr: 'FORMA-PARTICIPACAO',
      element: 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO',
      toForm: (v) => FORMA_CODES[v],
    });
  }
  if (e.id === 'vinculo') {
    table('VINCULOS', VINCULO_FIELDS as Record<string, readonly [string, Link['toForm']]>);
    add('f_vinc', { attr: 'TIPO-DE-VINCULO', element: 'VINCULOS', toForm: (v) => VINCULO_TEXT[v] });
  }
  if (e.id.startsWith('atividade')) {
    for (const el of Object.keys(ACTIVITY_TYPES)) table(el, PERIOD);
    add('f_nivel', { attr: 'TIPO-ENSINO', element: 'ENSINO', toForm: (v) => TEACHING_LEVELS[v] });
  }
  if (e.id === 'idioma') {
    for (const [attr, skill] of Object.entries(IDIOMA_SKILLS)) {
      add(`F_${skill}`, { attr, element: 'IDIOMA', toForm: (v) => LEVEL[v] });
    }
  }
  return out;
}

/** Os valores do XML que um atributo aceita: o enumerado do XSD, ou SIM/NAO nos FLAG-*. */
function xmlValues(link: Link): string[] | undefined {
  if (link.attr === '(elemento)') {
    if (link.element === 'FORMACAO-COMPLEMENTAR') return Object.keys(COMPL_LEVELS);
    return Object.keys(EVENT_CODES);
  }
  if (link.attr === 'FORMA-PARTICIPACAO') return Object.keys(FORMA_CODES);
  if (link.attr === 'TIPO-DE-VINCULO') return Object.keys(VINCULO_TEXT);
  if (link.attr === 'TIPO-ENSINO') return Object.keys(TEACHING_LEVELS);
  const spec = lattesSchema.elements[link.element]?.attributes.find((a) => a.name === link.attr);
  return spec?.enum ?? (link.attr.startsWith('FLAG-') ? ['SIM', 'NAO'] : undefined);
}

export interface FieldInventory {
  /** Rótulo das opções que nenhum valor do XML alcança: só pela página e pela exportação. */
  byPageOnly: string[];
  /** O valor do XML é o próprio texto da opção (atributo sem enumerado). */
  direct?: boolean;
  field: string;
  form: string;
  label?: string;
  links: string[];
  options: number;
  /** As opções que um valor do XML alcança, com o valor. */
  reached: Record<string, string>;
  scriptFilled?: boolean;
  /** Valores do XML que não dão em opção nenhuma. */
  unmatched: string[];
}

export function inventory(): FieldInventory[] {
  const out: FieldInventory[] = [];
  for (const [id, e] of entries) {
    const links = linksOf(e);
    for (const f of e.page!.forms![0]!.fields) {
      if (f.type !== 'radio' && !f.type.startsWith('select') && f.type !== 'checkbox') continue;
      if (BIG.has(f.name)) continue;
      const options = optionsOf(f);
      const ls = links.get(f.name) ?? [];
      const reached: Record<string, string> = {};
      const unmatched: string[] = [];
      let direct = false;
      for (const l of ls) {
        const values = xmlValues(l);
        if (!values) {
          // Sem enumerado: o XML guarda o texto (o rótulo) ou o próprio valor da opção.
          direct = true;
          for (const o of options)
            reached[o.label || o.value] ??= l.toForm
              ? l.toForm(o.label)
                ? o.label
                : o.value
              : o.value;
          continue;
        }
        for (const v of values) {
          const shown = l.toForm ? l.toForm(v) : v;
          const hit = options.find(
            (o) => o.value === shown || (!!shown && foldText(o.label) === foldText(shown)),
          );
          if (hit) reached[hit.label || hit.value] ??= v;
          else if (shown !== '' && shown !== null) unmatched.push(v);
        }
      }
      out.push({
        byPageOnly: options
          .filter((o) => !((o.label || o.value) in reached))
          .map((o) => o.label || o.value),
        field: f.name,
        form: id,
        label: (f as { label?: string }).label,
        links: [...new Set(ls.map((l) => `${l.element}@${l.attr}`))],
        options: options.length,
        reached,
        ...(direct ? { direct } : {}),
        ...(f.scriptFilled ? { scriptFilled: true } : {}),
        unmatched: [...new Set(unmatched)],
      });
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inv = inventory();
  const noLink = inv.filter((f) => f.links.length === 0);
  const pageOnly = inv.filter((f) => f.links.length > 0 && f.byPageOnly.length > 0);
  const options = inv.reduce((n, f) => n + f.options, 0);
  const reached = inv.reduce((n, f) => n + Object.keys(f.reached).length, 0);
  console.log(`Campos de escolha: ${inv.length}, opções: ${options}`);
  console.log(`Alcançadas por um valor do XML: ${reached}`);
  console.log(
    `Campos sem ligação com o XML no conector: ${noLink.length} (${noLink.reduce((n, f) => n + f.options, 0)} opções)`,
  );
  console.log(
    `Campos ligados com opções só pela página: ${pageOnly.length} (${pageOnly.reduce((n, f) => n + f.byPageOnly.length, 0)} opções)`,
  );
  console.log(
    `Com opções montadas por script: ${inv
      .filter((f) => f.scriptFilled)
      .map((f) => `${f.form}.${f.field}`)
      .join(', ')}`,
  );
  if (process.argv.includes('--json')) {
    const path = fileURLToPath(new URL('../docs/lattes-formularios/opcoes.json', import.meta.url));
    writeFileSync(path, `${JSON.stringify({ campos: inv }, null, 2)}\n`);
    console.log(path);
  }
}
