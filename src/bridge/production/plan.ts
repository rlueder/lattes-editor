// De uma mudança do editor à operação de alterar no lugar um item de produção,
// orientação ou banca (types.ts). Uma operação por mudança: cada uma confere e
// grava só os campos dela, e o resto do formulário vai como o Lattes tem.

import { enumLabel } from '../../labels/labels.ts';
import type { Change } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { childElements, element, getAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import type { BridgeOp, OpBase } from '../plan.ts';
import { type AuthorSpec, MAX_KEYWORDS } from './grids.ts';
import { PRODUCTION_TARGETS } from './targets/index.ts';
import type { FieldMap, ProductionTarget } from './types.ts';

/** Alterar no lugar produções, orientações e bancas. Ligada para o teste ao vivo. */
export const EDIT_PRODUCTION_ENABLED = true;

/** Uma linha do que muda, como o painel e o editor mostram. */
export interface ProductionRow {
  after: string;
  before: string;
  label: string;
  name: string;
}

export interface ProductionOp extends OpBase {
  /** Autores antes e depois, na ordem, quando a mudança é deles. */
  authors?: { after: AuthorSpec[]; before: AuthorSpec[] };
  /** Palavras-chave antes e depois, na ordem, quando a mudança é delas. */
  keywords?: { after: string[]; before: string[] };
  kind: 'producao';
  /** Título e ano do item no Lattes (os de antes, se a mudança troca um deles), para achar a linha. */
  match: { title: string; year: string };
  /** O que muda, com rótulos e valores como se leem. */
  rows: ProductionRow[];
  /** O tipo (ProductionTarget.id). */
  target: string;
}

export function isProductionOp(op: BridgeOp): op is ProductionOp {
  return op.kind === 'producao';
}

export function productionTarget(id: string): ProductionTarget | undefined {
  return PRODUCTION_TARGETS.find((t) => t.id === id);
}

/**
 * O item de um tipo registrado mais perto da mudança, e o tipo dele. Numa
 * parte excluída (um autor, as palavras-chave), o caminho na cópia para no
 * próprio item; a exclusão do item inteiro fica fora (delete.ts).
 */
function itemOf(
  change: Change,
  chain: XElement[],
): { item: XElement; target: ProductionTarget } | undefined {
  const removedPart =
    change.kind === 'removido' && !PRODUCTION_TARGETS.some((t) => t.element === change.element);
  for (let i = chain.length - (removedPart ? 1 : 2); i >= 0; i--) {
    const target = PRODUCTION_TARGETS.find((t) => t.element === chain[i]!.name);
    if (target) return { item: chain[i]!, target };
  }
  return undefined;
}

/** A mudança é de um item que o motor altera (e não a inclusão ou exclusão do item)? */
export function isProductionChange(change: Change, chain: XElement[]): boolean {
  return itemOf(change, chain) !== undefined;
}

const mapOf = (m: FieldMap | string): FieldMap => (typeof m === 'string' ? { field: m } : m);

/** Valor do XML como se lê: Sim/Não e os enumerados pelo rótulo. */
function shown(value: string): string {
  if (!value) return '';
  if (value === 'SIM') return 'Sim';
  if (value === 'NAO') return 'Não';
  const isEnum = Object.values(lattesSchema.elements).some((e) =>
    e.attributes.some((a) => a.enum?.includes(value)),
  );
  return isEnum ? enumLabel(value) : value;
}

/** Os autores de um item, na ordem de autoria. */
function authorsOf(els: XElement[]): AuthorSpec[] {
  return [...els]
    .sort(
      (a, b) =>
        Number(getAttr(a, 'ORDEM-DE-AUTORIA') ?? 0) - Number(getAttr(b, 'ORDEM-DE-AUTORIA') ?? 0),
    )
    .map((a) => ({
      citation: getAttr(a, 'NOME-PARA-CITACAO') ?? '',
      cnpq: getAttr(a, 'NRO-ID-CNPQ') ?? '',
      name: getAttr(a, 'NOME-COMPLETO-DO-AUTOR') ?? '',
    }));
}

const KEYWORD_ATTRS = Array.from({ length: MAX_KEYWORDS }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

/** A operação, ou o motivo de ficar à mão. */
export function planProduction(
  change: Change,
  chain: XElement[],
  label: string,
): ProductionOp | { reason: string } {
  const found = itemOf(change, chain);
  const el = chain.at(-1);
  if (!found || !el || (el.name !== change.element && change.kind !== 'removido')) {
    return { reason: 'O item não existe mais na cópia de trabalho' };
  }
  const { item, target } = found;
  // Título e ano do Lattes: os de antes, quando a própria mudança os troca.
  const before = (child: string, attr: string) => {
    const f = change.element === child ? change.fields.find((x) => x.attr === attr) : undefined;
    if (f) return f.before;
    const part = childElements(item, child)[0];
    return (part && getAttr(part, attr)) ?? '';
  };
  const match = {
    title: before(target.title.child, target.title.attr).trim(),
    year: before(target.year.child, target.year.attr).trim(),
  };
  if (!match.title || !match.year) {
    return { reason: 'O item não tem título ou ano para achar a linha no Lattes' };
  }
  const base = {
    expect: {},
    key: change.key,
    kind: 'producao' as const,
    label,
    match,
    set: {},
    target: target.id,
  };

  if (change.element === 'PALAVRAS-CHAVE') {
    if (!target.grids.includes('f_plv_l')) {
      return { reason: 'O formulário deste tipo no Lattes não tem palavras-chave' };
    }
    const now = KEYWORD_ATTRS.map((a) =>
      change.kind === 'removido' ? '' : (getAttr(el, a) ?? ''),
    );
    const was = KEYWORD_ATTRS.map((a, i) => {
      const f = change.fields.find((x) => x.attr === a);
      return f ? f.before : change.kind === 'novo' ? '' : now[i]!;
    });
    const words = (list: string[]) => list.map((w) => w.trim()).filter(Boolean);
    const keywords = { after: words(now), before: words(was) };
    if (keywords.after.some((w) => /[|@]/.test(w))) {
      return { reason: 'Palavra-chave com "|" ou "@", que o Lattes usa para separar a grade' };
    }
    return {
      ...base,
      expect: { f_plv_l: keywords.before.join(', ') },
      keywords,
      rows: [
        {
          after: keywords.after.join(', '),
          before: keywords.before.join(', '),
          label: 'Palavras-chave',
          name: 'f_plv_l',
        },
      ],
      set: { f_plv_l: keywords.after.join(', ') },
    };
  }

  if (change.element === 'AUTORES') {
    if (!target.grids.includes('f_autores_l')) {
      return { reason: 'O formulário deste tipo no Lattes não tem a lista de autores' };
    }
    const current = childElements(item, 'AUTORES');
    const after = authorsOf(current);
    // O antes: a lista de agora com esta mudança desfeita.
    const revert = (a: XElement) => ({
      ...a,
      attrs: a.attrs.map((x) => {
        const f = change.fields.find((y) => y.attr === x.name);
        return f ? { ...x, value: f.before } : x;
      }),
    });
    const beforeEls =
      change.kind === 'novo'
        ? current.filter((a) => a !== el)
        : change.kind === 'removido'
          ? [
              ...current,
              element('AUTORES', Object.fromEntries(change.fields.map((f) => [f.attr, f.before]))),
            ]
          : current.map((a) => (a === el ? revert(a) : a));
    const authors = { after, before: authorsOf(beforeEls) };
    const names = (list: AuthorSpec[]) => list.map((a) => a.name).join('; ');
    return {
      ...base,
      authors,
      expect: { f_autores_l: names(authors.before) },
      rows: [
        {
          after: names(after),
          before: names(authors.before),
          label: 'Autores',
          name: 'f_autores_l',
        },
      ],
      set: { f_autores_l: names(after) },
    };
  }

  if (change.kind !== 'alterado' && change.kind !== 'novo') {
    return { reason: 'Excluir esta parte do item pelo conector: não suportado ainda' };
  }
  const set: Record<string, string> = {};
  const expect: Record<string, string> = {};
  const rows: ProductionRow[] = [];
  const unknown: string[] = [];
  const unmapped: string[] = [];
  const manual: string[] = [];
  for (const f of change.fields) {
    const key = `${change.element}@${f.attr}`;
    const m = target.fields[key];
    const why = target.manual?.[key];
    if (!m) {
      if (why) manual.push(`${f.label}: ${why}`);
      else unknown.push(f.label);
      continue;
    }
    const { field, toForm } = mapOf(m);
    const after = toForm ? toForm(f.after) : f.after;
    const was = toForm ? toForm(f.before) : f.before;
    if (after === undefined || was === undefined) {
      unmapped.push(f.label);
      continue;
    }
    set[field] = after;
    expect[field] = was;
    rows.push({ after: shown(f.after), before: shown(f.before), label: f.label, name: field });
  }
  if (unknown.length > 0) {
    return { reason: `O formulário deste tipo no Lattes não tem: ${unknown.join(', ')}` };
  }
  if (manual.length > 0) return { reason: `Fica à mão. ${manual.join('; ')}` };
  if (unmapped.length > 0) {
    return { reason: `Valor sem correspondência no formulário do Lattes: ${unmapped.join(', ')}` };
  }
  if (rows.length === 0) return { reason: 'Nada a enviar' };
  return { ...base, expect, rows, set };
}

/** Para conferir sem acento, caixa nem espaço nas pontas. */
export const folded = (v: string | null | undefined) => foldText((v ?? '').trim());
