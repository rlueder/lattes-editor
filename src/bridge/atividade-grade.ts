// Incluir, tirar e renomear as linhas da grade de uma atividade que já está
// no Lattes: as disciplinas do ensino, os treinamentos ministrados e as
// linhas de pesquisa da pesquisa e desenvolvimento. A grade providerDetAtiv
// vem na página de edição com as linhas que já existem ({l, c}, lida em
// 20/10 e 21/10/2026), e o check() a manda em f_espec_l, com a linha digitada
// de c 0 e a excluída em f_exc ("c?"). Seção 22 de docs/lattes_internals.md.
//
// A operação é a alteração da atividade (edit-atividade.ts) com a grade
// inteira: a linha que fica leva o c dela, a nova vai com c 0 e a que sai vai
// em f_exc. As outras mudanças da fila na mesma atividade entram juntas, para
// todas virarem o mesmo envio. Uma linha de pesquisa nova com objetivos e o
// resto segue depois pelo formulário dela (linha-detalhes.ts). Inferido, até
// o teste acompanhado: f_exc com mais de uma linha ("c?c?"), e a inclusão de
// uma linha nova pela grade numa atividade que já existe.

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { AtividadeOp } from './edit-atividade.ts';
import { ACTIVITY_TYPES } from './edit-atividade.ts';
import { LINHA, LINHA_TITLE, type LinhaDetails, planLinhaDetails } from './linha-detalhes.ts';

/** A grade de uma atividade que já existe e a linha de pesquisa nova pelo formulário dela. */
export const ACTIVITY_ROWS_ENABLED = true;

/** Cada linha de grade: a atividade que a tem e de onde vem o texto. */
const ROW_OF: Record<string, { activity: string; label: string; title?: string }> = {
  DISCIPLINA: { activity: 'ENSINO', label: 'Disciplinas' },
  [LINHA]: {
    activity: 'PESQUISA-E-DESENVOLVIMENTO',
    label: 'Linhas de pesquisa',
    title: LINHA_TITLE,
  },
  TREINAMENTO: { activity: 'TREINAMENTO-MINISTRADO', label: 'Treinamentos' },
};

/** A grade antes (como o Lattes tem) e depois, pelos textos. */
export interface ActivityRows {
  after: string[];
  before: string[];
  /** Linhas que só trocam o texto: o de antes e o de depois. */
  renamed: [string, string][];
}

const textOf = (el: XElement) =>
  el.children
    .map((c) => (c.kind === 'text' ? c.value : ''))
    .join('')
    .trim();

/** O texto de uma mudança numa linha, antes ou depois. */
function rowText(change: Change, side: 'after' | 'before'): string {
  const attr = ROW_OF[change.element]?.title ?? '#texto';
  return (change.fields.find((f) => f.attr === attr)?.[side] ?? '').trim();
}

/** Uma mudança nesta grade: inclusão, retirada ou o texto trocado. */
const isRowChange = (c: Change) =>
  c.element in ROW_OF &&
  (c.kind !== 'alterado' ||
    (!ROW_OF[c.element]!.title && c.fields.some((f) => f.attr === '#texto')));

/**
 * A grade da atividade como operação, ou o motivo de ir à mão; undefined
 * quando a mudança não é numa linha de uma atividade que já está no Lattes.
 */
export function planActivityRows(
  change: Change,
  chain: readonly XElement[],
  label: string,
  siblings: readonly Change[],
): AtividadeOp | { reason: string } | undefined {
  if (!isRowChange(change)) return undefined;
  const spec = ROW_OF[change.element]!;
  const activity = chain.find((e) => e.name === spec.activity);
  const atuacao = chain.find((e) => e.name === 'ATUACAO-PROFISSIONAL');
  const seqAtiv = atuacao && getAttr(atuacao, 'SEQUENCIA-ATIVIDADE');
  const seqFuncao = activity && getAttr(activity, 'SEQUENCIA-FUNCAO-ATIVIDADE');
  // Numa atividade nova, a linha vai junto com ela (create-atividade.ts).
  if (!activity || !seqAtiv || !seqFuncao) return undefined;
  const at = change.path.findIndex((p) => p.startsWith(`${spec.activity}[`));
  const prefix = `${change.path.slice(0, at + 1).join('/')}/`;
  const queued = siblings.filter((c) => isRowChange(c) && c.key.startsWith(prefix));
  const kids = activity.children.filter(
    (c): c is XElement => c.kind === 'element' && c.name in ROW_OF,
  );
  const after = kids.map((k) => (spec.title ? (getAttr(k, spec.title) ?? '') : textOf(k)).trim());
  const added = new Set<string>();
  const removed: string[] = [];
  const renamed: [string, string][] = [];
  for (const c of queued.length ? queued : [change]) {
    if (c.kind === 'novo') added.add(rowText(c, 'after'));
    else if (c.kind === 'removido') removed.push(rowText(c, 'before'));
    else renamed.push([rowText(c, 'before'), rowText(c, 'after')]);
  }
  const back = new Map(renamed.map(([b, a]) => [a, b]));
  const before = [...after.filter((t) => !added.has(t)).map((t) => back.get(t) ?? t), ...removed];
  if (after.some((t) => !t)) return { reason: 'Linha da grade sem texto: o Lattes não aceita' };
  if (after.some((t) => /[@?!]/.test(t))) {
    return { reason: 'Texto com @, ? ou !, que a grade do Lattes usa como separador' };
  }
  // O check() da página exige ao menos uma descrição.
  if (after.length === 0) {
    return { reason: 'O Lattes exige ao menos uma linha na atividade: exclua a atividade' };
  }
  // As linhas de pesquisa novas com mais que o título: o formulário delas.
  const lines: LinhaDetails[] = [];
  if (spec.title) {
    for (const k of kids) {
      if (!added.has((getAttr(k, LINHA_TITLE) ?? '').trim())) continue;
      const details = planLinhaDetails(k);
      if (details && 'reason' in details) return details;
      if (details) lines.push(details);
    }
  }
  const type = ACTIVITY_TYPES[spec.activity]!;
  return {
    codInst: (atuacao && getAttr(atuacao, 'CODIGO-INSTITUICAO')) || undefined,
    expect: {},
    key: change.key,
    kind: 'atividade',
    label,
    ...(lines.length ? { lines } : {}),
    activityRows: { after, before, renamed },
    natur: type.natur,
    rows: [
      { after: after.join('; '), before: before.join('; '), label: spec.label, name: 'f_espec_l' },
      ...lines.map((l) => ({
        after: 'objetivos, ativa e o resto, pelo formulário da linha',
        before: '',
        label: `Linha nova: ${l.title}`,
        name: 'f_ref',
      })),
    ],
    seqAtiv,
    seqFuncao,
    set: {},
  };
}

interface Row {
  c: string;
  l: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * As linhas a mandar e o f_exc, pela grade da página; 'feito' quando ela já
 * está como depois, e o motivo quando não está como antes.
 */
export function rowsToSend(
  page: readonly Row[],
  rows: ActivityRows,
): { exc: string; wanted: Row[] } | 'divergente' | 'feito' {
  const sameList = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length &&
    [...a].map(fold).sort().join('\n') === [...b].map(fold).sort().join('\n');
  const now = page.map((r) => r.l);
  if (sameList(now, rows.after)) return 'feito';
  if (!sameList(now, rows.before)) return 'divergente';
  const from = new Map(rows.renamed.map(([b, a]) => [fold(a), fold(b)]));
  const free = [...page];
  const wanted = rows.after.map((l) => {
    const was = from.get(fold(l)) ?? fold(l);
    const i = free.findIndex((r) => fold(r.l) === was);
    const kept = i >= 0 ? free.splice(i, 1)[0]! : undefined;
    return { c: kept?.c ?? '0', l };
  });
  return { exc: free.map((r) => `${r.c}?`).join(''), wanted };
}
