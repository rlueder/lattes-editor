// A passada de edição do censo (LAT-55): para os itens que o currículo de
// quem roda já tem, abre o formulário de edição (só GET) e casa o valor de
// cada campo com os atributos do mesmo item na exportação. A ligação campo e
// atributo sai observada, com o número de itens que a confirmam.
//
// Os valores do currículo só servem para casar, aqui dentro, e não saem: o
// resultado tem nomes de campo, nomes de atributo e contagens. A exceção são
// os pares opção ↔ valor de atributo enumerado no schema (S ↔ CONCLUIDO), que
// são do Lattes e do XSD, não da pessoa.

import { foldText } from '../bridge/html-text.ts';
import { findLinks } from '../bridge/lattes-html.ts';
import { parseXml, walk, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { scanForms, type ScannedField } from './html-scan.ts';
import { type CensusFile, type CensusPort, CensusReader, listPath, SessionLost } from './run.ts';
import type { CensusTarget } from './targets.ts';
import { CENSUS_TARGETS } from './targets-production.ts';

export interface FieldLink {
  attribute: string;
  /**
   * Como a ligação apareceu: valores iguais, ou o par opção ↔ valor enumerado
   * repetido nos itens (mais fraca: dois campos de opções podem andar juntos
   * por acaso).
   */
  by: 'enumeracao' | 'valor';
  /** Itens em que campo e atributo tinham valores diferentes. */
  conflicts: number;
  element: string;
  field: string;
  /** Itens em que o valor do campo era o do atributo. */
  matches: number;
  /**
   * Num campo de opções ligado por valor: em quantos itens o XML trazia o
   * código da opção, o rótulo exato, ou o rótulo só com outra caixa ou acento.
   */
  spelling?: Partial<Record<'dobrado' | 'rotulo' | 'valor', number>>;
  target: string;
  /** Opção do formulário → valor enumerado do XML, quando a ligação vem da enumeração. */
  valueMap?: Record<string, string>;
}

export interface LinkSummary {
  /** Itens cujo par na exportação não ficou claro. */
  ambiguous: number;
  /**
   * Os ocultos de grade (f_autores_l, f_plv_l, f_area_l…) nos formulários de
   * edição lidos: em quantos vieram preenchidos e em quantos vazios, sem o
   * valor. Diz se a página já traz a grade serializada, ou se só o check()
   * a monta no envio (e enviar o formulário como veio a apagaria).
   */
  grids?: Record<string, { empty: number; filled: number }>;
  /**
   * Links de edição achados na lista (e nas telas intermediárias abertas),
   * antes do limite de itens lidos: com `read` menor, o limite cortou.
   * Ausente quando a lista não foi aberta.
   */
  listed?: number;
  /**
   * Quando a lista não tem link de edição que o censo reconheça: os
   * procedimentos que a página abre, com os nomes dos parâmetros e sem os
   * valores, e quantas vezes o procedimento do formulário aparece no HTML fora
   * de um link (num script, por exemplo). É o que diz onde procurar.
   */
  listShape?: { mentions: number; procs: string[] };
  /** Itens casados com um elemento da exportação. */
  matched: number;
  read: number;
  /**
   * - `ok`: lido;
   * - `sem-itens`: a exportação não tem o elemento, e a lista do Lattes também
   *   não tem link de edição (ou não foi aberta);
   * - `so-na-lista`: a exportação não tem o elemento, mas a lista do Lattes
   *   tem itens (a exportação é a versão publicada, e o item importado fica
   *   fora dela até o envio ao CNPq);
   * - `sem-link`: a exportação tem itens e a lista não tem link de edição
   *   reconhecível (veja `listShape`);
   * - `sem-lista`: a entrada não tem lista;
   * - `erro`: falha de rede no meio.
   */
  status: 'erro' | 'ok' | 'sem-itens' | 'sem-lista' | 'sem-link' | 'so-na-lista';
  target: string;
}

export interface LinkOptions {
  delayMs?: number;
  /** Até tantos itens por lista (padrão 8). */
  maxItems?: number;
  targets?: CensusTarget[];
  only?: string[];
}

/** Valor de um atributo de um elemento do item, para casar. Só em memória. */
interface AttrValue {
  attribute: string;
  element: string;
  value: string;
}

/** Para comparar: sem acento, caixa nem sublinhado (MEIO_DIGITAL é "meio digital"). */
const norm = (value: string) => foldText(value.replace(/\r\n?/g, '\n').replace(/_+/g, ' '));

/** Os atributos do item e das partes dele (dados básicos, detalhamento, autores...). */
export function itemValues(item: XElement): AttrValue[] {
  const out: AttrValue[] = [];
  walk(item, (el) => {
    for (const a of el.attrs) out.push({ attribute: a.name, element: el.name, value: a.value });
  });
  return out;
}

/** O valor de cada campo como a página mostra: digitado, marcado ou escolhido. */
function fieldValue(f: ScannedField): { label?: string; value: string } {
  if (!f.options) return { value: f.value };
  const chosen = f.options.find((o) => o.chosen);
  return chosen ? { label: chosen.label, value: chosen.value } : { value: '' };
}

const OPTION_CODE = /^[A-Za-z0-9]{1,4}$/;

const enumOf = (element: string, attribute: string) =>
  lattesSchema.elements[element]?.attributes.find((a) => a.name === attribute)?.enum;

/** O valor (ou o rótulo da opção) do campo bate com o do atributo, sem ser curto demais. */
function sameValue(f: ScannedField, attrValue: string): boolean {
  const { label, value } = fieldValue(f);
  const target = norm(attrValue);
  if (!target) return false;
  if (norm(value).length >= 2 && norm(value) === target) return true;
  return label !== undefined && norm(label).length >= 3 && norm(label) === target;
}

/** Quantos campos têm o valor de algum atributo do item (mais o número do item). */
export function matchScore(fields: ScannedField[], values: AttrValue[], seq?: string): number {
  let score = 0;
  for (const f of fields) {
    if (values.some((v) => sameValue(f, v.value))) score++;
  }
  if (seq && values.some((v) => v.attribute.startsWith('SEQUENCIA') && v.value === seq)) score += 3;
  return score;
}

/** O item da exportação que é o do formulário: o de maior pontuação, se for único e passar de 1. */
export function bestItem(
  fields: ScannedField[],
  items: XElement[],
  seq?: string,
): XElement | undefined {
  const scored = items
    .map((item) => ({ item, score: matchScore(fields, itemValues(item), seq) }))
    .sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  if (!first || first.score < 2) return undefined;
  return second && second.score === first.score ? undefined : first.item;
}

type Tally = Map<string, FieldLink>;

function linkFor(out: Tally, target: string, field: string, v: AttrValue): FieldLink {
  const key = `${target}|${field}|${v.element}@${v.attribute}`;
  let link = out.get(key);
  if (!link) {
    link = {
      attribute: v.attribute,
      by: 'enumeracao',
      conflicts: 0,
      element: v.element,
      field,
      matches: 0,
      target,
    };
    out.set(key, link);
  }
  return link;
}

/**
 * Soma as evidências de um item casado: campo e atributo com o mesmo valor
 * (ou o rótulo da opção igual ao valor), ou, num campo de opções e num
 * atributo enumerado, o par opção ↔ valor, que precisa ser o mesmo em todos
 * os itens. Valores diferentes contam contra.
 */
export function collectLinks(
  out: Tally,
  target: string,
  fields: ScannedField[],
  item: AttrValue[],
): void {
  const values = item.filter((v) => v.value.trim());
  for (const f of fields) {
    const { value } = fieldValue(f);
    if (!value.trim()) continue;
    for (const v of values) {
      const link = linkFor(out, target, f.name, v);
      if (sameValue(f, v.value)) {
        link.matches++;
        link.by = 'valor';
        if (f.options) {
          // Como o XML grafa o valor: igual ao código da opção, igual ao rótulo,
          // ou só sem acento e caixa. Diz se a lista pode gravar o rótulo como está.
          const { label } = fieldValue(f);
          const how = v.value === value ? 'valor' : v.value === label ? 'rotulo' : 'dobrado';
          link.spelling = { ...link.spelling, [how]: (link.spelling?.[how] ?? 0) + 1 };
        }
        continue;
      }
      // Só códigos curtos de opção (S, 243, BRA) entram no mapa: um texto longo
      // numa opção pode ser dado da pessoa.
      if (
        !f.options ||
        !OPTION_CODE.test(value) ||
        !enumOf(v.element, v.attribute)?.includes(v.value)
      ) {
        link.conflicts++;
        continue;
      }
      const map = (link.valueMap ??= {});
      if (map[value] !== undefined && map[value] !== v.value) {
        link.conflicts++;
        continue;
      }
      map[value] = v.value;
      link.matches++;
    }
  }
}

/** Só as ligações com alguma evidência; o mapa de opções só fica nas que vieram dele. */
export function finishLinks(out: Tally): FieldLink[] {
  return [...out.values()]
    .filter((l) => l.matches > 0)
    .map((l) => {
      const { valueMap, ...rest } = l;
      // O mapa fica também numa ligação por valor: as opções cujo rótulo não
      // bate (Orquestral, gravado como ORQUESTRA) só aparecem nele.
      return valueMap && Object.keys(valueMap).length ? { ...rest, valueMap } : rest;
    })
    .sort(compareLinks);
}

/** Os elementos da exportação que as entradas editam. */
function itemsOf(doc: XElement, elements: Iterable<string>): XElement[] {
  const want = new Set(elements);
  const out: XElement[] = [];
  walk(doc, (el) => {
    if (want.has(el.name)) out.push(el);
  });
  return out;
}

/** Os atributos dos próprios elementos, sem descer: a identificação não leva a formação junto. */
const ownValues = (els: XElement[]): AttrValue[] =>
  els.flatMap((el) =>
    el.attrs.map((a) => ({ attribute: a.name, element: el.name, value: a.value })),
  );

/** Ocultos onde o check() serializa uma grade (seção 16 de lattes_internals.md). */
const GRID_HIDDEN = /^f_\w+_l$/i;

/** Links de edição de uma página: os que levam o número do item. */
function editLinks(html: string, proc: string, itemKey: string) {
  return findLinks(html, proc).filter((l) => l.params[itemKey.toLowerCase()]);
}

/**
 * Entradas que dividem a mesma lista e o mesmo formulário (os níveis da
 * formação) são lidas juntas: cada item vai para a entrada do elemento casado.
 */
interface Group {
  key: string;
  targets: CensusTarget[];
}

function groupsOf(targets: CensusTarget[]): Group[] {
  const groups = new Map<string, Group>();
  for (const t of targets) {
    const proc = t.locate.kind === 'unknown' ? '' : t.locate.proc;
    const params = Object.entries(t.list?.params ?? {})
      .sort()
      .join('&');
    const key = t.singleton
      ? `singleton|${t.id}`
      : `${t.list?.proc ?? ''}?${params}|${t.via ?? ''}|${proc.toLowerCase()}|${t.itemKey}`;
    const g = groups.get(key) ?? { key, targets: [] };
    g.targets.push(t);
    groups.set(key, g);
  }
  return [...groups.values()];
}

interface ItemPages {
  /** Links de edição achados, antes do limite. */
  listed: number;
  pages: { path: string; seq?: string }[];
  /** Os procedimentos que a lista abre, só com os nomes (ver LinkSummary.listShape). */
  shape?: LinkSummary['listShape'];
}

/** Os procedimentos que uma página abre, com os nomes dos parâmetros, sem valores. */
function pageShape(htmls: string[], proc: string): NonNullable<LinkSummary['listShape']> {
  const procs = new Set<string>();
  let mentions = 0;
  const name = proc.replace(/\.$/, '').toLowerCase();
  for (const html of htmls) {
    for (const m of html.matchAll(/([A-Za-z_]+\.[A-Za-z_]+|prc_[A-Za-z_]+)\?([^'"\s<>]*)/g)) {
      const params = m[2]!
        .replace(/&amp;/g, '&')
        .split('&')
        .map((p) => p.split('=')[0]!.toLowerCase())
        .filter(Boolean)
        .sort();
      procs.add(`${m[1]}?${[...new Set(params)].join('&')}`);
    }
    const lower = html.toLowerCase();
    let at = lower.indexOf(name);
    while (at >= 0) {
      // Fora de um endereço com "?": o nome num script ou num texto.
      if (lower[at + name.length] !== '?') mentions++;
      at = lower.indexOf(name, at + 1);
    }
  }
  return { mentions, procs: [...procs].sort() };
}

async function itemPages(
  reader: CensusReader,
  code: string,
  t: CensusTarget,
  max: number,
): Promise<ItemPages> {
  if (t.singleton) {
    const where = await reader.locate(t);
    return where.path ? { listed: 1, pages: [{ path: where.path }] } : { listed: 0, pages: [] };
  }
  if (!t.list || t.locate.kind === 'unknown') return { listed: 0, pages: [] };
  const listHtml = (await reader.get(listPath(await reader.menuHtml(), code, t.list))).html;
  const vias = t.via ? findLinks(listHtml, t.via).slice(0, Math.max(max, 1)) : [{ path: '' }];
  const out: { path: string; seq?: string }[] = [];
  const seen: string[] = [listHtml];
  let listed = 0;
  for (const page of vias) {
    const html = page.path ? (await reader.get(page.path)).html : listHtml;
    if (page.path) seen.push(html);
    for (const link of editLinks(html, t.locate.proc, t.itemKey)) {
      listed++;
      if (out.length < max)
        out.push({ path: link.path, seq: link.params[t.itemKey.toLowerCase()] });
    }
  }
  return {
    listed,
    pages: out,
    shape: listed ? undefined : pageShape(seen, t.locate.proc),
  };
}

async function readGroup(
  reader: CensusReader,
  code: string,
  doc: XElement,
  group: Group,
  max: number,
  out: Tally,
): Promise<LinkSummary[]> {
  const summaries = new Map(
    group.targets.map((t) => [
      t.id,
      { ambiguous: 0, matched: 0, read: 0, status: 'ok', target: t.id } as LinkSummary,
    ]),
  );
  const first = group.targets[0]!;
  const items = itemsOf(
    doc,
    group.targets.flatMap((t) => t.elements),
  );
  const all = [...summaries.values()];
  if (!first.singleton && !first.list) {
    for (const s of all) s.status = items.length ? 'sem-lista' : 'sem-itens';
    return all;
  }
  if (!items.length) {
    for (const s of all) s.status = 'sem-itens';
    // Sem item na exportação, a lista ainda diz se o Lattes tem algum: só
    // conta os links, sem abrir formulário.
    if (first.singleton) return all;
    try {
      const { listed } = await itemPages(reader, code, first, 0);
      for (const s of all) {
        s.listed = listed;
        if (listed > 0) s.status = 'so-na-lista';
      }
    } catch (err) {
      if (err instanceof SessionLost) throw err;
    }
    return all;
  }
  const owner = (el: XElement) =>
    summaries.get(group.targets.find((t) => t.elements.includes(el.name))!.id)!;
  try {
    const found = await itemPages(reader, code, first, max);
    for (const s of all) s.listed = found.listed;
    if (!found.listed) {
      for (const s of all) {
        s.status = 'sem-link';
        if (found.shape) s.listShape = found.shape;
      }
    }
    for (const page of found.pages) {
      const fields = scanForms((await reader.get(page.path)).html).forms.flatMap((f) => f.fields);
      const item = first.singleton ? items[0] : bestItem(fields, items, page.seq);
      if (!item) {
        summaries.get(first.id)!.read++;
        summaries.get(first.id)!.ambiguous++;
        continue;
      }
      const s = owner(item);
      s.read++;
      s.matched++;
      for (const f of fields) {
        if (f.type !== 'hidden' || !GRID_HIDDEN.test(f.name)) continue;
        const tally = ((s.grids ??= {})[f.name] ??= { empty: 0, filled: 0 });
        if (f.value.trim()) tally.filled++;
        else tally.empty++;
      }
      const values = first.singleton ? ownValues(items) : itemValues(item);
      collectLinks(out, s.target, fields, values);
    }
  } catch (err) {
    if (err instanceof SessionLost) throw err;
    for (const s of all) s.status = 'erro';
  }
  for (const t of group.targets) {
    const s = summaries.get(t.id)!;
    if (s.status !== 'erro' && !itemsOf(doc, t.elements).length) s.status = 'sem-itens';
  }
  return all;
}

/**
 * A passada de edição: para cada lista com itens no currículo, lê até
 * maxItems formulários de edição e soma as ligações. Nunca envia nada.
 */
export async function linkFields(
  port: CensusPort,
  code: string,
  xml: string,
  options: LinkOptions = {},
): Promise<{ links: FieldLink[]; summary: LinkSummary[] }> {
  const reader = new CensusReader(port, code, options.delayMs ?? 300);
  const doc = parseXml(xml).root;
  const targets = (options.targets ?? CENSUS_TARGETS).filter(
    (t) =>
      !options.only?.length || options.only.some((o) => t.id === o || t.id.startsWith(`${o}-`)),
  );
  const out: Tally = new Map();
  const summary: LinkSummary[] = [];
  for (const group of groupsOf(targets)) {
    summary.push(...(await readGroup(reader, code, doc, group, options.maxItems ?? 8, out)));
  }
  return { links: finishLinks(out), summary };
}

function compareLinks(a: FieldLink, b: FieldLink): number {
  return (
    a.target.localeCompare(b.target) ||
    a.field.localeCompare(b.field) ||
    b.matches - a.matches ||
    `${a.element}@${a.attribute}`.localeCompare(`${b.element}@${b.attribute}`)
  );
}

/**
 * A passada de edição sozinha, no formato de um arquivo do censo sem
 * formulários: o relatório (report.ts) pega as ligações da captura mais
 * recente de cada entrada, então este arquivo atualiza só as ligações.
 */
export function linkOnlyFile(
  result: { links: FieldLink[]; summary: LinkSummary[] },
  collector: string,
  now: () => Date = () => new Date(),
): CensusFile {
  return {
    capturedAt: now().toISOString(),
    collector,
    entries: [],
    format: 1,
    links: result.links,
    linkSummary: result.summary,
    lists: {},
    origin:
      'cvlattesweb: só a passada de edição, formulários de edição abertos por GET, sem enviar',
  };
}
