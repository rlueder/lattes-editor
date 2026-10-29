// Cópias de segurança no navegador (LAT-59). Sem acesso a pastas, o arquivo
// do Lattes fica no IndexedDB, em claro como o Exportar entrega, num banco à
// parte do banco cifrado (store.ts): `lattes-editor-copias`. Assim nenhum
// "Limpar" do app (clearAll, clearHistory, clearVersions, clearSent, o
// recomeço de resetStorage) alcança as cópias, e perder a chave do chaveiro
// não leva junto o ponto zero. Aqui só há `add`: nenhuma função apaga ou
// substitui uma linha. A pessoa leva a cópia para fora com "Salvar arquivo",
// no Histórico.

import Dexie, { type Table } from 'dexie';

import {
  type BackupStore,
  baselineName,
  restorePointName,
  sha256Hex,
  sidecarJson,
} from './backups.ts';

/** Uma cópia: o arquivo do Lattes e o sidecar em JSON, como na pasta do desktop. */
export interface BackupRow {
  bytes: Uint8Array;
  id?: number;
  kind: 'ponto-zero' | 'restauracao';
  lattesId: string;
  name: string;
  savedAt: number;
  sidecar: string;
}

class BackupDb extends Dexie {
  backups!: Table<BackupRow, number>;

  constructor() {
    super('lattes-editor-copias');
    this.version(1).stores({ backups: '++id, lattesId, [lattesId+kind]' });
  }
}

export const backupDb = new BackupDb();
const db = backupDb;

/** Quantos nomes tentar no mesmo minuto antes de desistir. */
const SAME_MINUTE_LIMIT = 99;

export const browserBackupStore: BackupStore = {
  folder: async () => undefined,

  list: async (lattesId) => {
    const rows = await db.backups.where('lattesId').equals(lattesId).sortBy('savedAt');
    return rows.map(({ bytes, kind, name, savedAt }) => ({
      kind,
      name,
      savedAt,
      size: bytes.length,
    }));
  },

  saveBaseline: async (lattesId, bytes, source, now) => {
    const name = baselineName(now);
    const sha = await sha256Hex(bytes);
    // Conferir e gravar na mesma transação: duas aberturas ao mesmo tempo
    // não gravam dois pontos zero.
    return db.transaction('rw', db.backups, async () => {
      const existing = await db.backups
        .where('[lattesId+kind]')
        .equals([lattesId, 'ponto-zero'])
        .count();
      if (existing > 0) return undefined;
      await db.backups.add({
        bytes: bytes.slice(),
        kind: 'ponto-zero',
        lattesId,
        name,
        savedAt: now.getTime(),
        sidecar: sidecarJson(
          { arquivo: name, origem: source, tipo: 'ponto-zero', versao: __APP_VERSION__ },
          bytes,
          now,
          sha,
        ),
      });
      return name;
    });
  },

  saveRestorePoint: async (lattesId, bytes, queue, now) => {
    const sha = await sha256Hex(bytes);
    return db.transaction('rw', db.backups, async () => {
      const taken = new Set(
        (await db.backups.where('lattesId').equals(lattesId).toArray()).map((r) => r.name),
      );
      let n = 1;
      while (taken.has(restorePointName(now, n))) n += 1;
      if (n > SAME_MINUTE_LIMIT) throw new Error('Restaurações demais no mesmo minuto.');
      const name = restorePointName(now, n);
      await db.backups.add({
        bytes: bytes.slice(),
        kind: 'restauracao',
        lattesId,
        name,
        savedAt: now.getTime(),
        sidecar: sidecarJson(
          {
            arquivo: name,
            fila: queue,
            origem: 'conector',
            tipo: 'restauracao',
            versao: __APP_VERSION__,
          },
          bytes,
          now,
          sha,
        ),
      });
      return name;
    });
  },

  where: 'navegador',
};

/** Os bytes de uma cópia do navegador, para "Baixar". */
export async function browserBackupBytes(
  lattesId: string,
  name: string,
): Promise<Uint8Array | undefined> {
  const row = await db.backups
    .where('lattesId')
    .equals(lattesId)
    .filter((r) => r.name === name)
    .first();
  return row?.bytes;
}
