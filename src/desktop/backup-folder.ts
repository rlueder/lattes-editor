// Cópias de segurança no app de desktop (LAT-59): a pasta visível
// `Documentos/LattesEditor/Cópias de segurança/<id>/`, gravada pelo Rust
// (src-tauri/src/copias.rs), que só cria arquivos novos e nunca sobrescreve.
// Fora do desktop, as cópias ficam no IndexedDB (src/model/backup-store.ts).

import type { InvokeArgs, InvokeOptions } from '@tauri-apps/api/core';

import { browserBackupBytes, browserBackupStore } from '../model/backup-store.ts';
import {
  type BackupFile,
  type BackupStore,
  baselineName,
  dayStamp,
  isBaselineCandidate,
  kindOfName,
  minuteStamp,
  restorePointName,
  sha256Hex,
  sidecarJson,
} from '../model/backups.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { isDesktop } from './native.ts';

async function invoke<T>(cmd: string, args: InvokeArgs, options?: InvokeOptions): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return options ? core.invoke<T>(cmd, args, options) : core.invoke<T>(cmd, args);
}

/**
 * O arquivo vai cru no corpo do invoke (Uint8Array, InvokeBody::Raw no Rust),
 * sem virar um vetor de números em JSON; o resto vai nos cabeçalhos
 * (src-tauri/src/copias.rs, parse_upload).
 */
function upload(lattesId: string, stamp: string, sidecar: string): InvokeOptions {
  return { headers: { 'x-lattes-id': lattesId, 'x-sidecar': sidecar, 'x-stamp': stamp } };
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
    const sidecar = sidecarJson(
      { arquivo: baselineName(now), origem: source, tipo: 'ponto-zero', versao: __APP_VERSION__ },
      bytes,
      now,
      await sha256Hex(bytes),
      { header: true },
    );
    const written = await invoke<string | null>(
      'backup_save_baseline',
      bytes,
      upload(lattesId, dayStamp(now), sidecar),
    );
    return written ?? undefined;
  },

  saveRestorePoint: async (lattesId, bytes, queue, now) => {
    // O Rust escolhe o nome final (-2, -3… no mesmo minuto) e o põe no sidecar.
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
      { header: true },
    );
    return invoke<string>(
      'backup_save_restore_point',
      bytes,
      upload(lattesId, minuteStamp(now), sidecar),
    );
  },

  where: 'pasta',
};

/** As cópias vão para a pasta no desktop e para o IndexedDB no navegador. */
export function backupStore(desktop = isDesktop()): BackupStore {
  return desktop ? folderBackupStore : browserBackupStore;
}

/**
 * Os bytes de uma cópia, pelo nome da lista: da pasta, no desktop (o Rust só
 * lê nomes de cópia, dentro da pasta deste currículo); do IndexedDB, no
 * navegador. Serve ao "Restaurar" do ponto zero e ao "Salvar arquivo".
 */
export async function readBackup(
  lattesId: string,
  name: string,
  desktop = isDesktop(),
): Promise<Uint8Array | undefined> {
  if (!desktop) return browserBackupBytes(lattesId, name);
  return new Uint8Array(await invoke<ArrayBuffer>('backup_read', { lattesId, name }));
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

/**
 * O ponto zero de um currículo recém-aberto, só quando ele é uma exportação
 * do Lattes sem mexer (pelo conector, ou o ZIP do Exportar); o resto abre
 * igual, sem virar ponto zero. Devolve o nome gravado, se gravou.
 */
export async function keepPristineBaseline(
  root: XElement,
  bytes: Uint8Array,
  fileName: string,
  origin: 'arquivo' | 'conector',
  store: BackupStore = backupStore(),
): Promise<string | undefined> {
  if (!(await isBaselineCandidate({ bytes, fileName, origin, root }))) return undefined;
  return keepBaseline(getAttr(root, 'NUMERO-IDENTIFICADOR'), bytes, origin, store);
}
