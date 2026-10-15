// Os achados do diagnóstico do currículo (LAT-25): o que o formulário de cada
// item já confere (obrigatórios, listas do Lattes, anos, autores e DOI, em
// src/model/validate.ts), agora de uma vez para todos os itens, junto com a
// revisão de consistência (LAT-29, src/review/consistency.ts). O editor
// aponta e a pessoa decide: nada aqui muda o currículo.
//
// Os itens são os mesmos que a navegação mostra (src/ui/sections.ts), na
// ordem do menu, e cada achado leva ao grupo onde o item aparece.

import { elementLabel } from '../labels/labels.ts';
import { type Problem, type ProblemKind, validateItem } from '../model/validate.ts';
import type { XElement } from '../model/xml.ts';
import type { LattesSchema } from '../schema/types.ts';
import { itemMeta } from '../ui/item-meta.ts';
import { groupItemList, type Section } from '../ui/sections.ts';
import { type Finding, reviewCv } from './consistency.ts';
import { type Place, placeIndex } from './locate.ts';

/** Os grupos de conferência, na ordem em que aparecem no painel. */
export const CATEGORIES = [
  'obrigatorio',
  'lista',
  'ano',
  'autores',
  'doi',
  'consistencia',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  ano: 'Anos',
  autores: 'Autores',
  consistencia: 'Consistência',
  doi: 'DOI',
  lista: 'Listas',
  obrigatorio: 'Obrigatórios',
};

/**
 * "erro": o Lattes recusa ou descarta o item como está (o schema ou a lista
 * do formulário não aceitam). "aviso" e "nota" vêm da revisão de
 * consistência: provavelmente precisa de correção, ou vale conferir.
 */
export type Severity = 'aviso' | 'erro' | 'nota';

export interface Check {
  category: Category;
  message: string;
  severity: Severity;
}

export interface ItemReport {
  checks: Check[];
  item: XElement;
  place?: Place;
  title: string;
}

export interface CvValidation {
  /** Quantos achados há em cada grupo de conferência. */
  byCategory: Record<Category, number>;
  /** Quantos achados há de cada gravidade. */
  bySeverity: Record<Severity, number>;
  /** Só os itens com algum achado, na ordem do menu. */
  items: ItemReport[];
  /** Quantos itens e blocos foram conferidos. */
  total: number;
}

const KIND_CATEGORY: Record<ProblemKind, Category> = {
  ano: 'ano',
  autores: 'autores',
  doi: 'doi',
  lista: 'lista',
  obrigatorio: 'obrigatorio',
};

const SEVERITY_ORDER: Record<Severity, number> = { aviso: 1, erro: 0, nota: 2 };

interface Unit {
  /** Bloco de campos (Identificação, Endereço), sem a regra de título e autoria. */
  block: boolean;
  el: XElement;
  place: Place;
  title: string;
}

/**
 * Cada item de lista e cada bloco de campos das seções, uma vez só: um item
 * que aparece em duas seções fica com a primeira em que é item de lista (o
 * projeto fica em Projetos, não dentro da atuação). As seções-filtro
 * (Inovação, Educação) só repetem itens de outras.
 */
function unitsOf(sections: Section[]): Unit[] {
  const units: Unit[] = [];
  const seen = new Set<XElement>();
  for (const s of sections) {
    if (s.importable === 'filtro') continue;
    for (const g of s.groups) {
      const place = { anchor: g.id, groupLabel: g.label, sectionId: s.id, sectionLabel: s.label };
      const list = groupItemList(g);
      const add = (el: XElement, block: boolean, title: string) => {
        if (seen.has(el)) return;
        seen.add(el);
        units.push({ block, el, place, title });
      };
      if (list) {
        for (const item of list.items) {
          add(item, false, itemMeta(item).title || elementLabel(item.name));
        }
      } else {
        for (const el of g.elements) add(el, true, g.label);
      }
    }
  }
  return units;
}

function fromProblem(p: Problem): Check {
  return { category: KIND_CATEGORY[p.kind], message: p.message, severity: 'erro' };
}

/** Os achados da revisão de consistência (LAT-29) ficam juntos, em "Consistência". */
function fromFinding(f: Finding): Check {
  return { category: 'consistencia', message: f.message, severity: f.severity };
}

/**
 * Confere o currículo inteiro. `sections` é a navegação do mesmo documento
 * (buildSections); `today` fixa o ano corrente nos testes.
 */
export function validateCv(
  schema: LattesSchema,
  root: XElement,
  sections: Section[],
  today = new Date(),
): CvValidation {
  const units = unitsOf(sections);
  const own = new Set(units.filter((u) => !u.block).map((u) => u.el));
  const reports = new Map<XElement, ItemReport>();
  const reportOf = (el: XElement, place: Place | undefined, title: string) => {
    let r = reports.get(el);
    if (!r) {
      r = { checks: [], item: el, place, title };
      reports.set(el, r);
    }
    return r;
  };

  for (const u of units) {
    // Um item dentro de outro (o projeto na atuação) é conferido por conta própria.
    const skip = (child: XElement) => child !== u.el && own.has(child);
    const problems = validateItem(schema, u.el, today, skip);
    if (problems.length) {
      reportOf(u.el, u.place, u.title).checks.push(...problems.map(fromProblem));
    }
  }

  const placed = new Map(units.map((u) => [u.el, u]));
  const fallback = placeIndex(sections);
  for (const f of reviewCv(root, today)) {
    const unit = placed.get(f.item);
    reportOf(f.item, unit?.place ?? fallback.get(f.item), unit?.title ?? f.title).checks.push(
      fromFinding(f),
    );
  }

  // Na ordem do menu (a das unidades); achados de itens fora delas vão para o fim.
  const order = new Map(units.map((u, i) => [u.el, i]));
  const items = [...reports.values()].sort(
    (a, b) => (order.get(a.item) ?? Infinity) - (order.get(b.item) ?? Infinity),
  );
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const bySeverity: Record<Severity, number> = { aviso: 0, erro: 0, nota: 0 };
  for (const r of items) {
    r.checks.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    for (const c of r.checks) {
      byCategory[c.category] += 1;
      bySeverity[c.severity] += 1;
    }
  }
  return { byCategory, bySeverity, items, total: units.length };
}

/** Os itens com algum achado do grupo escolhido, só com os achados dele. */
export function onlyCategory(items: ItemReport[], category?: Category): ItemReport[] {
  if (!category) return items;
  return items
    .map((r) => ({ ...r, checks: r.checks.filter((c) => c.category === category) }))
    .filter((r) => r.checks.length > 0);
}

/** A gravidade mais alta de um item, para a etiqueta da linha. */
export function worst(report: ItemReport): Severity {
  return report.checks[0]?.severity ?? 'nota';
}

/**
 * A linha curta do resumo: "2 para corrigir · 3 para conferir". Os avisos da
 * revisão de consistência contam como "corrigir?" junto com as notas, em
 * "para conferir", porque o editor não tem certeza deles.
 */
export function summaryLine(v: Pick<CvValidation, 'bySeverity'>): string {
  const fix = v.bySeverity.erro;
  const check = v.bySeverity.aviso + v.bySeverity.nota;
  const parts = [
    ...(fix ? [`${fix} para corrigir`] : []),
    ...(check ? [`${check} para conferir`] : []),
  ];
  return parts.length ? parts.join(' · ') : 'Nada a corrigir';
}
