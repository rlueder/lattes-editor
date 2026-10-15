// Cópias de segurança do currículo (LAT-59): o ponto zero, a primeira
// exportação de cada currículo, e um ponto de restauração antes de cada rodada
// de escrita do conector. São os arquivos que o Lattes entregou, byte a byte,
// sem cifra: é o mesmo arquivo que o Exportar dá.
//
// No app de desktop, vão para uma pasta visível da pessoa, em Documentos
// (src-tauri/src/copias.rs). No navegador não há acesso a pastas: ficam no
// IndexedDB, numa tabela que nenhum "Limpar" alcança (backup-store.ts).
// Nos dois, só se cria: nada sobrescreve nem apaga uma cópia.
//
// Aqui fica o que é igual nos dois: nomes, o sidecar, a interface e o que
// pode virar ponto zero.

import { isZip, readZip } from '../import-export/zip.ts';
import { getAttr, type XElement } from './xml.ts';

export type BackupKind = 'ponto-zero' | 'restauracao';

/** De onde veio a exportação: arquivo aberto ou solto, ou pedida pelo conector. */
export type BackupSource = 'arquivo' | 'conector';

export interface BackupFile {
  kind: BackupKind;
  name: string;
  /** Quando foi guardada (ms). */
  savedAt: number;
  size: number;
}

/** Contagem da fila por tipo de operação, sem valor nenhum do currículo. */
export type QueueSummary = Record<string, number>;

export interface BackupSidecar {
  /** O arquivo a que o sidecar se refere. */
  arquivo: string;
  /** Quantos bytes tem o arquivo. */
  bytes: number;
  /** Data e hora da cópia, ISO 8601. */
  data: string;
  /** Só no ponto de restauração: o que a rodada ia gravar. */
  fila?: QueueSummary;
  origem: BackupSource;
  /** SHA-256 do arquivo, em hexadecimal. */
  sha256: string;
  tipo: BackupKind;
  /** Versão do app que guardou. */
  versao: string;
}

/** Onde as cópias ficam e como guardá-las; desktop e navegador têm uma cada. */
export interface BackupStore {
  /** A pasta das cópias deste currículo, no desktop; undefined no navegador. */
  folder: (lattesId: string) => Promise<string | undefined>;
  /** As cópias deste currículo, da mais antiga à mais recente. */
  list: (lattesId: string) => Promise<BackupFile[]>;
  /**
   * Guarda o ponto zero se o currículo ainda não tem um. Devolve o nome do
   * arquivo, ou undefined quando já havia um (esse fica como está).
   */
  saveBaseline: (
    lattesId: string,
    bytes: Uint8Array,
    source: BackupSource,
    now: Date,
  ) => Promise<string | undefined>;
  /** Guarda um ponto de restauração; devolve o nome do arquivo. */
  saveRestorePoint: (
    lattesId: string,
    bytes: Uint8Array,
    queue: QueueSummary,
    now: Date,
  ) => Promise<string>;
  where: 'navegador' | 'pasta';
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

/** AAAA-MM-DD, na hora local. */
export function dayStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** AAAA-MM-DD-HHMM, na hora local. */
export function minuteStamp(d: Date): string {
  return `${dayStamp(d)}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function baselineName(now: Date): string {
  return `ponto-zero-${dayStamp(now)}.zip`;
}

/**
 * O nome que o Exportar dá ao ZIP: `CV_<16 dígitos>.zip`, no
 * Content-Disposition (lattes_internals.md, seção 12). Vale também
 * `<id>.zip`, e o " (1)" que o navegador acrescenta a um download repetido.
 */
export function isLattesZipName(fileName: string, lattesId: string): boolean {
  const m = /^(?:CV_)?(\d+)(?: \(\d+\))?\.zip$/i.exec(fileName.trim());
  return m?.[1] === lattesId;
}

/**
 * Só uma exportação do Lattes que ninguém mexeu vira o ponto zero. Pedida pelo
 * conector, sempre. Aberta de um arquivo, só o ZIP como o Exportar entrega: o
 * nome do Lattes, uma única entrada `<id>.xml` e a raiz CURRICULO-VITAE com
 * SISTEMA-ORIGEM-XML e o mesmo NUMERO-IDENTIFICADOR. Um XML solto nunca: pode
 * ter sido editado. O que não passa abre igual, só não vira ponto zero; o
 * primeiro ponto de restauração (pelo conector) preenche depois.
 */
export async function isBaselineCandidate({
  bytes,
  fileName,
  origin,
  root,
}: {
  bytes: Uint8Array;
  fileName: string;
  origin: BackupSource;
  root: XElement;
}): Promise<boolean> {
  if (!isZip(bytes)) return false;
  if (origin === 'conector') return true;
  const lattesId = getAttr(root, 'NUMERO-IDENTIFICADOR');
  if (root.name !== 'CURRICULO-VITAE' || !lattesId || !getAttr(root, 'SISTEMA-ORIGEM-XML')) {
    return false;
  }
  if (!isLattesZipName(fileName, lattesId)) return false;
  try {
    const entries = await readZip(bytes);
    return entries.length === 1 && entries[0]?.name === `${lattesId}.xml`;
  } catch {
    return false;
  }
}

export function restorePointName(now: Date, n = 1): string {
  return `restauracao-${minuteStamp(now)}${n > 1 ? `-${n}` : ''}.zip`;
}

/** O tipo pela forma do nome; undefined para o que não é do app. */
export function kindOfName(name: string): BackupKind | undefined {
  if (name.startsWith('ponto-zero-')) return 'ponto-zero';
  if (name.startsWith('restauracao-')) return 'restauracao';
  return undefined;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * O sidecar em JSON, legível por quem abrir a pasta. O hash vem pronto
 * (sha256Hex): quem grava no IndexedDB monta o sidecar dentro da transação,
 * que não pode esperar pelo crypto.subtle.
 */
export function sidecarJson(
  fields: Omit<BackupSidecar, 'bytes' | 'data' | 'sha256'>,
  bytes: Uint8Array,
  now: Date,
  sha256: string,
  { header = false }: { header?: boolean } = {},
): string {
  const sidecar: BackupSidecar = {
    ...fields,
    bytes: bytes.length,
    data: now.toISOString(),
    sha256,
  };
  if (!header) return `${JSON.stringify(sidecar, null, 2)}\n`;
  // Para um cabeçalho do invoke (backup-folder.ts): uma linha e só ASCII; o
  // Rust grava o arquivo formatado.
  return JSON.stringify(sidecar).replace(
    /[^\x20-\x7e]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** Quantas operações de cada tipo a fila tem. */
export function queueSummary(ops: readonly { kind: string }[]): QueueSummary {
  const out: QueueSummary = {};
  for (const { kind } of ops) out[kind] = (out[kind] ?? 0) + 1;
  return out;
}

/** A cópia mais recente, para quando não deu para fazer uma nova. */
export function latestBackup(files: readonly BackupFile[]): BackupFile | undefined {
  return files.reduce<BackupFile | undefined>(
    (best, f) => (!best || f.savedAt >= best.savedAt ? f : best),
    undefined,
  );
}
