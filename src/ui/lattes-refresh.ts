// "Atualizar do Lattes" (src/bridge/refresh/): as passadas pedidas à extensão,
// uma parte por vez, e os textos do resultado. A exportação continua sendo a
// base, e a leitura traz o que mudou nas listas de produção desde ela: o
// Exportar leva mais de uma hora para acompanhar um envio ao CNPq (seção 10
// de docs/lattes_internals.md). O efeito no React fica em
// use-lattes-refresh.ts.

import { sameCv } from '../bridge/lattes-html.ts';
import type { RefreshFailure } from '../bridge/protocol.ts';
import { formNamesOf } from '../bridge/refresh/coverage.ts';
import { mergeReadings, type MergeResult } from '../bridge/refresh/merge.ts';
import { type NotRead, planRefresh } from '../bridge/refresh/plan.ts';
import { FORMS_PER_TASK, type RefreshPart, type RefreshRequest } from '../bridge/refresh/read.ts';
import type { ListSnapshot } from '../census/test-ledger.ts';
import type { FormReadMark } from '../model/form-read.ts';
import type { XDocument, XElement } from '../model/xml.ts';
import type { Notice } from './notifications.ts';

/** A resposta de uma parte como o editor a recebe, sem o id e o tipo. */
export interface PartAnswer {
  error?: string;
  lattesId?: string;
  part?: RefreshPart;
  reason?: RefreshFailure | 'sem-resposta';
}

/** Por que a leitura parou. */
export type RefreshStop = RefreshFailure | 'fechado' | 'outro-cv' | 'sem-resposta' | 'sessao';

export interface RefreshSummary {
  added: string[];
  changed: string[];
  /** Formulários que ficaram sem leitura porque a leitura parou no meio. */
  left: number;
  notCompared: string[];
  notRead: NotRead[];
  /** Formulários pedidos. */
  reads: number;
  same: number;
  skipped: { reason: string; text: string }[];
}

export type RefreshOutcome =
  | { detail?: string; ok: false; reason: RefreshStop; summary?: RefreshSummary }
  | { ok: true; summary: RefreshSummary };

export type RefreshStage =
  { done: number; kind: 'formularios'; total: number } | { kind: 'listas'; part: number };

export interface RefreshDeps {
  ask(request: RefreshRequest): Promise<PartAnswer>;
  /** Leva ao editor o que uma parte de formulários trouxe; base já está com ela. */
  commit(base: XDocument, merged: MergeResult): void;
  /** Os documentos de agora; undefined se o currículo foi fechado ou trocado. */
  current(): { base: XDocument; counter: number; working: XElement } | undefined;
  /** O currículo aberto: a sessão do Lattes precisa ser dele. */
  lattesId?: string;
  now?: () => number;
  onStage?(stage: RefreshStage): void;
}

/** Partes de listas, no máximo: as mais de 120 listas de um currículo real cabem em três. */
const MAX_LIST_PARTS = 8;

class Stopped extends Error {
  detail?: string;
  reason: RefreshStop;
  constructor(reason: RefreshStop, detail?: string) {
    super(reason);
    this.reason = reason;
    this.detail = detail;
  }
}

/** A parte que veio, ou a parada com o motivo; a sessão precisa ser do currículo aberto. */
function takePart(answer: PartAnswer, lattesId: string | undefined): RefreshPart {
  if (!answer.part) throw new Stopped(answer.reason ?? 'erro', answer.error);
  if (!sameCv(lattesId, answer.lattesId)) throw new Stopped('outro-cv');
  return answer.part;
}

async function readLists(deps: RefreshDeps): Promise<{ lists: ListSnapshot; unread: string[] }> {
  const lists: ListSnapshot = {};
  const unread: string[] = [];
  let queue: string[] | undefined;
  for (let n = 1; n <= MAX_LIST_PARTS; n++) {
    deps.onStage?.({ kind: 'listas', part: n });
    const part = takePart(await deps.ask({ queue, step: 'listas' }), deps.lattesId);
    if (part.step !== 'listas') throw new Stopped('erro');
    if (part.reason) throw new Stopped(part.reason, part.error);
    Object.assign(lists, part.lists);
    unread.push(...part.unread);
    queue = part.queue;
    if (queue.length === 0) return { lists, unread };
  }
  throw new Stopped('erro', 'O menu do Lattes tem mais listas que o esperado');
}

/**
 * As passadas: as listas em partes, o plano, e os formulários em partes de
 * FORMS_PER_TASK, cada uma levada ao editor assim que chega. Uma parada no
 * meio deixa o que já entrou; rodar de novo lê só o que ainda falta, porque
 * as linhas já lidas passam a casar com itens do editor.
 */
export async function runRefresh(deps: RefreshDeps): Promise<RefreshOutcome> {
  let summary: RefreshSummary | undefined;
  try {
    const { lists, unread } = await readLists(deps);
    if (unread.includes('*')) throw new Stopped('erro', 'Nenhuma lista do Lattes foi lida');
    const docs = deps.current();
    if (!docs) throw new Stopped('fechado');
    const plan = planRefresh(lists, unread, docs.working, docs.base.root);
    const s: RefreshSummary = {
      added: [],
      changed: [],
      left: plan.reads.length,
      notCompared: plan.notCompared,
      notRead: plan.notRead,
      reads: plan.reads.length,
      same: 0,
      skipped: [],
    };
    summary = s;
    for (let i = 0; i < plan.reads.length; i += FORMS_PER_TASK) {
      const batch = plan.reads.slice(i, i + FORMS_PER_TASK);
      deps.onStage?.({ done: i, kind: 'formularios', total: plan.reads.length });
      const reads = batch.map((r) => ({ forms: formNamesOf(r.group), link: r.link }));
      const part = takePart(await deps.ask({ reads, step: 'formularios' }), deps.lattesId);
      if (part.step !== 'formularios') throw new Stopped('erro');
      const now = deps.current();
      if (!now) throw new Stopped('fechado');
      const merged = mergeReadings({
        base: now.base.root,
        counter: now.counter,
        now: (deps.now ?? Date.now)(),
        plan,
        readings: part.forms,
        working: now.working,
      });
      if (merged.marks.length > 0) deps.commit(now.base, merged);
      s.added.push(...merged.added);
      s.changed.push(...merged.changed);
      s.same += merged.same;
      s.skipped.push(...merged.skipped);
      s.left -= batch.length - part.rest.length;
      if (part.reason) throw new Stopped(part.reason, part.error);
    }
    return { ok: true, summary: s };
  } catch (err) {
    if (err instanceof Stopped) {
      return { detail: err.detail, ok: false, reason: err.reason, summary };
    }
    const detail = err instanceof Error ? err.message : undefined;
    return { detail, ok: false, reason: 'erro', summary };
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** O que a leitura trouxe, em poucas palavras. */
export function summaryText(s: RefreshSummary): string {
  const parts = [
    ...(s.added.length ? [plural(s.added.length, 'item novo', 'itens novos')] : []),
    ...(s.changed.length ? [plural(s.changed.length, 'item alterado', 'itens alterados')] : []),
  ];
  if (parts.length > 0) return `Lidos do Lattes: ${parts.join(' e ')}.`;
  return s.reads > 0
    ? 'Os formulários lidos não trouxeram mudança.'
    : 'As listas de produção do Lattes batem com o currículo aberto.';
}

/** O que ficou de fora: seções não lidas, listas não comparadas, linhas que não entraram. */
export function gapsText(s: RefreshSummary): string | undefined {
  const parts: string[] = [];
  if (s.notRead.length > 0) {
    const list = s.notRead.map((n) => `${n.label} (${plural(n.rows, 'linha', 'linhas')})`);
    parts.push(`Não lido: ${list.join(', ')}.`);
  }
  if (s.notCompared.length > 0) parts.push(`Não comparado: ${s.notCompared.join(', ')}.`);
  const [first] = s.skipped;
  if (first) {
    const verb = s.skipped.length === 1 ? 'Ficou' : 'Ficaram';
    const more = s.skipped.length > 1 ? ' e outras' : '';
    parts.push(
      `${verb} de fora ${plural(s.skipped.length, 'linha', 'linhas')}: "${first.text}" (${first.reason})${more}.`,
    );
  }
  if (s.left > 0) {
    parts.push(
      `Faltou ler ${plural(s.left, 'formulário', 'formulários')}; atualize de novo para continuar.`,
    );
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function refreshFailureText(reason: RefreshStop, detail?: string): string {
  switch (reason) {
    case 'consentimento':
      return 'Aceite o aviso no painel da extensão e tente de novo.';
    case 'fechado':
      return 'O currículo foi fechado ou trocado no meio da leitura.';
    case 'ocupado':
      return 'A extensão está usando a aba do Lattes. Tente de novo quando ela terminar.';
    case 'outro-cv':
      return 'A sessão aberta no Lattes é de outro currículo. Entre no Lattes com o currículo aberto aqui e tente de novo.';
    case 'sem-aba':
      return 'Abra o seu currículo no Lattes numa aba do navegador e tente de novo.';
    case 'sem-resposta':
      return 'A extensão não respondeu. Tente de novo.';
    case 'sessao':
      return 'A sessão do Lattes expirou. Entre de novo e tente outra vez.';
    case 'erro':
      return `Não deu para ler o Lattes${detail ? ` (${detail.replace(/\.$/, '')})` : ''}. Tente de novo.`;
  }
}

/** O aviso do canto ao terminar. */
export function refreshToast(out: RefreshOutcome): { description: string; title: string } {
  if (!out.ok) {
    return {
      description: refreshFailureText(out.reason, out.detail),
      title: 'A atualização do Lattes parou',
    };
  }
  const text = [summaryText(out.summary), gapsText(out.summary)].filter(Boolean).join(' ');
  return { description: text, title: 'Atualizado do Lattes' };
}

/** O que fica no sino: a parada, com o que já entrou, ou o que não foi lido. */
export function refreshNotice(out: RefreshOutcome | undefined): Notice | undefined {
  if (!out) return undefined;
  if (!out.ok) {
    const s = out.summary;
    const done = s && s.added.length + s.changed.length > 0 ? ` ${summaryText(s)}` : '';
    return {
      action: 'atualizar-lattes',
      id: 'atualizar-lattes',
      level: 'aviso',
      text: `${refreshFailureText(out.reason, out.detail)}${done} Clique para atualizar de novo.`,
      title: 'A atualização do Lattes parou',
    };
  }
  const gaps = gapsText(out.summary);
  if (!gaps) return undefined;
  return {
    id: 'atualizar-lattes',
    level: 'info',
    text: `${summaryText(out.summary)} ${gaps}`,
    title: 'Atualizado do Lattes',
  };
}

/** O passo da leitura, para o aviso do canto. */
export function stageText(stage: RefreshStage): string {
  return stage.kind === 'listas'
    ? `Lendo as listas do Lattes (parte ${stage.part}).`
    : `Lendo os formulários das linhas novas (${stage.done} de ${stage.total}).`;
}

/** A nota do histórico de uma parte que entrou no editor. */
export function refreshNote(merged: MergeResult): string {
  const parts = [
    ...(merged.added.length ? [plural(merged.added.length, 'novo', 'novos')] : []),
    ...(merged.changed.length ? [plural(merged.changed.length, 'alterado', 'alterados')] : []),
  ];
  return `Atualizado do Lattes: ${parts.join(', ')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A explicação da marca "lido do Lattes" de um item. */
export function formReadNote(mark: FormReadMark): string {
  const d = new Date(mark.readAt);
  const when = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `Lido dos formulários do Lattes em ${when}, não da exportação. Códigos e campos que só a exportação traz ficam vazios até a próxima exportação.`;
}
