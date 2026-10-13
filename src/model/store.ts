// Cópia de trabalho e histórico no IndexedDB do navegador. Nada sai da máquina.
// O arquivo carregado é a fonte; aqui fica só o estado editado.

import Dexie, { type EntityTable } from 'dexie';

import type { SentEntry } from '../bridge/sent-log.ts';
import { type LoadedCv, maxSequenciaProducao } from './document.ts';
import { serializeXml } from './xml.ts';

export interface WorkingCopy {
  encoding: string;
  fileName: string;
  id: 'current';
  loadedAt: number;
  /** Maior SEQUENCIA-PRODUCAO da exportação carregada; acima dele, item novo. */
  loadedMaxSequencia: number;
  /** Próximo SEQUENCIA-PRODUCAO livre: começa em max + 1 e só cresce (guia, 3.2). */
  nextSequencia: number;
  /** XML como foi carregado, para comparar e para "descartar alterações". */
  originalXml: string;
  savedAt: number;
  /** XML serializado (string Unicode). */
  xml: string;
}

export interface HistoryEntry {
  id?: number;
  /**
   * Ponto de antes de um envio ao Lattes: fica fora da rotação das edições
   * (KEPT_LIMIT próprio), para não sumir depois de 50 edições.
   */
  keep?: boolean;
  /** Descrição curta da alteração, mostrada no painel de histórico. */
  note: string;
  savedAt: number;
  xml: string;
}

/** Cópia de trabalho de um arquivo recém-carregado: a numeração do servidor vale a partir daqui (guia, 3.2). */
export function newWorkingCopy(cv: LoadedCv, now: number): WorkingCopy {
  const xml = serializeXml(cv.doc);
  const max = maxSequenciaProducao(cv.doc);
  return {
    encoding: cv.encoding,
    fileName: cv.fileName,
    id: 'current',
    loadedAt: now,
    loadedMaxSequencia: max,
    nextSequencia: max + 1,
    originalXml: xml,
    savedAt: now,
    xml,
  };
}

export const HISTORY_LIMIT = 50;
/** Quantos pontos de antes do envio ficam, à parte das edições. */
export const KEPT_LIMIT = 20;

class LattesDb extends Dexie {
  working!: EntityTable<WorkingCopy, 'id'>;
  history!: EntityTable<HistoryEntry, 'id'>;
  sent!: EntityTable<SentEntry, 'id'>;

  constructor() {
    super('lattes-editor');
    this.version(1).stores({ history: '++id, savedAt', working: 'id' });
    // Versão 2 só acrescenta o registro do que foi gravado no Lattes; as
    // tabelas da versão 1 ficam como estão.
    this.version(2).stores({
      history: '++id, savedAt',
      sent: '++id, lattesId, sentAt',
      working: 'id',
    });
  }
}

export const db = new LattesDb();

export async function loadWorkingCopy(): Promise<WorkingCopy | undefined> {
  return db.working.get('current');
}

/**
 * Apaga os pontos mais antigos: das edições, além dos últimos 50; dos de
 * antes do envio, além dos últimos 20. Uma contagem não come a outra.
 */
async function trimHistory(): Promise<void> {
  const all = await db.history.orderBy('savedAt').toArray();
  const stale = (entries: HistoryEntry[], limit: number) =>
    entries.slice(0, Math.max(0, entries.length - limit)).map((e) => e.id!);
  await db.history.bulkDelete([
    ...stale(
      all.filter((e) => !e.keep),
      HISTORY_LIMIT,
    ),
    ...stale(
      all.filter((e) => e.keep),
      KEPT_LIMIT,
    ),
  ]);
}

/** Grava a cópia de trabalho e um ponto de histórico, mantendo os últimos 50. */
export async function saveWorkingCopy(copy: WorkingCopy, note: string): Promise<void> {
  await db.transaction('rw', db.working, db.history, async () => {
    await db.working.put(copy);
    await db.history.add({ note, savedAt: copy.savedAt, xml: copy.xml });
    await trimHistory();
  });
}

/** Um ponto de histórico sem mexer na cópia de trabalho (o de antes de cada envio). */
export async function addHistoryPoint(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  await db.transaction('rw', db.history, async () => {
    await db.history.add(entry);
    await trimHistory();
  });
}

/** Novo arquivo carregado: substitui a cópia de trabalho e zera o histórico. */
export async function replaceWorkingCopy(copy: WorkingCopy): Promise<void> {
  await db.transaction('rw', db.working, db.history, async () => {
    await db.history.clear();
    await db.working.put(copy);
    await db.history.add({ note: 'Arquivo carregado', savedAt: copy.savedAt, xml: copy.xml });
  });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  return db.history.orderBy('savedAt').reverse().toArray();
}

/** Grava no registro do que foi enviado ao Lattes; devolve o id. */
export async function addSent(entry: SentEntry): Promise<number | undefined> {
  return db.sent.add(entry);
}

/** O que foi gravado no Lattes para este currículo, do mais recente ao mais antigo. */
export async function listSent(lattesId: string): Promise<SentEntry[]> {
  const entries = await db.sent.where('lattesId').equals(lattesId).toArray();
  return entries.sort((a, b) => b.sentAt - a.sentAt);
}

/** Apaga o registro do enviado deste currículo. Não muda nada no Lattes. */
export async function clearSent(lattesId: string): Promise<void> {
  await db.sent.where('lattesId').equals(lattesId).delete();
}

/**
 * Fecha o arquivo: apaga a cópia de trabalho e o histórico de edição. O
 * registro do que foi enviado fica: as gravações continuam pendentes no
 * Lattes até "Enviar ao CNPq", e o registro é o único jeito de vê-las e
 * desfazê-las, inclusive depois de abrir outra exportação.
 */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.working, db.history, async () => {
    await db.working.clear();
    await db.history.clear();
  });
}
