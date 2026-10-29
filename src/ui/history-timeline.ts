// O "Histórico" do currículo: tudo o que aconteceu com ele no app, numa lista
// só, do mais recente ao mais antigo, agrupada por dia. Junta quatro fontes
// que o app já guarda, sem mudar nenhuma delas:
//
// - os estados da cópia de trabalho (store.ts, history), com a nota de cada um;
// - as exportações abertas (store.ts, versions);
// - as cópias de segurança (o ponto zero e a do Lattes antes de cada envio,
//   backups.ts), em arquivo;
// - o registro do que foi gravado no Lattes (sent-log.ts).
//
// Cada acontecimento aparece uma vez. O estado "Lattes antes do envio" e a
// cópia em arquivo do mesmo envio viram uma linha, com o que foi gravado
// naquele envio; o estado "Arquivo carregado" e a exportação aberta na mesma
// hora também. Aqui só se monta a lista; ler, restaurar e salvar ficam com
// quem mostra (HistoryPanel.tsx).

import type { BackupFile } from '../model/backups.ts';
import type { HistoryInfo, LattesVersion } from '../model/store.ts';
import { versionDate } from './version-diff.ts';

/** As notas que o app grava em estados que não são edição da pessoa. */
export const NOTES = {
  aberto: 'Arquivo carregado',
  antesDeDesfazer: 'Lattes antes de desfazer',
  antesDeRecarregar: 'Cópia de trabalho antes de recarregar do Lattes',
  antesDoEnvio: 'Lattes antes do envio',
  antesDoPontoZero: 'Cópia de trabalho antes de restaurar o ponto zero',
  publicado: 'Publicado no CNPq',
} as const;

type VersionInfo = Omit<LattesVersion, 'xml'>;

/** O mínimo do registro do enviado que a lista usa. */
export interface SentInfo {
  /** Não conferido: recusado, sessão caída ou divergente. */
  failed: boolean;
  sentAt: number;
  undoOf?: number;
}

export type TimelineKind = 'abertura' | 'edicao' | 'envio' | 'publicacao' | 'recarga';

export interface TimelineEntry {
  at: number;
  /** A cópia em arquivo: o ponto zero, ou o Lattes antes do envio. */
  backup?: BackupFile;
  /** É o estado da cópia de trabalho agora: restaurar não mudaria nada. */
  current?: boolean;
  kind: TimelineKind;
  /** O estado guardado que "Restaurar" e "Salvar arquivo" usam. */
  pointId?: number;
  /** A exportação de antes, para "Ver o que mudou". */
  previousVersionId?: number;
  /** Gravações deste envio no Lattes; failed, as que não conferiram. */
  sent?: { failed: number; total: number };
  text: string;
  /** A exportação aberta neste momento. */
  versionId?: number;
}

export interface TimelineDay {
  /** AAAA-MM-DD, na hora local. */
  day: string;
  entries: TimelineEntry[];
  /** "Hoje", "Ontem" ou DD/MM/AAAA. */
  label: string;
}

/** Quanto antes do estado "Lattes antes do envio" a cópia em arquivo pode ter sido guardada. */
const BACKUP_BEFORE_MS = 10 * 60_000;
/** Quanto depois dele (relógio do arquivo, no desktop). */
const BACKUP_AFTER_MS = 60_000;
/** Até quanto depois de começar um envio uma gravação conta como dele. */
const SEND_SPAN_MS = 30 * 60_000;
/** O estado "Arquivo carregado" e a exportação aberta: o mesmo momento, com folga. */
const OPEN_MATCH_MS = 60_000;
/** O ponto zero é guardado logo depois de abrir a exportação. */
const ZERO_MATCH_MS = 10 * 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** AAAA-MM-DD, na hora local. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Hoje", "Ontem" ou a data. */
export function dayLabel(day: string, now: number): string {
  if (day === dayKey(now)) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dayKey(yesterday.getTime())) return 'Ontem';
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function sendText(undo: boolean, sent?: TimelineEntry['sent']): string {
  const verb = undo ? 'Desfeito no Lattes' : 'Enviado ao Lattes';
  if (!sent || sent.total === 0) return `${verb}: nada gravado`;
  const ok = sent.total - sent.failed;
  const main = plural(ok, 'alteração', 'alterações');
  return sent.failed > 0
    ? `${verb}: ${main}, ${plural(sent.failed, 'não conferida', 'não conferidas')}`
    : `${verb}: ${main}`;
}

/** O mais perto de `at` dentro da janela [at - before, at + after], tirado da lista. */
function takeNearest<T>(
  list: T[],
  timeOf: (x: T) => number,
  at: number,
  before: number,
  after: number,
): T | undefined {
  let best = -1;
  for (const [i, x] of list.entries()) {
    const t = timeOf(x);
    if (t < at - before || t > at + after) continue;
    if (best < 0 || Math.abs(t - at) < Math.abs(timeOf(list[best]!) - at)) best = i;
  }
  return best < 0 ? undefined : list.splice(best, 1)[0];
}

interface Sources {
  backups: readonly BackupFile[];
  points: readonly HistoryInfo[];
  sent: readonly SentInfo[];
  /** Qualquer ordem. */
  versions: readonly VersionInfo[];
}

/** Os envios: um por estado "Lattes antes do envio" ou cópia em arquivo, com as gravações deles. */
function sends(
  points: HistoryInfo[],
  backups: BackupFile[],
  sent: readonly SentInfo[],
): TimelineEntry[] {
  const anchors: { at: number; backup?: BackupFile; pointId?: number; undo: boolean }[] = [];
  for (const p of points) {
    if (p.note !== NOTES.antesDoEnvio && p.note !== NOTES.antesDeDesfazer) continue;
    const backup = takeNearest(
      backups,
      (b) => b.savedAt,
      p.savedAt,
      BACKUP_BEFORE_MS,
      BACKUP_AFTER_MS,
    );
    anchors.push({ at: p.savedAt, backup, pointId: p.id, undo: p.note === NOTES.antesDeDesfazer });
  }
  // A cópia em arquivo sem o estado (passou dos 20 guardados, ou o histórico
  // foi limpo): o envio continua aparecendo, só com o arquivo.
  for (const b of backups.splice(0)) anchors.push({ at: b.savedAt, backup: b, undo: false });
  anchors.sort((a, b) => a.at - b.at);

  const counts = anchors.map(() => ({ failed: 0, total: 0 }));
  const loose: SentInfo[] = [];
  for (const s of sent) {
    let i = -1;
    for (const [j, a] of anchors.entries()) {
      if (a.at <= s.sentAt + BACKUP_AFTER_MS && s.sentAt - a.at <= SEND_SPAN_MS) i = j;
    }
    if (i < 0) loose.push(s);
    else {
      counts[i]!.total += 1;
      if (s.failed) counts[i]!.failed += 1;
    }
  }
  const out = anchors.map((a, i): TimelineEntry => {
    const count = counts[i]!;
    const entry: TimelineEntry = {
      at: a.at,
      kind: 'envio',
      sent: count,
      text: sendText(a.undo, count),
    };
    if (a.backup) entry.backup = a.backup;
    if (a.pointId !== undefined) entry.pointId = a.pointId;
    return entry;
  });
  // Gravações sem estado nem arquivo por perto: juntas por proximidade.
  loose.sort((a, b) => a.sentAt - b.sentAt);
  let group: SentInfo[] = [];
  const flush = () => {
    if (!group.length) return;
    const count = { failed: group.filter((s) => s.failed).length, total: group.length };
    const undo = group.every((s) => s.undoOf !== undefined);
    out.push({ at: group[0]!.sentAt, kind: 'envio', sent: count, text: sendText(undo, count) });
    group = [];
  };
  for (const s of loose) {
    if (group.length && s.sentAt - group[0]!.sentAt > SEND_SPAN_MS) flush();
    group.push(s);
  }
  flush();
  return out;
}

/** As exportações abertas, cada uma com o estado do mesmo momento e, na recarga, o de antes. */
function openings(
  points: HistoryInfo[],
  versions: readonly VersionInfo[],
  zero: BackupFile | undefined,
): TimelineEntry[] {
  const sorted = [...versions].sort((a, b) => a.loadedAt - b.loadedAt);
  const opened = points.filter((p) => p.note === NOTES.aberto);
  const before = points.filter((p) => p.note === NOTES.antesDeRecarregar);
  const out: TimelineEntry[] = [];
  let zeroLeft = zero;
  for (const [i, v] of sorted.entries()) {
    const point = takeNearest(opened, (p) => p.savedAt, v.loadedAt, OPEN_MATCH_MS, OPEN_MATCH_MS);
    const at = point?.savedAt ?? v.loadedAt;
    const prior = takeNearest(before, (p) => p.savedAt, at, OPEN_MATCH_MS, 0);
    const date = v.exportedAt ? versionDate(v) : undefined;
    const entry: TimelineEntry = { at, kind: prior ? 'recarga' : 'abertura', text: '' };
    if (v.id !== undefined) entry.versionId = v.id;
    const previous = sorted[i - 1];
    if (previous?.id !== undefined) entry.previousVersionId = previous.id;
    if (prior) {
      // "Restaurar o de antes": a cópia de trabalho de antes da recarga.
      if (prior.id !== undefined) entry.pointId = prior.id;
      entry.text = date
        ? `Atualizado do Lattes, o currículo inteiro: exportação de ${date}`
        : 'Atualizado do Lattes, o currículo inteiro';
    } else {
      if (point?.id !== undefined) entry.pointId = point.id;
      const what = date ? `exportação de ${date}` : 'currículo do Lattes';
      entry.text = i === 0 ? `Primeira abertura: ${what}` : `Aberto: ${what}`;
      if (zeroLeft && Math.abs(zeroLeft.savedAt - at) <= ZERO_MATCH_MS) {
        entry.backup = zeroLeft;
        entry.text += ' (ponto zero)';
        zeroLeft = undefined;
      }
    }
    out.push(entry);
  }
  // O estado "Arquivo carregado" sem exportação guardada (um XML sem número
  // de currículo, ou as exportações apagadas).
  for (const p of [...opened, ...before]) {
    const entry: TimelineEntry = {
      at: p.savedAt,
      kind: 'abertura',
      text: p.note === NOTES.aberto ? 'Arquivo aberto' : p.note,
    };
    if (p.id !== undefined) entry.pointId = p.id;
    out.push(entry);
  }
  if (zeroLeft) {
    out.push({
      at: zeroLeft.savedAt,
      backup: zeroLeft,
      kind: 'abertura',
      text: 'Ponto zero: a primeira exportação deste currículo',
    });
  }
  return out;
}

/** A lista do Histórico, do mais recente ao mais antigo, por dia. */
export function buildTimeline(sources: Sources, now: number): TimelineDay[] {
  const points = [...sources.points];
  const zero = sources.backups.find((b) => b.kind === 'ponto-zero');
  const restore = sources.backups.filter((b) => b.kind === 'restauracao');
  const entries: TimelineEntry[] = [
    ...sends(points, [...restore], sources.sent),
    ...openings(points, sources.versions, zero),
  ];
  const special = new Set<string>(Object.values(NOTES));
  for (const p of points) {
    if (p.note === NOTES.publicado) {
      entries.push({ at: p.savedAt, kind: 'publicacao', text: 'Publicado no CNPq' });
    } else if (!special.has(p.note) || p.note === NOTES.antesDoPontoZero) {
      const entry: TimelineEntry = { at: p.savedAt, kind: 'edicao', text: p.note };
      if (p.id !== undefined) entry.pointId = p.id;
      entries.push(entry);
    }
  }
  entries.sort((a, b) => b.at - a.at);
  // O estado mais recente que é a própria cópia de trabalho (uma edição, uma
  // abertura ou uma restauração), e não um "de antes", é o atual.
  const before = new Set<string>([
    NOTES.antesDeDesfazer,
    NOTES.antesDeRecarregar,
    NOTES.antesDoEnvio,
    NOTES.antesDoPontoZero,
  ]);
  const latest = [...sources.points]
    .filter((p) => !before.has(p.note))
    .sort((a, b) => b.savedAt - a.savedAt)[0];
  const current = entries.find(
    (e) =>
      latest?.id !== undefined &&
      e.pointId === latest.id &&
      e.kind !== 'envio' &&
      e.kind !== 'recarga',
  );
  if (current) current.current = true;
  const days: TimelineDay[] = [];
  for (const entry of entries) {
    const day = dayKey(entry.at);
    const last = days.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry], label: dayLabel(day, now) });
  }
  return days;
}
