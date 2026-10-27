// Os formulários lidos entram no editor (o fim de "Atualizar do Lattes"). Cada
// item lido vai para a exportação carregada (o original das diferenças),
// porque é o que o Lattes tem, e para a cópia de trabalho, menos onde a pessoa
// já mudou o mesmo campo no editor: ali fica o valor dela, que passa a ser
// uma alteração a enviar contra o valor novo do Lattes.
//
// - Linha de um item criado no editor (entrou pelo Importar): o item passa a
//   estar no Lattes, com os valores do formulário.
// - Linha sem item: um item da exportação que nenhuma linha mostrou e cujos
//   valores batem com o formulário (o título ou o ano mudou no Lattes), ou um
//   item novo, com SEQUENCIA-PRODUCAO acima de todos os do editor, inserido na
//   ordem do schema.

import { foldText } from '../../model/fold-text.ts';
import type { FormReadMark } from '../../model/form-read.ts';
import {
  newItem,
  type ProductionType,
  productionType,
  pruneEmptyExtras,
} from '../../model/production.ts';
import { insertInSchemaOrder } from '../../model/schema-order.ts';
import {
  childElements,
  element,
  firstChild,
  getAttr,
  serializeElement,
  setAttr,
  walk,
  type XElement,
} from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import type { ProductionTarget } from '../production/types.ts';
import { applyReading } from './apply-reading.ts';
import { refreshGroups } from './coverage.ts';
import { mapOf, partOf } from './from-form.ts';
import type { RefreshPlan } from './plan.ts';
import type { FormReading } from './read.ts';

const SEQ = 'SEQUENCIA-PRODUCAO';

export interface MergeResult {
  /** Títulos dos itens novos. */
  added: string[];
  /** Títulos dos itens que mudaram. */
  changed: string[];
  /** O próximo SEQUENCIA-PRODUCAO livre. */
  counter: number;
  marks: FormReadMark[];
  /** Formulários lidos sem diferença. */
  same: number;
  /** Linhas que não entraram, com o motivo. */
  skipped: { reason: string; text: string }[];
}

/** O tipo do formulário lido: o único do grupo, ou o da natureza marcada. */
export function targetOf(
  targets: ProductionTarget[],
  values: Record<string, string>,
): ProductionTarget | undefined {
  if (targets.length === 1) return targets[0];
  const byNature = targets.filter(
    (t) => t.nature && t.nature.values.includes((values[t.nature.field] ?? '').trim()),
  );
  if (byNature.length === 1) return byNature[0];
  if (byNature.length > 1) return undefined;
  // Sem natureza que case: o tipo sem natureza do grupo (outra banca), se for um só.
  const plain = targets.filter((t) => !t.nature);
  return plain.length === 1 ? plain[0] : undefined;
}

const folded = (v: string | undefined) => foldText((v ?? '').trim());

const valueOf = (item: XElement, spec: { attr: string; child: string }) =>
  getAttr(partOf(item, spec.child) ?? item, spec.attr) ?? '';

/**
 * Quanto o item da exportação parece o do formulário: título (3), ano (2), o
 * f_seq igual ao SEQUENCIA-PRODUCAO (2; nem sempre é, seção 16 de
 * lattes_internals.md) e cada outro campo preenchido igual (1).
 */
function score(t: ProductionTarget, item: XElement, reading: FormReading): number {
  const v = reading.values ?? {};
  let s = 0;
  if (folded(valueOf(item, t.title)) === folded(v[t.title.field ?? 'f_titulo'])) s += 3;
  if (valueOf(item, t.year).trim() === (v[t.year.field ?? 'f_ano'] ?? '').trim()) s += 2;
  const fseq = new URLSearchParams(reading.link.split('?')[1] ?? '').get('f_seq');
  if (fseq && fseq === getAttr(item, SEQ)) s += 2;
  for (const [key, m] of Object.entries(t.fields)) {
    const map = mapOf(m);
    const [child, attr] = key.split('@') as [string, string];
    const now = getAttr(partOf(item, child) ?? element(''), attr) ?? '';
    const shown = map.toForm ? map.toForm(now, 'before') : now;
    const form = v[map.field];
    if (now && form && shown !== undefined && folded(shown) === folded(form)) s += 1;
  }
  return s;
}

/** O item da exportação que é o do formulário: o de maior pontuação, único e com pelo menos 5. */
function pairOf(
  t: ProductionTarget,
  reading: FormReading,
  candidates: XElement[],
): XElement | undefined {
  const scored = candidates
    .filter((c) => c.name === t.element)
    .map((item) => ({ item, s: score(t, item, reading) }))
    .sort((a, b) => b.s - a.s);
  const [first, second] = scored;
  if (!first || first.s < 5 || (second && second.s === first.s)) return undefined;
  return first.item;
}

function findItem(root: XElement, name: string, seq: string): XElement | undefined {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && el.name === name && getAttr(el, SEQ) === seq) hit = el;
  });
  return hit;
}

/** O item no contêiner do tipo, criando os contêineres que faltam na ordem do schema. */
function insertItem(root: XElement, type: ProductionType, item: XElement): void {
  let parent = root;
  for (const name of type.containerPath) {
    let next = firstChild(parent, name);
    if (!next) {
      next = element(name);
      insertInSchemaOrder(lattesSchema, parent, next);
    }
    parent = next;
  }
  insertInSchemaOrder(lattesSchema, parent, item);
}

const xmlOf = (els: XElement[]) => els.map((e) => serializeElement(e).join('')).join('');

/** Elementos que se repetem no item: autores e participantes vão como lista. */
const LISTS = new Set(['AUTORES', 'PARTICIPANTE-BANCA', 'PARTICIPANTE-DE-EVENTOS-CONGRESSOS']);

/**
 * O que mudou de `before` para `after` (o item da exportação e o lido), levado
 * à cópia de trabalho onde ela ainda tem o valor de antes: atributo a
 * atributo nas partes, e a lista de autores inteira.
 */
export function mergeInto(before: XElement, after: XElement, working: XElement): void {
  const names = new Set([...before.attrs, ...after.attrs].map((a) => a.name));
  for (const name of names) {
    const was = getAttr(before, name);
    const now = getAttr(after, name);
    if (was === now || getAttr(working, name) !== was) continue;
    if (now === undefined) working.attrs = working.attrs.filter((a) => a.name !== name);
    else setAttr(working, name, now);
  }
  const children = new Set([...childElements(before), ...childElements(after)].map((c) => c.name));
  for (const name of children) {
    const b = childElements(before, name);
    const a = childElements(after, name);
    const w = childElements(working, name);
    if (LISTS.has(name) || b.length > 1 || a.length > 1) {
      if (xmlOf(b) === xmlOf(a) || xmlOf(w) !== xmlOf(b)) continue;
      working.children = working.children.filter((c) => !w.includes(c as XElement));
      for (const el of a) insertInSchemaOrder(lattesSchema, working, structuredClone(el));
      continue;
    }
    const [bb, aa, ww] = [b[0], a[0], w[0]];
    if (!aa) {
      // Tirado no Lattes (as palavras-chave apagadas): sai daqui se estava igual.
      if (bb && ww && xmlOf([bb]) === xmlOf([ww])) {
        working.children = working.children.filter((c) => c !== ww);
      }
    } else if (!bb) {
      if (!ww) insertInSchemaOrder(lattesSchema, working, structuredClone(aa));
    } else if (ww) mergeInto(bb, aa, ww);
  }
}

/** Troca o conteúdo do item da exportação pelo lido, no mesmo lugar. */
function replaceIn(target: XElement, source: XElement): void {
  target.attrs = source.attrs;
  target.children = source.children;
}

const titleOf = (t: ProductionTarget, item: XElement) => valueOf(item, t.title) || t.id;

/** O próximo SEQUENCIA-PRODUCAO: acima do contador e de todos os números dos documentos. */
function nextFree(roots: XElement[], counter: number): number {
  let max = 0;
  for (const root of roots) {
    walk(root, (el) => {
      const n = Number.parseInt(getAttr(el, SEQ) ?? '', 10);
      if (Number.isFinite(n) && n > max) max = n;
    });
  }
  return Math.max(counter, max + 1);
}

/**
 * Os formulários lidos, para a exportação carregada (`base`) e a cópia de
 * trabalho (`working`), que mudam no lugar. `counter` é o próximo
 * SEQUENCIA-PRODUCAO salvo; o número de um item novo fica acima dele e de
 * todos os do editor, nunca numa lacuna.
 */
export function mergeReadings(input: {
  base: XElement;
  counter: number;
  now: number;
  plan: RefreshPlan;
  readings: FormReading[];
  working: XElement;
}): MergeResult {
  const { base, now, plan, readings, working } = input;
  const result: MergeResult = {
    added: [],
    changed: [],
    counter: input.counter,
    marks: [],
    same: 0,
    skipped: [],
  };
  const reads = new Map(plan.reads.map((r) => [r.link, r]));
  const groups = new Map(refreshGroups().map((g) => [g.id, g]));
  const used = new Set<XElement>();
  for (const reading of readings) {
    const read = reads.get(reading.link);
    if (!read) continue;
    const skip = (reason: string) => result.skipped.push({ reason, text: read.text });
    if (reading.error || !reading.values) {
      skip('o formulário não abriu');
      continue;
    }
    const t = targetOf(groups.get(read.group)?.targets ?? [], reading.values);
    if (!t) {
      skip('o tipo do item não foi reconhecido no formulário');
      continue;
    }
    const mark = (seq: string, kind: FormReadMark['kind']) =>
      result.marks.push({ kind, readAt: now, seq, target: t.id });
    const type = productionType(lattesSchema, t.element);

    // Um item criado no editor que já entrou no Lattes.
    const own = read.seq ? findItem(working, t.element, read.seq) : undefined;
    if (own && type) {
      const lattes = structuredClone(own);
      applyReading(t, lattes, reading);
      mergeInto(structuredClone(own), lattes, own);
      insertItem(base, type, lattes);
      mark(read.seq!, 'novo');
      result.added.push(titleOf(t, lattes));
      continue;
    }

    // Um item da exportação com outro título ou ano no Lattes.
    const orphans = (plan.orphans[read.group] ?? [])
      .map((seq) => findItem(base, t.element, seq))
      .filter((el): el is XElement => el !== undefined && !used.has(el));
    const old = pairOf(t, reading, orphans);
    if (old) {
      used.add(old);
      const lattes = structuredClone(old);
      applyReading(t, lattes, reading);
      if (xmlOf([lattes]) === xmlOf([old])) {
        result.same++;
        continue;
      }
      const seq = getAttr(old, SEQ)!;
      const mine = findItem(working, t.element, seq);
      if (mine) mergeInto(old, lattes, mine);
      replaceIn(old, lattes);
      mark(seq, 'alterado');
      result.changed.push(titleOf(t, lattes));
      continue;
    }

    // Um item novo no Lattes.
    if (!type) {
      skip('o tipo do item não tem lugar no currículo do editor');
      continue;
    }
    const seq = nextFree([working, base], result.counter);
    const item = newItem(lattesSchema, t.element, seq);
    applyReading(t, item, reading);
    pruneEmptyExtras(item);
    insertItem(working, type, item);
    insertItem(base, type, structuredClone(item));
    result.counter = seq + 1;
    mark(String(seq), 'novo');
    result.added.push(titleOf(t, item));
  }
  return result;
}
