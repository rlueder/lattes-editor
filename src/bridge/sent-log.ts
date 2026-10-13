// Registro do que o conector gravou no Lattes. O Lattes não mostra o que está
// pendente nem deixa descartar antes de "Enviar ao CNPq"
// (docs/lattes_internals.md, seção 10); este registro é o único lugar onde a
// pessoa vê o que foi gravado e de onde pode desfazer.

import type { Change } from '../model/changes.ts';
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
  /** Linhas "antes → depois", guardadas prontas para mostrar. */
  rows: SentRow[];
  sentAt: number;
  /** id da entrada que esta desfez. */
  undoOf?: number;
}

export function sentEntry(
  op: BridgeOp,
  lattesId: string,
  sentAt: number,
  extra: { change?: Change; undoOf?: number } = {},
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
  if (entry.id === undefined || entry.undoOf !== undefined) return undefined;
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
