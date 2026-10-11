// Cópia de trabalho e histórico no IndexedDB do navegador. Nada sai da máquina.
// O arquivo carregado é a fonte; aqui fica só o estado editado.

import Dexie, { type EntityTable } from 'dexie';

export interface WorkingCopy {
  /**
   * Mudanças já feitas à mão no Lattes: chave da mudança → assinatura dos
   * valores. Se o valor mudar de novo, a assinatura não bate e ela volta.
   */
  doneChanges?: Record<string, string>;
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
  /** Descrição curta da alteração, mostrada no painel de histórico. */
  note: string;
  savedAt: number;
  xml: string;
}

export const HISTORY_LIMIT = 50;

class LattesDb extends Dexie {
  working!: EntityTable<WorkingCopy, 'id'>;
  history!: EntityTable<HistoryEntry, 'id'>;

  constructor() {
    super('lattes-editor');
    this.version(1).stores({ history: '++id, savedAt', working: 'id' });
  }
}

export const db = new LattesDb();

export async function loadWorkingCopy(): Promise<WorkingCopy | undefined> {
  return db.working.get('current');
}

/** Grava a cópia de trabalho e um ponto de histórico, mantendo os últimos 50. */
export async function saveWorkingCopy(copy: WorkingCopy, note: string): Promise<void> {
  await db.transaction('rw', db.working, db.history, async () => {
    await db.working.put(copy);
    await db.history.add({ note, savedAt: copy.savedAt, xml: copy.xml });
    const total = await db.history.count();
    if (total > HISTORY_LIMIT) {
      const stale = await db.history
        .orderBy('savedAt')
        .limit(total - HISTORY_LIMIT)
        .primaryKeys();
      await db.history.bulkDelete(stale);
    }
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

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.working, db.history, async () => {
    await db.working.clear();
    await db.history.clear();
  });
}
