// De uma mudança do editor à operação de alterar no lugar um item de produção,
// orientação ou banca (types.ts). Uma operação por mudança: cada uma confere e
// grava só os campos dela, e o resto do formulário vai como o Lattes tem.

import { enumLabel } from '../../labels/labels.ts';
import type { Change } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { childElements, element, getAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import type { BridgeOp, OpBase } from '../plan.ts';
import { AUTHOR_PART, type AuthorSpec, MAX_KEYWORDS } from './grids.ts';
import { lookupAttrs, planLookups, type ProductionLookups } from './lookups.ts';
import { planMembers } from './members.ts';
import { PRODUCTION_TARGETS } from './targets/index.ts';
import type { AuthorPart, FieldMap, ProductionTarget } from './types.ts';

/** Alterar no lugar produções, orientações e bancas. Ligada para o teste ao vivo. */
export const EDIT_PRODUCTION_ENABLED = true;

/**
 * Instituição, curso e agência de orientações e bancas pelas buscas do Lattes
 * (lookups.ts). Ligada para o teste ao vivo: nada disso foi visto em modo de
 * alteração no Lattes real.
 */
export const PRODUCTION_LOOKUPS_ENABLED = true;

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
  /** Parâmetros da lista que saem do item (ProductionTarget.list.paramsBy), com os valores de antes. */
  listParams?: Record<string, string>;
  /** Instituição, curso e agência escolhidos pelas buscas, resolvidos na hora de gravar. */
  lookups?: ProductionLookups;
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
  // Um atributo do próprio item (o projeto guarda os campos nele, e não numa
  // parte) também conta; o item novo, não, que é inclusão.
  const start = removedPart || change.kind === 'alterado' ? 1 : 2;
  for (let i = chain.length - start; i >= 0; i--) {
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

/** Os autores (ou participantes) de um item, na ordem de autoria. */
function authorsOf(els: XElement[], part: AuthorPart = AUTHOR_PART): AuthorSpec[] {
  return [...els]
    .sort((a, b) => Number(getAttr(a, part.order) ?? 0) - Number(getAttr(b, part.order) ?? 0))
    .map((a) => ({
      citation: getAttr(a, part.citation) ?? '',
      cnpq: getAttr(a, part.cnpq) ?? '',
      name: getAttr(a, part.name) ?? '',
    }));
}

const KEYWORD_ATTRS = Array.from({ length: MAX_KEYWORDS }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

/** A operação, ou o motivo de ficar à mão. */
export function planProduction(
  change: Change,
  chain: XElement[],
  label: string,
  siblings: readonly Change[] = [],
): ProductionOp | { reason: string } {
  const found = itemOf(change, chain);
  const el = chain.at(-1);
  if (!found || !el || (el.name !== change.element && change.kind !== 'removido')) {
    return { reason: 'O item não existe mais na cópia de trabalho' };
  }
  const { item, target } = found;
  const byHand = target.byHand?.[change.element];
  if (byHand) return { reason: byHand };
  // Título e ano do Lattes: os de antes, quando a própria mudança os troca.
  const before = (child: string, attr: string) => {
    const f = change.element === child ? change.fields.find((x) => x.attr === attr) : undefined;
    if (f) return f.before;
    const part = child === item.name ? item : childElements(item, child)[0];
    return (part && getAttr(part, attr)) ?? '';
  };
  const match = {
    title: before(target.title.child, target.title.attr).trim(),
    year: before(target.year.child, target.year.attr).trim(),
  };
  if (!match.title || !match.year) {
    return { reason: 'O item não tem título ou ano para achar a linha no Lattes' };
  }
  // Uma grade que o conector não sabe montar: com conteúdo no editor, o
  // Lattes também tem, e o envio a apagaria.
  const filled = (target.opaqueGrids ?? []).filter((g) =>
    childElements(item, g.element).some((c) => childElements(c).length > 0 || c.attrs.length > 0),
  );
  if (filled.length > 0) {
    return {
      reason: `O item tem ${filled.map((g) => g.label).join(', ')}, que o conector não sabe reenviar ao Lattes; alterar este item vai à mão`,
    };
  }
  const by = target.list.paramsBy;
  const listParam = by && by.values[before(by.child, by.attr)];
  if (by && !listParam) return { reason: 'O item não diz em que lista do Lattes ele está' };
  const base = {
    expect: {},
    key: change.key,
    kind: 'producao' as const,
    label,
    ...(by && listParam ? { listParams: { [by.param]: listParam } } : {}),
    match,
    set: {},
    target: target.id,
  };

  // A equipe do projeto: as pessoas num contêiner e com a marca de
  // coordenador, com as outras mudanças da fila na mesma grade (members.ts).
  const team = target.authors;
  if (team?.container && (change.element === team.element || change.element === team.container)) {
    return planMembers(
      change,
      item,
      { ...team, container: team.container },
      base,
      chain[0],
      siblings,
    );
  }

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

  const part = target.authors ?? AUTHOR_PART;
  if (change.element === part.element) {
    if (!target.grids.includes('f_autores_l')) {
      return { reason: 'O formulário deste tipo no Lattes não tem a lista de autores' };
    }
    const kept = part.sent;
    const notSent = kept ? change.fields.filter((f) => !kept.includes(f.attr)) : [];
    if (change.kind === 'alterado' && notSent.length > 0) {
      return {
        reason: `A grade de ${part.label.toLowerCase()} do Lattes não leva: ${notSent.map((f) => f.label).join(', ')}`,
      };
    }
    const current = childElements(item, part.element);
    const after = authorsOf(current, part);
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
              element(
                part.element,
                Object.fromEntries(change.fields.map((f) => [f.attr, f.before])),
              ),
            ]
          : current.map((a) => (a === el ? revert(a) : a));
    const authors = { after, before: authorsOf(beforeEls, part) };
    const names = (list: AuthorSpec[]) => list.map((a) => a.name).join('; ');
    return {
      ...base,
      authors,
      expect: { f_autores_l: names(authors.before) },
      rows: [
        {
          after: names(after),
          before: names(authors.before),
          label: part.label,
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
  // Instituição, curso e agência: pela escolha na lista do Lattes (lookups.ts).
  const spec = target.lookups;
  const chosen = spec && change.element === spec.child ? new Set(lookupAttrs(spec)) : new Set();
  let lookups: ProductionLookups | undefined;
  if (spec && change.fields.some((f) => chosen.has(f.attr))) {
    const planned = planLookups(change, spec, el);
    if ('reason' in planned) return planned;
    lookups = planned.lookups;
    rows.push(...planned.rows);
  }
  const unknown: string[] = [];
  const unmapped: string[] = [];
  const manual = new Map<string, string[]>();
  for (const f of change.fields.filter((x) => !chosen.has(x.attr))) {
    const key = `${change.element}@${f.attr}`;
    const m = target.fields[key];
    const why = target.manual?.[key];
    if (!m && why) manual.set(why, [...(manual.get(why) ?? []), f.label]);
    if (!m) {
      if (!why) unknown.push(f.label);
      continue;
    }
    const { field, toForm, unmapped: noValue } = mapOf(m);
    const after = toForm ? toForm(f.after, 'after') : f.after;
    const was = toForm ? toForm(f.before, 'before') : f.before;
    if (after === undefined || was === undefined) {
      if (noValue) return { reason: noValue };
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
  if (manual.size > 0) {
    return {
      reason: [...manual].map(([why, labels]) => `${labels.join(', ')}: ${why}`).join('; '),
    };
  }
  if (unmapped.length > 0) {
    return { reason: `Valor sem correspondência no formulário do Lattes: ${unmapped.join(', ')}` };
  }
  if (rows.length === 0) return { reason: 'Nada a enviar' };
  return { ...base, expect, ...(lookups ? { lookups } : {}), rows, set };
}

/** Para conferir sem acento, caixa nem espaço nas pontas. */
export const folded = (v: string | null | undefined) => foldText((v ?? '').trim());
