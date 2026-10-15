// Cópias de segurança no app de desktop (LAT-59): a pasta visível
// `Documentos/LattesEditor/Cópias de segurança/<id>/`, gravada pelo Rust
// (src-tauri/src/copias.rs), que só cria arquivos novos e nunca sobrescreve.
// Fora do desktop, as cópias ficam no IndexedDB (src/model/backup-store.ts).

import { browserBackupStore } from '../model/backup-store.ts';
import {
  backupExt,
  type BackupFile,
  type BackupStore,
  baselineName,
  dayStamp,
  kindOfName,
  minuteStamp,
  restorePointName,
  sha256Hex,
  sidecarJson,
} from '../model/backups.ts';
import { isDesktop } from './native.ts';

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

interface FolderEntry {
  modifiedAt: number;
  name: string;
  size: number;
}

export const folderBackupStore: BackupStore = {
  folder: (lattesId) => invoke<string>('backup_folder', { lattesId }),

  list: async (lattesId) => {
    const entries = await invoke<FolderEntry[]>('backup_list', { lattesId });
    return entries
      .flatMap(({ modifiedAt, name, size }): BackupFile[] => {
        const kind = kindOfName(name);
        return kind ? [{ kind, name, savedAt: modifiedAt, size }] : [];
      })
      .sort((a, b) => a.savedAt - b.savedAt);
  },

  saveBaseline: async (lattesId, bytes, source, now) => {
    const name = baselineName(bytes, now);
    const sidecar = sidecarJson(
      { arquivo: name, origem: source, tipo: 'ponto-zero', versao: __APP_VERSION__ },
      bytes,
      now,
      await sha256Hex(bytes),
    );
    const written = await invoke<string | null>('backup_save_baseline', {
      bytes: Array.from(bytes),
      ext: backupExt(bytes),
      lattesId,
      sidecar,
      stamp: dayStamp(now),
    });
    return written ?? undefined;
  },

  saveRestorePoint: async (lattesId, bytes, queue, now) => {
    // O Rust escolhe o nome final (-2, -3… no mesmo minuto); o sidecar cita o primeiro.
    const sidecar = sidecarJson(
      {
        arquivo: restorePointName(now),
        fila: queue,
        origem: 'conector',
        tipo: 'restauracao',
        versao: __APP_VERSION__,
      },
      bytes,
      now,
      await sha256Hex(bytes),
    );
    return invoke<string>('backup_save_restore_point', {
      bytes: Array.from(bytes),
      lattesId,
      sidecar,
      stamp: minuteStamp(now),
    });
  },

  where: 'pasta',
};

/** As cópias vão para a pasta no desktop e para o IndexedDB no navegador. */
export function backupStore(desktop = isDesktop()): BackupStore {
  return desktop ? folderBackupStore : browserBackupStore;
}

/** "Mostrar na pasta": o arquivo no Finder ou no Explorer; sem nome, a pasta. */
export async function revealBackup(lattesId: string, name?: string): Promise<void> {
  await invoke('backup_reveal', { lattesId, name: name ?? null });
}

/**
 * Guarda a exportação como ponto zero, se o currículo ainda não tem um. Nunca
 * derruba quem chama: abrir o currículo não depende da cópia.
 */
export async function keepBaseline(
  lattesId: string | undefined,
  bytes: Uint8Array,
  source: 'arquivo' | 'conector',
  store: BackupStore = backupStore(),
  now = new Date(),
): Promise<string | undefined> {
  if (!lattesId) return undefined;
  try {
    return await store.saveBaseline(lattesId, bytes, source, now);
  } catch (err) {
    console.warn('O ponto zero não foi guardado:', err);
    return undefined;
  }
}
