// "Cópias de segurança", em ⚙ › Versões (LAT-59): o ponto zero e os pontos de
// restauração deste currículo, com a data. No desktop, a pasta e "Mostrar na
// pasta"; no navegador, "Baixar". Nada aqui apaga: a pasta é da pessoa, e no
// navegador nenhuma função do app remove uma cópia.

import { useEffect, useState } from 'react';

import { backupStore, revealBackup } from '../desktop/backup-folder.ts';
import { isDesktop, saveBytes } from '../desktop/native.ts';
import { browserBackupBytes } from '../model/backup-store.ts';
import type { BackupFile } from '../model/backups.ts';

const KIND_LABEL: Record<BackupFile['kind'], string> = {
  'ponto-zero': 'Ponto zero',
  restauracao: 'Ponto de restauração',
};

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const size = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024).toLocaleString('pt-BR')} kB`;

async function download(lattesId: string, file: BackupFile): Promise<void> {
  const bytes = await browserBackupBytes(lattesId, file.name);
  if (!bytes) return;
  await saveBytes(
    bytes,
    file.name,
    file.name.endsWith('.zip') ? 'application/zip' : 'application/xml',
  );
}

export function BackupsSection({ lattesId, open }: { lattesId?: string; open: boolean }) {
  const desktop = isDesktop();
  const [files, setFiles] = useState<BackupFile[]>();
  const [folder, setFolder] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !lattesId) return;
    let current = true;
    const store = backupStore();
    setError(undefined);
    Promise.all([store.list(lattesId), store.folder(lattesId)]).then(
      ([list, dir]) => {
        if (!current) return;
        setFiles([...list].reverse());
        setFolder(dir);
      },
      (err: unknown) => {
        if (!current) return;
        setFiles([]);
        setError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      current = false;
    };
  }, [open, lattesId]);

  if (!lattesId) return null;
  const act = (work: Promise<void>) =>
    void work.catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  const baseline = files?.find((f) => f.kind === 'ponto-zero');

  return (
    <section aria-labelledby="backups-title" className="backups">
      <div className="backups-head">
        <h3 id="backups-title">Cópias de segurança</h3>
        {desktop ? (
          <button className="ghost" type="button" onClick={() => act(revealBackup(lattesId))}>
            Mostrar na pasta
          </button>
        ) : (
          baseline && (
            <button
              className="ghost"
              type="button"
              onClick={() => act(download(lattesId, baseline))}
            >
              Baixar ponto zero
            </button>
          )
        )}
      </div>
      <p className="muted backups-note">
        {desktop ? (
          <>
            Em <code>{folder ?? 'Documentos/LattesEditor/Cópias de segurança'}</code>, sem cifra: é
            o mesmo arquivo que o Exportar do Lattes dá, e a pasta é sua.
          </>
        ) : (
          'No navegador, as cópias ficam dentro do próprio navegador, sem cifra. Baixe o ponto zero para tê-lo fora dele.'
        )}
      </p>
      {error && <p className="error">{error}</p>}
      {files && files.length === 0 && !error && (
        <p className="muted">
          Nenhuma cópia ainda. A primeira exportação aberta deste currículo vira o ponto zero, e
          cada envio pelo conector guarda um ponto de restauração antes de gravar.
        </p>
      )}
      {files && files.length > 0 && (
        <ul className="backups-list">
          {files.map((f) => (
            <li key={f.name}>
              <span className="backups-kind">{KIND_LABEL[f.kind]}</span>
              <span className="backups-name">
                {dateTime(f.savedAt)}
                <span className="muted">
                  {' '}
                  · {f.name} · {size(f.size)}
                </span>
              </span>
              {desktop ? (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => act(revealBackup(lattesId, f.name))}
                >
                  Mostrar na pasta
                </button>
              ) : (
                <button className="ghost" type="button" onClick={() => act(download(lattesId, f))}>
                  Baixar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
