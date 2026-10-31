// O estado do "Histórico" para o App: ler as quatro fontes ao abrir
// (history-timeline.ts), restaurar um momento, salvar o arquivo dele, abrir a
// pasta das cópias e limpar o que o app guarda. Restaurar troca só a cópia de
// trabalho; o que mudar fica no próprio histórico e pode ser restaurado de
// volta.

import { useCallback, useEffect, useRef, useState } from 'react';

import { failed } from '../bridge/sent-log.ts';
import { backupStore, readBackup, revealBackup } from '../desktop/backup-folder.ts';
import { isDesktop, saveBytes } from '../desktop/native.ts';
import type { Session } from '../forms/use-production.ts';
import { requestTab } from '../import-export/send-routes.ts';
import type { BackupFile } from '../model/backups.ts';
import { encodeCv, loadCv } from '../model/document.ts';
import {
  addHistoryPoint,
  clearHistory,
  getHistoryEntry,
  getVersion,
  listHistoryInfo,
  listSent,
  listVersionInfo,
  workingGenerationToken,
} from '../model/store.ts';
import { getAttr, parseXml, serializeXml, type XDocument } from '../model/xml.ts';
import { copyFileName } from './copy-name.ts';
import { buildTimeline, NOTES, type TimelineDay, type TimelineEntry } from './history-timeline.ts';
import { versionBytes } from './lattes-reload.ts';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const when = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** As cópias deste currículo; sem elas (a pasta não abriu), a lista segue sem os arquivos. */
async function backupsOf(lattesId: string): Promise<BackupFile[]> {
  try {
    return await backupStore().list(lattesId);
  } catch (err) {
    console.warn('Cópias de segurança não foram lidas:', message(err));
    return [];
  }
}

export interface HistoryDeps {
  /** A extensão está conectada: dá para comparar com o Lattes. */
  available: boolean;
  requestEspelho: () => void;
  session: Session | null;
  /** Troca o documento aberto pelo do momento escolhido, com a nota do próximo estado. */
  onRestore: (doc: XDocument, note: string) => void;
  /** Abre o painel de envio, no que já foi gravado no Lattes. */
  onShowSent: () => void;
}

export function useHistory({
  available,
  onRestore,
  onShowSent,
  requestEspelho,
  session,
}: HistoryDeps) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<TimelineDay[]>();
  const [error, setError] = useState<string>();
  const [folder, setFolder] = useState<string>();
  const lattesId = session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
  // "Comparar com o Lattes" pedido de fora (o sino, a versão guardada): sai
  // assim que a extensão estiver ligada.
  const compare = useRef(false);
  useEffect(() => {
    if (!compare.current || !available || !open) return;
    compare.current = false;
    requestEspelho();
  });

  const load = useCallback(async () => {
    const generation = workingGenerationToken();
    const [points, versions, backups, sent] = await Promise.all([
      listHistoryInfo(),
      lattesId ? listVersionInfo(lattesId) : [],
      lattesId ? backupsOf(lattesId) : [],
      lattesId ? listSent(lattesId) : [],
    ]);
    if (generation !== workingGenerationToken()) return;
    const sentInfo = sent.map((s) => ({ failed: failed(s), sentAt: s.sentAt, undoOf: s.undoOf }));
    setDays(buildTimeline({ backups, points, sent: sentInfo, versions }, Date.now()));
  }, [lattesId]);

  const show = useCallback(
    (options?: { compare?: boolean }) => {
      compare.current = Boolean(options?.compare);
      setError(undefined);
      setDays(undefined);
      setOpen(true);
      load().catch((err: unknown) => setError(message(err)));
      if (isDesktop() && lattesId) {
        backupStore()
          .folder(lattesId)
          .then(setFolder, () => setFolder(undefined));
      }
    },
    [lattesId, load],
  );
  const close = useCallback(() => setOpen(false), []);
  const act = (work: Promise<void>) => void work.catch((err: unknown) => setError(message(err)));

  /** A exportação guardada no app de uma abertura, se ainda está lá. */
  const storedExport = async (entry: TimelineEntry) =>
    entry.versionId !== undefined && entry.kind === 'abertura'
      ? await getVersion(entry.versionId)
      : undefined;
  /** O arquivo do ponto zero, se a linha tem um e ele ainda está guardado. */
  const zeroFile = async (entry: TimelineEntry) =>
    entry.backup?.kind === 'ponto-zero' && lattesId
      ? await readBackup(lattesId, entry.backup.name)
      : undefined;

  /**
   * Volta a cópia de trabalho ao estado guardado; sem ele, ao ponto zero do
   * arquivo, que é o que a linha promete, e só sem o arquivo à exportação
   * guardada no app. Nesses dois, a cópia de agora fica guardada antes, para
   * "Restaurar" de volta. O painel só fecha quando a troca aconteceu.
   */
  const restore = (entry: TimelineEntry) =>
    act(
      (async () => {
        if (!session) return;
        const generation = workingGenerationToken();
        const replace = async (doc: XDocument, before: string, note: string) => {
          // A cópia trocou enquanto se lia o arquivo: nada é guardado nem trocado.
          if (generation !== workingGenerationToken()) return false;
          await addHistoryPoint({
            keep: true,
            note: before,
            savedAt: Date.now(),
            xml: serializeXml(session.doc),
          });
          if (generation !== workingGenerationToken()) return false;
          onRestore(doc, note);
          return true;
        };
        let done = false;
        if (entry.pointId !== undefined) {
          const point = await getHistoryEntry(entry.pointId);
          if (!point || generation !== workingGenerationToken()) return;
          onRestore(parseXml(point.xml), `Restaurado: ${when(point.savedAt)}`);
          done = true;
        } else {
          const zero = await zeroFile(entry);
          if (zero && entry.backup) {
            const cv = await loadCv(zero, entry.backup.name);
            done = await replace(
              cv.doc,
              NOTES.antesDoPontoZero,
              `Restaurado: ponto zero de ${when(entry.backup.savedAt)}`,
            );
          } else {
            const version = await storedExport(entry);
            if (!version) {
              if (entry.backup || entry.versionId !== undefined) {
                throw new Error('A exportação não está mais guardada.');
              }
              return;
            }
            const cv = await loadCv(versionBytes(version.xml), `${version.lattesId}.xml`);
            done = await replace(
              cv.doc,
              NOTES.antesDaExportacao,
              `Restaurado: exportação aberta em ${when(version.loadedAt)}`,
            );
          }
        }
        if (done) setOpen(false);
      })(),
    );

  /**
   * O estado guardado como XML; sem ele, o arquivo da cópia como o Lattes
   * entregou e, só sem o arquivo, a exportação guardada no app.
   */
  const saveFile = (entry: TimelineEntry) =>
    act(
      (async () => {
        if (!session) return;
        if (entry.pointId !== undefined) {
          const generation = workingGenerationToken();
          const point = await getHistoryEntry(entry.pointId);
          if (!point || generation !== workingGenerationToken()) return;
          await saveBytes(
            encodeCv(parseXml(point.xml), session.meta.encoding),
            copyFileName(session.meta.fileName, new Date(point.savedAt)),
          );
          return;
        }
        const bytes =
          entry.backup && lattesId ? await readBackup(lattesId, entry.backup.name) : undefined;
        if (bytes && entry.backup) {
          const zip = entry.backup.name.endsWith('.zip');
          await saveBytes(bytes, entry.backup.name, zip ? 'application/zip' : 'application/xml');
          return;
        }
        const version = await storedExport(entry);
        if (version) {
          await saveBytes(
            versionBytes(version.xml),
            copyFileName(session.meta.fileName, new Date(version.loadedAt)),
            'application/xml',
          );
        } else if (entry.backup) {
          throw new Error('A cópia não está mais guardada.');
        }
      })(),
    );

  return {
    clear: () =>
      act(
        (async () => {
          await clearHistory(lattesId);
          await load();
        })(),
      ),
    close,
    days,
    desktop: isDesktop(),
    error,
    folder,
    open,
    restore,
    reveal: (entry?: TimelineEntry) => {
      if (lattesId) act(revealBackup(lattesId, entry?.backup?.name));
    },
    saveFile,
    show,
    showSent: () => {
      requestTab('enviado');
      setOpen(false);
      onShowSent();
    },
  };
}

export type HistoryState = ReturnType<typeof useHistory>;
