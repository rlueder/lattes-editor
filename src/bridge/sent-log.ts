// Registro do que o conector gravou no Lattes. O Lattes não mostra o que está
// pendente nem deixa descartar antes de "Enviar ao CNPq"
// (docs/lattes_internals.md, seção 10); este registro é o único lugar onde a
// pessoa vê o que foi gravado e de onde pode desfazer. As tentativas que não
// deram certo também entram, e o registro sai em texto para anexar a um
// recurso de edital quando o Lattes cai no prazo (LAT-47).

import type { Change } from '../model/changes.ts';
import type { ResultStatus } from './apply.ts';
import { opRows } from './field-labels.ts';
import type { BridgeOp } from './plan.ts';

export interface SentRow {
  after: string;
  before: string;
  label: string;
  name: string;
}

export interface SentEntry {
  /** Mudança do editor que gerou a operação, para reabri-la se for desfeita. */
  change?: Change;
  id?: number;
  /** NUMERO-IDENTIFICADOR do currículo. */
  lattesId: string;
  /** A operação exatamente como foi enviada e conferida. */
  op: BridgeOp;
  /**
   * Como terminou, quando não foi conferido: recusado antes de gravar, sessão
   * caída, ou criado no Lattes com divergência na conferência. Ausente é
   * gravado e conferido (e todas as entradas de antes deste campo).
   */
  outcome?: { detail: string; status: Exclude<ResultStatus, 'conferido'> };
  /** Linhas "antes → depois", guardadas prontas para mostrar. */
  rows: SentRow[];
  sentAt: number;
  /** id da entrada que esta desfez. */
  undoOf?: number;
}

/** A tentativa não terminou conferida. */
export const failed = (entry: SentEntry): boolean => entry.outcome !== undefined;

export function sentEntry(
  op: BridgeOp,
  lattesId: string,
  sentAt: number,
  extra: Pick<SentEntry, 'change' | 'outcome' | 'undoOf'> = {},
): SentEntry {
  return { ...extra, lattesId, op, rows: opRows(op), sentAt };
}

export const UNDO_KEY_PREFIX = 'desfazer:';

/**
 * A operação que volta o Lattes ao que estava antes: grava os valores
 * esperados e espera os gravados. Os campos de identidade que não mudaram (o
 * início do vínculo) seguem como estavam. Sem o "antes" de algum campo, não
 * há como desfazer com segurança: devolve undefined.
 */
export function undoOp(entry: SentEntry): BridgeOp | undefined {
  // O que não terminou conferido pode não ter gravado nada: voltar o "antes"
  // às cegas poderia apagar um valor que já estava lá.
  if (entry.id === undefined || entry.undoOf !== undefined || failed(entry)) return undefined;
  const { op } = entry;
  const fields = Object.keys(op.set);
  if (fields.length === 0 || fields.some((f) => !(f in op.expect))) return undefined;
  const set = Object.fromEntries(fields.map((f) => [f, op.expect[f] ?? null]));
  const expect = { ...op.expect, ...op.set };
  return {
    ...op,
    expect,
    key: `${UNDO_KEY_PREFIX}${entry.id}`,
    label: `Desfazer: ${op.label}`,
    set,
  };
}

/** ids das entradas que já foram desfeitas. */
export function undoneIds(entries: SentEntry[]): Set<number> {
  return new Set(entries.flatMap((e) => (e.undoOf === undefined ? [] : [e.undoOf])));
}

export interface SentDay {
  /** Data local no formato AAAA-MM-DD. */
  day: string;
  entries: SentEntry[];
}

function localDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Agrupa por dia, do mais recente para o mais antigo. */
export function groupByDay(entries: SentEntry[]): SentDay[] {
  const sorted = [...entries].sort((a, b) => b.sentAt - a.sentAt);
  const days: SentDay[] = [];
  for (const entry of sorted) {
    const day = localDay(entry.sentAt);
    const last = days.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}

const OUTCOME_TEXT: Record<Exclude<ResultStatus, 'conferido'>, string> = {
  divergente: 'não conferido',
  erro: 'não gravado',
  sessao: 'não gravado, sessão do Lattes caída',
};

const pad = (n: number) => String(n).padStart(2, '0');
const dateText = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const timeText = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * O registro em texto simples, do mais antigo ao mais recente, para anexar a
 * um recurso: o currículo, a versão do app, cada envio com data, hora e
 * resultado, e cada campo com o valor de antes e o de depois.
 */
export function sentLogText(
  entries: SentEntry[],
  { appVersion, lattesId, now }: { appVersion: string; lattesId: string; now: number },
): string {
  const lines = [
    'Registro do que o LattesEditor enviou ao Currículo Lattes',
    '',
    `Currículo: ${lattesId} (https://lattes.cnpq.br/${lattesId})`,
    `LattesEditor ${appVersion}`,
    `Gerado em ${dateText(now)} às ${timeText(now)}`,
    '',
    'As gravações feitas pelo editor ficam no Lattes como alteração pendente até',
    '"Enviar ao CNPq"; este registro foi gerado pelo editor e não pelo CNPq.',
  ];
  const sorted = [...entries].sort((a, b) => a.sentAt - b.sentAt);
  let day = '';
  for (const entry of sorted) {
    const date = dateText(entry.sentAt);
    if (date !== day) {
      day = date;
      lines.push('', date);
    }
    const result = entry.outcome
      ? `${OUTCOME_TEXT[entry.outcome.status]}${entry.outcome.detail ? `: ${entry.outcome.detail}` : ''}`
      : entry.undoOf !== undefined
        ? 'desfeito e conferido'
        : 'gravado e conferido';
    lines.push(`- ${timeText(entry.sentAt)} ${entry.op.label} (${result})`);
    for (const row of entry.rows) {
      lines.push(`    ${row.label}: ${row.before || '(vazio)'} -> ${row.after || '(vazio)'}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
