// Metadados de um item de lista (atuação, formação, produção, evento…) para
// ordenar, agrupar por ano e resumir num cartão. Tudo sai dos atributos do
// próprio item, dos DADOS-BASICOS-*, DETALHAMENTO-* e VINCULOS filhos.

import { enumLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';

export interface ItemMeta {
  /** Sem ANO-FIM, FLAG-PERIODO=ATUAL ou curso em andamento. */
  current: boolean;
  end?: YearMonth;
  /** Ano de agrupamento; undefined = "sem ano". Itens atuais agrupam à parte. */
  groupYear?: number;
  /** Chave de ordenação decrescente. */
  sortKey: number;
  start?: YearMonth;
  subtitle: string;
  title: string;
  /** Ano de um item pontual (produção, evento, banca). */
  year?: number;
}

export interface YearMonth {
  month?: number;
  year: number;
}

export const START_ATTRS = ['ANO-INICIO', 'ANO-DE-INICIO'];
export const END_ATTRS = ['ANO-FIM', 'ANO-DE-CONCLUSAO'];
export const POINT_ATTRS = [
  'ANO-DO-TRABALHO',
  'ANO-DO-ARTIGO',
  'ANO-DO-TEXTO',
  'ANO',
  'ANO-DE-REALIZACAO',
  'ANO-DA-PREMIACAO',
  'ANO-DESENVOLVIMENTO',
  'ANO-SOLICITACAO',
  'ANO-DA-OBRA',
  'ANO-DE-OBTENCAO-DO-TITULO',
];
export const TITLE_ORDER: ((n: string) => boolean)[] = [
  (n) =>
    n.startsWith('TITULO') &&
    !n.endsWith('INGLES') &&
    !n.includes('ANAIS') &&
    !n.includes('PERIODICO'),
  (n) => n === 'NOME-CURSO',
  (n) => n === 'NOME-INSTITUICAO' || n === 'NOME-DA-INSTITUICAO',
  (n) => n === 'SIGLA-INSTITUICAO',
  (n) => n.startsWith('NOME') && !n.endsWith('INGLES') && !n.includes('CITACAO'),
  (n) => n.startsWith('DESCRICAO'),
];
export const SUBTITLE_ATTRS = [
  'NOME-DO-EVENTO',
  'TITULO-DO-PERIODICO-OU-REVISTA',
  'TITULO-DOS-ANAIS-OU-PROCEEDINGS',
  'TITULO-DO-JORNAL-OU-REVISTA',
  'NOME-DA-EDITORA',
  'NOME-INSTITUICAO',
  'NOME-DA-INSTITUICAO',
];

/** Forma de participação ou natureza, quando o item tem; vira o fim do subtítulo. */
const KIND_ATTRS = ['FORMA-PARTICIPACAO', 'TIPO-PARTICIPACAO', 'TIPO-DE-PARTICIPACAO'];

function int(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function firstValue(sources: XElement[], names: string[]): string | undefined {
  for (const name of names) {
    for (const s of sources) {
      const v = getAttr(s, name)?.trim();
      if (v) return v;
    }
  }
  return undefined;
}

/** Atributo enumerado no schema: guarda um código (CIENCIAS_SOCIAIS_APLICADAS), não um nome. */
function isEnum(element: string, attr: string): boolean {
  return Boolean(lattesSchema.elements[element]?.attributes.find((a) => a.name === attr)?.enum);
}

/** Primeiro valor de texto que passa no teste; códigos de enum nunca viram título. */
function pick(sources: XElement[], test: (name: string) => boolean): string | undefined {
  for (const s of sources) {
    const hit = s.attrs.find(
      (a) => test(a.name) && a.value.trim() !== '' && !isEnum(s.name, a.name),
    );
    if (hit) return hit.value.trim();
  }
  return undefined;
}

/** Área do conhecimento (AREA-DO-CONHECIMENTO-n, AREA-DE-ATUACAO): caminho e grande área. */
function knowledgeArea(el: XElement): { subtitle: string; title: string } | undefined {
  const big = getAttr(el, 'NOME-GRANDE-AREA-DO-CONHECIMENTO');
  if (big === undefined) return undefined;
  const path = [
    getAttr(el, 'NOME-DA-AREA-DO-CONHECIMENTO'),
    getAttr(el, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO'),
    getAttr(el, 'NOME-DA-ESPECIALIDADE'),
  ]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' › ');
  const bigLabel = big ? enumLabel(big) : '';
  return path ? { subtitle: bigLabel, title: path } : { subtitle: '', title: bigLabel };
}

/** Período de quem tem início e fim, juntando vários VINCULOS de uma atuação. */
function period(el: XElement, sources: XElement[]): Pick<ItemMeta, 'current' | 'end' | 'start'> {
  const holders = [el, ...childElements(el, 'VINCULOS'), ...sources.slice(1)];
  let start: YearMonth | undefined;
  let end: YearMonth | undefined;
  let current = false;
  for (const h of holders) {
    const sYear = int(firstValue([h], START_ATTRS));
    if (sYear === undefined) continue;
    const s = { month: int(getAttr(h, 'MES-INICIO')), year: sYear };
    if (!start || compare(s, start) < 0) start = s;
    const eYear = int(firstValue([h], END_ATTRS));
    const flaggedCurrent =
      getAttr(h, 'FLAG-PERIODO') === 'ATUAL' || getAttr(h, 'STATUS-DO-CURSO') === 'EM_ANDAMENTO';
    if (eYear === undefined || flaggedCurrent) current = true;
    else {
      const e = { month: int(getAttr(h, 'MES-FIM')), year: eYear };
      if (!end || compare(e, end) > 0) end = e;
    }
  }
  return { current, end: current ? undefined : end, start };
}

function compare(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || (a.month ?? 0) - (b.month ?? 0);
}

/** Papel na atuação: enquadramento do vínculo mais recente. */
function role(el: XElement): string | undefined {
  const vinculos = childElements(el, 'VINCULOS');
  const latest = [...vinculos].sort(
    (a, b) => (int(getAttr(b, 'ANO-INICIO')) ?? 0) - (int(getAttr(a, 'ANO-INICIO')) ?? 0),
  )[0];
  if (!latest) return undefined;
  const free = getAttr(latest, 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO')?.trim();
  if (free) return free;
  const coded = getAttr(latest, 'ENQUADRAMENTO-FUNCIONAL');
  return coded && coded !== 'OUTRO' && coded !== 'LIVRE' ? enumLabel(coded) : undefined;
}

export function itemMeta(el: XElement): ItemMeta {
  const basics = childElements(el).filter((c) => c.name.startsWith('DADOS-BASICOS'));
  const details = childElements(el).filter((c) => c.name.startsWith('DETALHAMENTO'));
  const sources = [el, ...basics];

  let title = '';
  for (const test of TITLE_ORDER) {
    title = pick(sources, test) ?? '';
    if (title) break;
  }
  const area = knowledgeArea(el);

  const venues = SUBTITLE_ATTRS.map((n) => firstValue([...details, ...sources], [n])).filter(
    (v): v is string => v !== undefined && v !== title,
  );
  // Participação em evento costuma ter TITULO vazio; o nome do evento vira o título.
  if (!title && venues.length) title = venues.shift()!;
  const kind = firstValue(sources, KIND_ATTRS);
  let subtitle = [role(el), venues[0], kind && enumLabel(kind)].filter(Boolean).join(' · ');
  if (area) {
    title = area.title;
    subtitle = area.subtitle;
  }

  const { current, end, start } = period(el, sources);
  const year = start ? undefined : int(firstValue(sources, POINT_ATTRS));

  const groupYear = current ? undefined : (end?.year ?? year ?? start?.year);
  const sortKey = current
    ? 10_000_000 + (start?.year ?? 0) * 100 + (start?.month ?? 0)
    : (groupYear ?? 0) * 100 + (end?.month ?? start?.month ?? 0);

  return { current, end, groupYear, sortKey, start, subtitle, title, year };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmt(ym: YearMonth): string {
  const m = ym.month && ym.month >= 1 && ym.month <= 12 ? `${MONTHS[ym.month - 1]} ` : '';
  return `${m}${ym.year}`;
}

/** "mar 2019 – atual", "2004 – 2007" ou "2023". */
export function formatPeriod(meta: ItemMeta): string {
  if (meta.start) {
    const end = meta.current ? 'atual' : meta.end ? fmt(meta.end) : '';
    if (end && meta.end?.year === meta.start.year && !meta.start.month && !meta.end.month) {
      return String(meta.start.year);
    }
    return end ? `${fmt(meta.start)} – ${end}` : fmt(meta.start);
  }
  return meta.year ? String(meta.year) : '';
}

/** Duração em anos e meses, quando há início; usa hoje para itens atuais. */
export function formatDuration(meta: ItemMeta, today = new Date()): string {
  if (!meta.start) return '';
  const end: YearMonth = meta.current
    ? { month: today.getMonth() + 1, year: today.getFullYear() }
    : (meta.end ?? meta.start);
  const hasMonths = meta.start.month !== undefined && end.month !== undefined;
  const months = hasMonths
    ? (end.year - meta.start.year) * 12 + (end.month! - meta.start.month!) + 1
    : (end.year - meta.start.year) * 12;
  if (months <= 0) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? 'ano' : 'anos'}` : '';
  const m = hasMonths && rest ? `${rest} ${rest === 1 ? 'mês' : 'meses'}` : '';
  return [y, m].filter(Boolean).join(' e ');
}

export interface YearGroup {
  items: { el: XElement; meta: ItemMeta }[];
  key: string;
  label: string;
}

/** Agrupa: "Atual" primeiro, depois anos em ordem decrescente, "Sem ano" no fim. */
export function groupByYear(elements: XElement[]): YearGroup[] {
  const withMeta = elements
    .map((el, index) => ({ el, index, meta: itemMeta(el) }))
    .sort((a, b) => b.meta.sortKey - a.meta.sortKey || a.index - b.index);
  const groups = new Map<string, YearGroup>();
  for (const { el, meta } of withMeta) {
    const key = meta.current ? 'atual' : meta.groupYear ? String(meta.groupYear) : 'sem-ano';
    const label = meta.current ? 'Atual' : meta.groupYear ? String(meta.groupYear) : 'Sem ano';
    if (!groups.has(key)) groups.set(key, { items: [], key, label });
    groups.get(key)!.items.push({ el, meta });
  }
  return [...groups.values()];
}

/** Um elemento é item de lista quando carrega dados, não só filhos. */
export function isListItem(el: XElement): boolean {
  return el.attrs.length > 0 || childElements(el).some((c) => c.name.startsWith('DADOS-BASICOS'));
}
