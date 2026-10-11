// As tabelas de apoio que o Lattes exporta em DADOS-COMPLEMENTARES
// (INFORMACOES-ADICIONAIS-INSTITUICOES e -CURSOS) guardam só código, sigla,
// país e área. O nome completo e o uso de cada entrada estão nos itens que
// apontam para o código (atuações, formações, cursos). Este módulo junta as
// duas pontas e define como essas listas se agrupam.

import { elementLabel, enumLabel } from '../labels/labels.ts';
import { getAttr, walk, type XElement } from '../model/xml.ts';
import { formatPeriod, itemMeta } from './item-meta.ts';
import type { CardInfo, ItemGroup, ListView, Usage } from './list-view.ts';

export interface RefEntry {
  /** Nome completo, tirado do primeiro item que referencia o código com nome. */
  name?: string;
  usages: Usage[];
}

export interface ReferenceIndex {
  courses: Map<string, RefEntry>;
  institutions: Map<string, RefEntry>;
}

const INSTITUTION_TABLE_ITEM = 'INFORMACAO-ADICIONAL-INSTITUICAO';
const COURSE_TABLE_ITEM = 'INFORMACAO-ADICIONAL-CURSO';
const INSTITUTION_CODE = /^CODIGO-INSTITUICAO(-|$)/;
const COURSE_CODE = /^CODIGO-CURSO(-|$)/;

/** Partes de um item (DADOS-BASICOS-*, DETALHAMENTO-*, VINCULOS) contam como o item. */
function owningItem(el: XElement, ancestors: readonly XElement[]): XElement {
  const isPart = (n: string) =>
    n.startsWith('DADOS-BASICOS') || n.startsWith('DETALHAMENTO') || n === 'VINCULOS';
  return isPart(el.name) && ancestors.length > 0 ? ancestors[ancestors.length - 1]! : el;
}

const attr = (el: XElement, name: string) => getAttr(el, name)?.trim() || undefined;

function courseArea(el: XElement): string {
  return [attr(el, 'NOME-DA-AREA-DO-CONHECIMENTO'), attr(el, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO')]
    .filter(Boolean)
    .join(' › ');
}

/** Nome do curso vindo de quem o referencia; sem isso, a área; sem área, o código. */
function courseTitle(el: XElement, courses: Map<string, RefEntry>): string {
  return (
    courses.get(attr(el, 'CODIGO-CURSO') ?? '')?.name ??
    (courseArea(el) || attr(el, 'CODIGO-CURSO') || '')
  );
}

export function buildReferenceIndex(root: XElement): ReferenceIndex {
  const institutions = new Map<string, RefEntry>();
  const courses = new Map<string, RefEntry>();
  const entry = (map: Map<string, RefEntry>, code: string) => {
    let e = map.get(code);
    if (!e) map.set(code, (e = { usages: [] }));
    return e;
  };

  // Primeira passada: nomes. CODIGO-X aponta para NOME-X no mesmo elemento.
  const refs: { code: string; item: XElement; map: Map<string, RefEntry> }[] = [];
  walk(root, (el, ancestors) => {
    for (const a of el.attrs) {
      const value = a.value.trim();
      if (!value) continue;
      const isInstitution = INSTITUTION_CODE.test(a.name) && el.name !== INSTITUTION_TABLE_ITEM;
      const isCourse = COURSE_CODE.test(a.name) && el.name !== COURSE_TABLE_ITEM;
      if (!isInstitution && !isCourse) continue;
      const map = isInstitution ? institutions : courses;
      const e = entry(map, value);
      const name = getAttr(el, a.name.replace(/^CODIGO/, 'NOME'))?.trim();
      if (name && !e.name) e.name = name;
      refs.push({ code: value, item: owningItem(el, ancestors), map });
    }
  });

  // Segunda passada: usos, um por item, já com os nomes de curso resolvidos.
  const seen = new Set<string>();
  const ids = new Map<XElement, number>();
  for (const { code, item, map } of refs) {
    if (!ids.has(item)) ids.set(item, ids.size);
    const key = `${map === institutions ? 'i' : 'c'}:${code}:${ids.get(item)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meta = itemMeta(item);
    const title = item.name === COURSE_TABLE_ITEM ? courseTitle(item, courses) : meta.title;
    entry(map, code).usages.push({
      kind: elementLabel(item.name),
      period: formatPeriod(meta),
      title,
    });
  }
  return { courses, institutions };
}

function usageCount(n: number): string | undefined {
  if (n === 0) return undefined;
  return n === 1 ? 'usada em 1 item' : `usada em ${n} itens`;
}

/** Agrupa por uma chave, com os grupos maiores primeiro e "sem" no fim. */
function groupByKey(
  items: XElement[],
  keyOf: (el: XElement) => string | undefined,
  emptyLabel: string,
  sortWithin: (a: XElement, b: XElement) => number,
): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();
  for (const el of items) {
    const label = keyOf(el) ?? emptyLabel;
    const key = label === emptyLabel ? 'sem' : label;
    if (!groups.has(key)) groups.set(key, { items: [], key, label });
    groups.get(key)!.items.push(el);
  }
  for (const g of groups.values()) g.items.sort(sortWithin);
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.key === 'sem') - Number(b.key === 'sem') ||
      b.items.length - a.items.length ||
      a.label.localeCompare(b.label, 'pt-BR'),
  );
}

export function institutionView(index: ReferenceIndex): ListView {
  const ref = (el: XElement) => index.institutions.get(attr(el, 'CODIGO-INSTITUICAO') ?? '');
  const uses = (el: XElement) => ref(el)?.usages.length ?? 0;
  const card = (el: XElement): CardInfo => {
    const sigla = attr(el, 'SIGLA-INSTITUICAO');
    const name = ref(el)?.name;
    const code = attr(el, 'CODIGO-INSTITUICAO');
    // Entrada só com código, sem sigla nem item que a cite: o arquivo não tem o nome.
    const title = sigla ?? name ?? 'Instituição sem nome no arquivo';
    const tags = [
      name && name !== title ? name : undefined,
      !sigla && !name && code ? `código ${code}` : undefined,
      !sigla && !name && uses(el) === 0 ? 'não aparece em nenhum item' : undefined,
      attr(el, 'SIGLA-UF-INSTITUICAO'),
      getAttr(el, 'FLAG-INSTITUICAO-DE-ENSINO') === 'SIM' ? 'instituição de ensino' : undefined,
      getAttr(el, 'FLAG-AGENCIA-FOMENTO') === 'SIM' ? 'agência de fomento' : undefined,
    ];
    return {
      aside: usageCount(uses(el)),
      subtitle: tags.filter(Boolean).join(' · '),
      title,
      usages: ref(el)?.usages,
    };
  };
  return {
    card,
    groups: (items) =>
      groupByKey(
        items,
        (el) => attr(el, 'NOME-PAIS-INSTITUICAO') ?? attr(el, 'SIGLA-PAIS-INSTITUICAO'),
        'Sem país',
        (a, b) => uses(b) - uses(a) || card(a).title.localeCompare(card(b).title, 'pt-BR'),
      ),
    ungroupedKey: 'sem',
  };
}

export function courseView(index: ReferenceIndex): ListView {
  const ref = (el: XElement) => index.courses.get(attr(el, 'CODIGO-CURSO') ?? '');
  const card = (el: XElement): CardInfo => {
    const area = courseArea(el);
    const level = attr(el, 'NIVEL-CURSO');
    const n = ref(el)?.usages.length ?? 0;
    return {
      aside: n === 0 ? undefined : n === 1 ? 'usado em 1 item' : `usado em ${n} itens`,
      subtitle: [attr(el, 'NOME-INSTITUICAO'), level && enumLabel(level), area]
        .filter(Boolean)
        .join(' · '),
      title: courseTitle(el, index.courses),
      usages: ref(el)?.usages,
    };
  };
  return {
    card,
    groups: (items) =>
      groupByKey(
        items,
        (el) => {
          const big = attr(el, 'NOME-GRANDE-AREA-DO-CONHECIMENTO');
          return big ? enumLabel(big) : undefined;
        },
        'Sem área',
        (a, b) => card(a).title.localeCompare(card(b).title, 'pt-BR'),
      ),
    ungroupedKey: 'sem',
  };
}

/** Listas que não são linha do tempo, pelo nome do contêiner. */
export function viewForContainer(name: string, index: ReferenceIndex): ListView | undefined {
  if (name === 'INFORMACOES-ADICIONAIS-INSTITUICOES') return institutionView(index);
  if (name === 'INFORMACOES-ADICIONAIS-CURSOS') return courseView(index);
  return undefined;
}
