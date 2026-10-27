// O que ler pelos formulários, decidido no editor depois da passada das
// listas: cada linha das listas de produção é comparada com os itens da
// cópia de trabalho do mesmo grupo (coverage.ts) pelo título e pelo ano, em
// palavras inteiras, como o diagnóstico faz (src/review/lists-diff.ts). Só a
// linha que não casa com nenhum item da exportação vai ao formulário: é um
// item novo no Lattes, ou um item cujo título ou ano mudou lá. A linha que
// casa com um item criado no editor (o que entrou pelo Importar) também vai,
// para o item passar a contar como já estando no Lattes.
//
// As linhas mostram título, tipo e ano (observado em 21/10/2026, seção 10 de
// docs/lattes_internals.md). Uma mudança em outro campo de um item que já
// estava na exportação não muda a linha e não é lida.

import type { ListRow, ListSnapshot } from '../../census/test-ledger.ts';
import { getAttr, walk, type XElement } from '../../model/xml.ts';
import { normalizeTitle } from '../../review/consistency.ts';
import { diffLists } from '../../review/lists-diff.ts';
import type { ProductionTarget } from '../production/types.ts';
import { groupOfList, type RefreshGroup, refreshGroups } from './coverage.ts';
import { partOf } from './from-form.ts';

/** Chaves mais curtas que isto casariam com qualquer linha (lists-diff.ts). */
const MIN_KEY = 4;

const SEQ = 'SEQUENCIA-PRODUCAO';

export interface PlannedRead {
  /** O grupo da lista (coverage.ts). */
  group: string;
  link: string;
  /** O item criado no editor que a linha mostra (entrou pelo Importar). */
  seq?: string;
  /** O texto da linha, para o resultado. */
  text: string;
}

export interface NotRead {
  label: string;
  reason: string;
  /** Linhas que não casaram com nenhum item do editor. */
  rows: number;
}

export interface RefreshPlan {
  /** Grupos cuja lista falhou ou mudou de formato: nada deles foi comparado. */
  notCompared: string[];
  /** Linhas que a leitura pelos formulários não lê, por seção. */
  notRead: NotRead[];
  /**
   * Itens da exportação que nenhuma linha mostrou, por grupo: o título ou o
   * ano pode ter mudado no Lattes, e o formulário lido decide (merge.ts).
   */
  orphans: Record<string, string[]>;
  reads: PlannedRead[];
}

interface Candidate {
  /** Está na exportação carregada (ou já foi lido do Lattes). */
  inBase: boolean;
  keys: string[];
  /** Sem número (o projeto guarda outro), o item só serve para casar a linha. */
  seq?: string;
}

const textOf = (item: XElement, spec: { attr: string; child: string }) =>
  getAttr(partOf(item, spec.child) ?? item, spec.attr) ?? '';

/** Título e ano do item como chaves da linha; o ano só com quatro dígitos. */
function keysOf(t: ProductionTarget, item: XElement): string[] {
  const title = normalizeTitle(textOf(item, t.title));
  const year = textOf(item, t.year).trim();
  return [title, ...(/^\d{4}$/.test(year) ? [year] : [])];
}

/** A linha traz as chaves, em palavras inteiras? */
const matches = (row: string, keys: string[]) => keys.every((k) => ` ${row} `.includes(` ${k} `));

/** As linhas das listas do grupo, sem repetir o mesmo item (a lista geral e a de divulgação). */
function groupRows(lists: ListSnapshot, keys: string[]): ListRow[] {
  const seen = new Set<string>();
  const out: ListRow[] = [];
  for (const key of keys) {
    for (const row of lists[key] ?? []) {
      const id = row.link.replace(/f_cod=[^&]*&?/i, '') || row.text;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

/**
 * O link da linha abre o formulário de alteração de um tipo do grupo? A regra
 * de linha de cada tipo (list.isRow) vale; sem ela, o link que tem f_seq.
 */
function isFormLink(link: string, g: RefreshGroup): boolean {
  const [proc = '', query = ''] = link.split('?');
  const params = Object.fromEntries(
    [...new URLSearchParams(query)].map(([k, v]) => [k.toLowerCase(), v]),
  );
  return g.targets.some(
    (t) =>
      t.list.formProc.toLowerCase() === proc.toLowerCase() &&
      (t.list.isRow ?? ((p: Record<string, string>) => Boolean(p.f_seq)))(params),
  );
}

function candidatesOf(g: RefreshGroup, working: XElement, baseSeqs: Set<string>): Candidate[] {
  const byName = new Map(g.targets.map((t) => [t.element, t]));
  const out: Candidate[] = [];
  walk(working, (el) => {
    const t = byName.get(el.name);
    const seq = getAttr(el, SEQ);
    if (!t) return;
    const inBase = seq ? baseSeqs.has(`${el.name}|${seq}`) : true;
    out.push({ inBase, keys: keysOf(t, el), seq });
  });
  // Os da exportação primeiro: uma linha só vale para um item criado aqui
  // quando nenhum item que já estava no Lattes a explica.
  return out.sort((a, b) => Number(b.inBase) - Number(a.inBase));
}

/** Os itens da exportação (e os já lidos do Lattes), por elemento e número. */
function seqsIn(base: XElement): Set<string> {
  const out = new Set<string>();
  walk(base, (el) => {
    const seq = getAttr(el, SEQ);
    if (seq) out.add(`${el.name}|${seq}`);
  });
  return out;
}

function planGroup(
  g: RefreshGroup,
  rows: ListRow[],
  candidates: Candidate[],
  plan: RefreshPlan,
): void {
  const texts = rows.map((r) => normalizeTitle(r.text));
  const used = new Set<number>();
  const orphans: string[] = [];
  const editorRows: { row: number; seq: string }[] = [];
  let comparable = 0;
  let found = 0;
  for (const c of candidates) {
    if ((c.keys[0]?.length ?? 0) < MIN_KEY) {
      if (c.inBase && c.seq) orphans.push(c.seq);
      continue;
    }
    if (c.inBase) comparable++;
    const hit = texts.findIndex((text, i) => !used.has(i) && matches(text, c.keys));
    if (hit < 0) {
      if (c.inBase && c.seq) orphans.push(c.seq);
      continue;
    }
    used.add(hit);
    if (c.inBase) found++;
    else if (c.seq) editorRows.push({ row: hit, seq: c.seq });
  }
  // Nenhum item da exportação achado numa lista com linhas: mais provável o
  // formato da linha ter mudado do que todos os itens terem mudado de título.
  if (comparable >= 3 && found === 0 && rows.length > 0) {
    plan.notCompared.push(g.label);
    return;
  }
  const loose = rows.filter((r, i) => !used.has(i) && isFormLink(r.link, g));
  if (!g.readable) {
    if (loose.length > 0) {
      plan.notRead.push({ label: g.label, reason: g.reason ?? '', rows: loose.length });
    }
    return;
  }
  plan.orphans[g.id] = orphans;
  for (const { row, seq } of editorRows) {
    const r = rows[row]!;
    if (isFormLink(r.link, g)) plan.reads.push({ group: g.id, link: r.link, seq, text: r.text });
  }
  for (const r of loose) plan.reads.push({ group: g.id, link: r.link, text: r.text });
}

/** As seções fora da produção (atuação, formação, eventos, prêmios…): só contadas. */
function otherSections(
  lists: ListSnapshot,
  unread: string[],
  working: XElement,
  plan: RefreshPlan,
): void {
  const others: ListSnapshot = {};
  for (const [key, rows] of Object.entries(lists)) {
    if (!groupOfList(key)) others[key] = rows;
  }
  // Sem nenhuma lista dessas seções lida, não há o que contar.
  if (Object.keys(others).length === 0) return;
  const diff = diffLists(
    others,
    working,
    unread.filter((k) => k === '*' || !groupOfList(k)),
  );
  if (diff.unreadable) {
    plan.notCompared.push('Outras seções');
    return;
  }
  const counts = new Map<string, number>();
  for (const row of diff.onlyInLattes) {
    counts.set(row.section, (counts.get(row.section) ?? 0) + 1);
  }
  for (const [label, rows] of counts) {
    plan.notRead.push({
      label,
      reason: 'a leitura pelos formulários ainda não cobre esta seção',
      rows,
    });
  }
}

/**
 * O plano da leitura: as linhas a abrir, as que ficam sem leitura e os
 * grupos que não deu para comparar. `working` é a cópia de trabalho; `base`,
 * a exportação carregada (com o que já foi lido do Lattes antes).
 */
export function planRefresh(
  lists: ListSnapshot,
  unread: string[],
  working: XElement,
  base: XElement,
): RefreshPlan {
  const plan: RefreshPlan = { notCompared: [], notRead: [], orphans: {}, reads: [] };
  const baseSeqs = seqsIn(base);
  const keysByGroup = new Map<string, string[]>();
  for (const key of Object.keys(lists)) {
    const g = groupOfList(key);
    if (g) keysByGroup.set(g.id, [...(keysByGroup.get(g.id) ?? []), key]);
  }
  const failed = new Set(unread.map((k) => groupOfList(k)?.id).filter(Boolean));
  for (const g of refreshGroups()) {
    if (failed.has(g.id)) {
      plan.notCompared.push(g.label);
      continue;
    }
    const keys = keysByGroup.get(g.id);
    if (!keys) continue;
    planGroup(g, groupRows(lists, keys), candidatesOf(g, working, baseSeqs), plan);
  }
  otherSections(lists, unread, working, plan);
  return plan;
}
