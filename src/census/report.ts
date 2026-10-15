// A cobertura do censo (LAT-55): cada atributo do schema que um formulário do
// Lattes grava cai num de quatro grupos, pela ligação campo ↔ atributo e pelo
// tipo do campo capturado: no formulário com opções, no formulário como texto
// livre, oculto no formulário, ou fora do formulário. Sem captura do
// formulário, o atributo fica "sem captura", que é lacuna e não reprova nada.
//
// As divergências são o que o editor faz diferente do Lattes capturado: uma
// lista que o formulário tem e o editor não oferece, uma lista com opções
// diferentes, ou a ordem dos campos diferente de form-order.ts.

import { lattesSchema } from '../schema/lattes.ts';
import type { CensusField, CensusOption } from './census-page.ts';
import { GRID_FIELDS, guessByName, knownLinks, type LinkSource } from './known-links.ts';
import type { FieldLink } from './link.ts';
import { checkOptions, type EditorControl } from './option-check.ts';
import type { CensusEntry, CensusFile } from './run.ts';
import type { CensusTarget } from './targets.ts';

export type Group = 'fora' | 'oculto' | 'opcoes' | 'sem-captura' | 'texto';

export interface AttributeRow {
  attribute: string;
  /** O controle que o editor mostra (só nos atributos ligados a um campo de opções). */
  control?: EditorControl;
  element: string;
  field?: string;
  group: Group;
  link?: LinkSource;
  target: string;
}

/** Uma divergência conhecida, aceita em pendencias.json com o motivo. */
export interface AcceptedGap {
  key: string;
  reason: string;
}

export interface Disagreement {
  detail: string;
  /** Chave estável, a que vai para pendencias.json. */
  key: string;
}

/** A posição de um atributo no formulário do editor (form-order.ts), quando ela é conhecida. */
export type FormSlot = (element: string, attr: string) => { rank: number } | undefined;

export interface CoverageInput {
  files: CensusFile[];
  formSlot?: FormSlot;
  targets: CensusTarget[];
}

export interface Coverage {
  /** A captura usada por entrada (a mais recente com o formulário lido). */
  captured: Map<string, { at: string; entry: CensusEntry; lists: CensusFile['lists'] }>;
  disagreements: Disagreement[];
  /**
   * O mesmo que as divergências, mas com a ligação campo ↔ atributo inferida:
   * lacunas prováveis, que o teste não cobra até a ligação ser observada.
   */
  inferredGaps: Disagreement[];
  rows: AttributeRow[];
  /** Elementos do schema com atributos que nenhuma entrada cobre. */
  uncovered: string[];
}

export interface FieldInfo {
  field?: CensusField;
  hidden: boolean;
  index: number;
  name: string;
}

/** Os elementos que cada entrada grava: os dela e as partes (sem entrar nos de outra entrada). */
export function subtrees(targets: CensusTarget[]): Map<string, string[]> {
  const roots = new Set(targets.flatMap((t) => t.elements));
  const out = new Map<string, string[]>();
  for (const t of targets) {
    const seen = new Set<string>();
    const visit = (name: string, top: boolean) => {
      if (seen.has(name) || (!top && roots.has(name))) return;
      seen.add(name);
      for (const c of lattesSchema.elements[name]?.children ?? []) visit(c.name, false);
    };
    for (const e of t.elements) visit(e, true);
    out.set(
      t.id,
      [...seen].filter((e) => (lattesSchema.elements[e]?.attributes.length ?? 0) > 0),
    );
  }
  return out;
}

/** A captura mais recente de cada entrada com o formulário lido. */
function latestCaptures(files: CensusFile[]): Coverage['captured'] {
  const out: Coverage['captured'] = new Map();
  const sorted = [...files].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  for (const file of sorted) {
    for (const entry of file.entries) {
      if (entry.status === 'ok' && entry.page) {
        out.set(entry.id, { at: file.capturedAt, entry, lists: file.lists });
      }
    }
  }
  return out;
}

/** As ligações observadas mais recentes por entrada. */
function latestLinks(files: CensusFile[]): Map<string, FieldLink[]> {
  const out = new Map<string, FieldLink[]>();
  const sorted = [...files].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  for (const file of sorted) {
    const byTarget = new Map<string, FieldLink[]>();
    for (const l of file.links ?? [])
      byTarget.set(l.target, [...(byTarget.get(l.target) ?? []), l]);
    for (const [t, links] of byTarget) out.set(t, links);
  }
  return out;
}

function fieldsOf(entry: CensusEntry): Map<string, FieldInfo> {
  const out = new Map<string, FieldInfo>();
  let index = 0;
  for (const form of entry.page?.forms ?? []) {
    for (const f of form.fields) {
      const key = f.name.toLowerCase();
      if (!out.has(key)) out.set(key, { field: f, hidden: false, index: index++, name: f.name });
    }
    for (const h of form.hidden) {
      const key = h.toLowerCase();
      if (!out.has(key)) out.set(key, { hidden: true, index: index++, name: h });
    }
  }
  return out;
}

/** As opções de um campo, resolvendo a referência a uma lista comum. */
export function optionsOf(
  field: CensusField,
  lists: Record<string, CensusOption[]>,
): CensusOption[] {
  if (typeof field.options === 'string') return lists[field.options] ?? [];
  return field.options ?? [];
}

const hasOptions = (f: CensusField) =>
  f.type === 'radio' || f.type === 'checkbox' || f.type.startsWith('select');

function groupOf(info: FieldInfo): Group {
  if (info.hidden || !info.field) return 'oculto';
  return hasOptions(info.field) ? 'opcoes' : 'texto';
}

/** Uma ligação observada que conta: mais itens a favor que contra, ou um mapa de opções firme. */
function trusted(l: FieldLink, info: FieldInfo | undefined): boolean {
  // Num campo de opções, um item só não basta: "Não" bate com qualquer FLAG-* vazia.
  if (l.by === 'valor') return l.matches > l.conflicts && (!info?.field?.options || l.matches >= 2);
  const map = Object.entries(l.valueMap ?? {});
  const injective = new Set(map.map(([, v]) => v)).size === map.length;
  return l.matches >= 2 && l.conflicts === 0 && map.length >= 2 && injective;
}

/**
 * O campo observado de cada atributo (ELEMENTO@ATRIBUTO). Ambíguo não liga:
 * um campo que bate igual com dois atributos (o mesmo ano em conclusão e
 * obtenção) ou dois campos que batem igual com um atributo, a não ser que só
 * um deles esteja visível (f_inst e o oculto f_inst_old).
 */
export function observedChoice(
  links: FieldLink[],
  fields: Map<string, FieldInfo>,
): Map<string, string> {
  const usable = links.filter(
    (l) => fields.has(l.field.toLowerCase()) && trusted(l, fields.get(l.field.toLowerCase())),
  );
  const rank = (l: FieldLink) => (l.by === 'valor' ? 1000 : 0) + l.matches;
  const bestOfField = new Map<string, number>();
  for (const l of usable)
    bestOfField.set(l.field, Math.max(bestOfField.get(l.field) ?? 0, rank(l)));
  const fieldTies = new Map<string, number>();
  for (const l of usable) {
    if (rank(l) === bestOfField.get(l.field))
      fieldTies.set(l.field, (fieldTies.get(l.field) ?? 0) + 1);
  }
  const byAttr = new Map<string, FieldLink[]>();
  for (const l of usable) {
    if (rank(l) !== bestOfField.get(l.field) || fieldTies.get(l.field)! > 1) continue;
    const key = `${l.element}@${l.attribute}`;
    byAttr.set(key, [...(byAttr.get(key) ?? []), l]);
  }
  const out = new Map<string, string>();
  for (const [key, list] of byAttr) {
    const top = Math.max(...list.map(rank));
    let best = list.filter((l) => rank(l) === top);
    if (best.length > 1) best = best.filter((l) => !fields.get(l.field.toLowerCase())!.hidden);
    if (best.length === 1) out.set(key, best[0]!.field);
  }
  return out;
}

/** O campo ligado a um atributo, pela ordem de confiança: observado, documentado, inferido. */
function linkFor(
  t: CensusTarget,
  el: string,
  attr: string,
  fields: Map<string, FieldInfo>,
  observed: Map<string, string>,
  guesses: Map<string, string>,
): { info: FieldInfo; link: LinkSource } | undefined {
  const present = (name: string) => fields.get(name.toLowerCase());
  const split = (a: string) => (a.includes('@') ? a.split('@') : [undefined, a]);
  const known = knownLinks(t.id);
  const seen = observed.get(`${el}@${attr}`);
  // Uma coincidência de valores não desfaz o que foi lido no código do
  // formulário: campo documentado para outro atributo não liga a este.
  const elsewhere =
    seen &&
    known.some(
      (k) =>
        k.source === 'documentado' &&
        k.field.toLowerCase() === seen.toLowerCase() &&
        split(k.attribute)[1] !== attr,
    );
  if (seen && !elsewhere) return { info: present(seen)!, link: 'observado' };
  const hitKnown = known.find((k) => {
    const [kEl, kAttr] = split(k.attribute);
    return kAttr === attr && (!kEl || kEl === el) && present(k.field);
  });
  const knownHit = hitKnown;
  if (knownHit) return { info: present(knownHit.field)!, link: knownHit.source };
  const grid = GRID_FIELDS[el];
  if (grid && present(grid)) return { info: present(grid)!, link: 'inferido' };
  const guessed = guesses.get(`${el}@${attr}`);
  return guessed ? { info: present(guessed)!, link: 'inferido' } : undefined;
}

/** Palpites pelo nome, um campo por atributo; dois campos no mesmo atributo não ligam. */
function nameGuesses(elements: string[], fields: Map<string, FieldInfo>): Map<string, string> {
  const out = new Map<string, string>();
  const clash = new Set<string>();
  for (const el of elements) {
    const attrs = lattesSchema.elements[el]?.attributes.map((a) => a.name) ?? [];
    for (const info of fields.values()) {
      const attr = guessByName(info.name, attrs);
      if (!attr) continue;
      const key = `${el}@${attr}`;
      if (out.has(key) && out.get(key) !== info.name) clash.add(key);
      else out.set(key, info.name);
    }
  }
  for (const key of clash) out.delete(key);
  return out;
}

/** A ordem do formulário capturado contra a de form-order.ts, por elemento. */
function orderDisagreements(
  rows: AttributeRow[],
  fields: Map<string, Map<string, FieldInfo>>,
  slot: FormSlot,
): Disagreement[] {
  const out: Disagreement[] = [];
  const byElement = new Map<string, AttributeRow[]>();
  for (const r of rows) {
    if (!r.field || (r.link !== 'observado' && r.link !== 'documentado')) continue;
    if (!slot(r.element, r.attribute)) continue;
    const key = `${r.target}:${r.element}`;
    byElement.set(key, [...(byElement.get(key) ?? []), r]);
  }
  for (const [key, list] of byElement) {
    if (list.length < 2) continue;
    const pos = (r: AttributeRow) => fields.get(r.target)!.get(r.field!.toLowerCase())!.index;
    const lattes = [...list].sort((a, b) => pos(a) - pos(b)).map((r) => r.attribute);
    const editor = [...list]
      .sort((a, b) => slot(a.element, a.attribute)!.rank - slot(b.element, b.attribute)!.rank)
      .map((r) => r.attribute);
    if (lattes.join() !== editor.join()) {
      out.push({
        detail: `${key}: Lattes ${lattes.join(', ')}; editor ${editor.join(', ')}`,
        key: `ordem:${key}`,
      });
    }
  }
  return out;
}

export function coverage(input: CoverageInput): Coverage {
  const captured = latestCaptures(input.files);
  const observed = latestLinks(input.files);
  const trees = subtrees(input.targets);
  const rows: AttributeRow[] = [];
  const disagreements: Disagreement[] = [];
  const inferredGaps: Disagreement[] = [];
  const fieldMaps = new Map<string, Map<string, FieldInfo>>();
  for (const t of input.targets) {
    const elements = trees.get(t.id) ?? [];
    const cap = captured.get(t.id);
    const fields = cap ? fieldsOf(cap.entry) : undefined;
    if (fields) fieldMaps.set(t.id, fields);
    const guesses = fields ? nameGuesses(elements, fields) : new Map<string, string>();
    const seen = fields
      ? observedChoice(observed.get(t.id) ?? [], fields)
      : new Map<string, string>();
    for (const el of elements) {
      for (const { name: attr } of lattesSchema.elements[el]!.attributes) {
        const base = { attribute: attr, element: el, target: t.id };
        if (!fields || !cap) {
          rows.push({ ...base, group: 'sem-captura' });
          continue;
        }
        const hit = linkFor(t, el, attr, fields, seen, guesses);
        if (!hit) {
          rows.push({ ...base, group: 'fora' });
          continue;
        }
        const row: AttributeRow = {
          ...base,
          field: hit.info.name,
          group: groupOf(hit.info),
          link: hit.link,
        };
        rows.push(row);
        if (row.group !== 'opcoes' || !hit.info.field) continue;
        const check = checkOptions(
          `${t.id}:${el}@${attr}`,
          hit.info.field,
          optionsOf(hit.info.field, cap.lists),
          (observed.get(t.id) ?? []).filter(
            (l) =>
              l.element === el &&
              l.attribute === attr &&
              l.field.toLowerCase() === hit.info.name.toLowerCase(),
          ),
        );
        row.control = check.control;
        const sure = row.link === 'observado' || row.link === 'documentado';
        (sure ? disagreements : inferredGaps).push(...check.found);
      }
    }
  }
  if (input.formSlot) disagreements.push(...orderDisagreements(rows, fieldMaps, input.formSlot));
  const covered = new Set(rows.map((r) => r.element));
  const uncovered = Object.entries(lattesSchema.elements)
    .filter(([name, spec]) => spec.attributes.length > 0 && !covered.has(name))
    .map(([name]) => name)
    .sort();
  disagreements.sort((a, b) => a.key.localeCompare(b.key));
  inferredGaps.sort((a, b) => a.key.localeCompare(b.key));
  return { captured, disagreements, inferredGaps, rows, uncovered };
}

/** O que mudou em relação às pendências aceitas: novas reprovam, resolvidas também (para limpar). */
export function compareWithAccepted(
  found: Disagreement[],
  accepted: readonly string[],
): { fresh: Disagreement[]; resolved: string[] } {
  const keys = new Set(found.map((d) => d.key));
  const ok = new Set(accepted);
  return {
    fresh: found.filter((d) => !ok.has(d.key)),
    resolved: accepted.filter((k) => !keys.has(k)),
  };
}
