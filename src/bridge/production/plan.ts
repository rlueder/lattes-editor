// De uma mudança do editor à operação de alterar no lugar um item de produção,
// orientação ou banca (types.ts). Uma operação por mudança: cada uma confere e
// grava só os campos dela, e o resto do formulário vai como o Lattes tem.

import { enumLabel } from '../../labels/labels.ts';
import type { Change } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { childElements, element, getAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { areaLabel, type AreaRow } from '../areas-atuacao.ts';
import type { BridgeOp, OpBase } from '../plan.ts';
import { fieldsLeft } from './fields-left.ts';
import { AUTHOR_PART, authorsOf, type AuthorSpec, MAX_KEYWORDS } from './grids.ts';
import { planHolder, withoutHolderCopies } from './holders.ts';
import {
  type AreaList,
  isAreaChange,
  type LabelList,
  planAreaList,
  planSetorList,
} from './item-lists.ts';
import { lookupAttrs, planLookups, type ProductionLookups } from './lookups.ts';
import { planMembers } from './members.ts';
import { planNatureSwap } from './nature.ts';
import { isOrganChange, type OrganChoice, planOrgan } from './organ.ts';
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

/**
 * Órgão e unidade do projeto pela janela de órgãos do Lattes (organ.ts).
 * Desligada: no teste ao vivo de 18/10/2026 o Lattes recebeu o envio com o
 * código e o texto do órgão novo e continuou mostrando o de antes, tanto
 * para uma unidade quanto para outro órgão. Falta ver se a própria página
 * consegue trocar o órgão na alteração.
 */
export const PROJECT_ORGAN_ENABLED = false;

/** Uma linha do que muda, como o painel e o editor mostram. */
export interface ProductionRow {
  after: string;
  before: string;
  label: string;
  name: string;
}

export interface ProductionOp extends OpBase {
  /** Áreas do conhecimento antes e depois, quando a mudança é delas (item-lists.ts). */
  areas?: AreaList;
  /** Autores antes e depois, na ordem, quando a mudança é deles. */
  authors?: { after: AuthorSpec[]; before: AuthorSpec[] };
  /**
   * O depositante ou titular pessoa antes e depois (ProductionTarget.holders),
   * quando a mudança é dele: um nome só, ou vazio.
   */
  holders?: { after: string; before: string };
  /** Palavras-chave antes e depois, na ordem, quando a mudança é delas. */
  keywords?: { after: string[]; before: string[] };
  kind: 'producao';
  /** Parâmetros da lista que saem do item (ProductionTarget.list.paramsBy), com os valores de antes. */
  listParams?: Record<string, string>;
  /** Instituição, curso e agência escolhidos pelas buscas, resolvidos na hora de gravar. */
  lookups?: ProductionLookups;
  /** Título e ano do item no Lattes (os de antes, se a mudança troca um deles), para achar a linha. */
  match: { title: string; year: string };
  /** Órgão ou unidade do projeto, pela janela de órgãos, resolvido na hora de gravar (organ.ts). */
  organ?: OrganChoice;
  /** O que muda, com rótulos e valores como se leem. */
  rows: ProductionRow[];
  /** Setores de atividade antes e depois, quando a mudança é deles. */
  setores?: LabelList;
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
  // O órgão do projeto fica na participação, que é o pai dele (organ.ts).
  const holder = chain.at(-1);
  if (change.kind === 'alterado' && holder && isOrganChange(change)) {
    const item = childElements(holder).find((c) =>
      PRODUCTION_TARGETS.some((t) => t.organ && t.element === c.name),
    );
    const target = item && PRODUCTION_TARGETS.find((t) => t.element === item.name);
    return item && target ? { item, target } : undefined;
  }
  const start = removedPart || change.kind === 'alterado' ? 1 : 2;
  for (let i = chain.length - start; i >= 0; i--) {
    const target = PRODUCTION_TARGETS.find((t) => t.element === chain[i]!.name);
    if (target) return { item: chain[i]!, target };
  }
  return undefined;
}

/** Os autores ou participantes do item, quando a mudança é numa linha deles. */
export function authorPartOf(
  change: Change,
  chain: XElement[],
): { item: XElement; part: AuthorPart } | undefined {
  const found = itemOf(change, chain);
  if (!found || !found.target.grids.includes('f_autores_l')) return undefined;
  const part = found.target.authors ?? AUTHOR_PART;
  return change.element === part.element ? { item: found.item, part } : undefined;
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

const KEYWORD_ATTRS = Array.from({ length: MAX_KEYWORDS }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

/** A operação, ou o motivo de ficar à mão. */
export function planProduction(
  change: Change,
  chain: XElement[],
  label: string,
  siblings: readonly Change[] = [],
  extras: Readonly<Record<string, Readonly<Record<string, string>>>> = {},
): ProductionOp | { reason: string } {
  const found = itemOf(change, chain);
  const el = chain.at(-1);
  if (!found || !el || (el.name !== change.element && change.kind !== 'removido')) {
    return { reason: 'O item não existe mais na cópia de trabalho' };
  }
  const { item, target } = found;
  const organChange =
    target.organ !== undefined && change.element !== item.name && isOrganChange(change);
  const byHand = organChange ? undefined : target.byHand?.[change.element];
  if (byHand) return { reason: byHand };
  // O campo que depende da própria parte (a data do histórico da patente).
  const partMap = organChange ? undefined : target.partFields?.[change.element]?.(change, el, item);
  if (partMap && 'reason' in partMap) return partMap;
  // Título e ano do Lattes: os de antes, quando a própria mudança os troca.
  const before = (child: string, attr: string) => {
    const f = change.element === child ? change.fields.find((x) => x.attr === attr) : undefined;
    if (f) return f.before;
    // O filho pode estar mais fundo (o REGISTRO-OU-PATENTE fica dentro do
    // detalhamento do software).
    const find = (el: XElement): XElement | undefined => {
      for (const c of childElements(el)) {
        if (c.name === child) return c;
        const deep = find(c);
        if (deep) return deep;
      }
      return undefined;
    };
    const part = child === item.name ? item : find(item);
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
  const byValue = by && before(by.child, by.attr);
  const listParam =
    by && (typeof by.values === 'function' ? by.values(byValue ?? '') : by.values[byValue ?? '']);
  if (by && listParam === undefined) {
    return { reason: 'O item não diz em que lista do Lattes ele está' };
  }
  const base = {
    expect: {},
    key: change.key,
    kind: 'producao' as const,
    label,
    ...(by && listParam !== undefined ? { listParams: { [by.param]: listParam } } : {}),
    match,
    set: {},
    target: target.id,
  };

  if (organChange) {
    const planned = planOrgan(change, el, target.organ!.periodReason);
    if ('reason' in planned) return planned;
    return { ...base, organ: planned.choice, rows: planned.rows };
  }

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

  // Áreas e setores: a lista inteira, como as palavras-chave (item-lists.ts).
  if (isAreaChange(change)) {
    if (!target.grids.includes('f_area_l')) {
      return { reason: 'O formulário deste tipo no Lattes não tem áreas do conhecimento' };
    }
    const areas = planAreaList(change, item);
    if ('reason' in areas) return areas;
    const text = (rows: AreaRow[]) => rows.map(areaLabel).join('; ');
    return {
      ...base,
      areas,
      expect: { f_area_l: text(areas.before) },
      rows: [
        {
          after: text(areas.after),
          before: text(areas.before),
          label: 'Áreas do conhecimento',
          name: 'f_area_l',
        },
      ],
      set: { f_area_l: text(areas.after) },
    };
  }
  if (change.element === 'SETORES-DE-ATIVIDADE') {
    if (!target.grids.includes('f_setor_l')) {
      return { reason: 'O formulário deste tipo no Lattes não tem setores de atividade' };
    }
    const setores = planSetorList(change, el);
    return {
      ...base,
      expect: { f_setor_l: setores.before.join('; ') },
      rows: [
        {
          after: setores.after.join('; '),
          before: setores.before.join('; '),
          label: 'Setores de atividade',
          name: 'f_setor_l',
        },
      ],
      set: { f_setor_l: setores.after.join('; ') },
      setores,
    };
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
      // O CPF não é coluna da grade (c, l, t, pais, add): o Lattes não tem
      // onde gravá-lo. A citação é coluna, mas a da linha não pega: ela vai
      // pelo dicionário de coautores (edit-citacao.ts).
      const noColumn = notSent.every((f) => f.attr.startsWith('CPF'));
      return {
        reason: `A grade de ${part.label.toLowerCase()} do Lattes ${noColumn ? 'não tem' : 'não leva'}: ${notSent.map((f) => f.label).join(', ')}`,
      };
    }
    const current = childElements(item, part.element);
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
    // Os depositantes que a exportação copia nos autores ficam de fora (holders.ts).
    const lists = withoutHolderCopies(target, item, chain[0], siblings, change, part.name, {
      after: current,
      before: beforeEls,
    });
    if ('reason' in lists) return lists;
    const after = authorsOf(lists.after, part);
    const authors = { after, before: authorsOf(lists.before, part) };
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
  let holders: ProductionOp['holders'];
  const holderKey = target.holders && `${target.holders.child}@${target.holders.attr}`;
  const unknown: string[] = [];
  const unmapped: string[] = [];
  const manual = new Map<string, string[]>();
  for (const f of change.fields.filter((x) => !chosen.has(x.attr))) {
    const key = `${change.element}@${f.attr}`;
    // Um valor que pede texto fora do XML (target.asks): o que a pessoa escreveu.
    const ask = target.asks?.[key];
    if (ask && f.after === ask.when) {
      const text = extras[change.key]?.[ask.field]?.trim() ?? '';
      if (!text) return { reason: ask.reason };
      if (text.length > ask.maxLength) {
        return { reason: `${f.label}: o texto passa de ${ask.maxLength} caracteres` };
      }
      const m = target.fields[key];
      const map = m ? mapOf(m) : undefined;
      const was = map?.toForm ? map.toForm(f.before, 'before') : f.before;
      set[ask.flag[0]] = ask.flag[1];
      set[ask.field] = text;
      if (was !== undefined) expect[ask.flag[0]] = was;
      rows.push({
        after: shown(f.after),
        before: shown(f.before),
        label: f.label,
        name: ask.flag[0],
      });
      continue;
    }
    // O depositante pessoa: a grade de depositantes, com um nome só (holders.ts).
    if (key === holderKey) {
      const value = planHolder(f);
      if ('reason' in value) return value;
      holders = value;
      set.f_depositante_pessoa_l = value.after;
      expect.f_depositante_pessoa_l = value.before;
      rows.push({ ...value, label: f.label, name: 'f_depositante_pessoa_l' });
      continue;
    }
    const m = partMap?.fields[f.attr] ?? target.fields[key];
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
  const left = fieldsLeft(unknown, manual, unmapped);
  if (left) return left;
  if (rows.length === 0) return { reason: 'Nada a enviar' };
  // A natureza trocada no lugar: os ocultos limpos e a instituição e o curso
  // escolhidos de novo com o nível dela (nature.ts).
  const swapped = planNatureSwap(target, change, item, set, expect, siblings);
  if (swapped && 'reason' in swapped) return swapped;
  if (swapped?.lookups) lookups = swapped.lookups;
  // O que a página limpa junto (target.clears), sem conferir o antes.
  for (const [when, also] of Object.entries(target.clears ?? {})) {
    const [field, value] = when.split('=') as [string, string];
    if (set[field] === value) Object.assign(set, also);
  }
  return { ...base, expect, ...(holders && { holders }), ...(lookups && { lookups }), rows, set };
}

/** Para conferir sem acento, caixa nem espaço nas pontas. */
export const folded = (v: string | null | undefined) => foldText((v ?? '').trim());
