// A última exportação guardada de um currículo (LAT-46), para a tela inicial
// oferecer abri-la quando o Exportar do Lattes está bloqueado por pendência.
// Só lê o índice das exportações; o XML é decifrado só ao abrir.

import { useCallback, useEffect, useState } from 'react';

import { getVersion, listVersionInfo } from '../model/store.ts';
import { versionBytes } from './lattes-reload.ts';
import type { StoredVersion } from './onboarding.ts';
import { versionDate } from './version-diff.ts';

/**
 * A última exportação guardada, 'procurando' enquanto o índice é lido (para
 * a tela não dizer "nenhuma" antes de saber), ou undefined sem nenhuma.
 */
export function useStoredVersion(
  lattesId: string | undefined,
): StoredVersion | 'procurando' | undefined {
  const [found, setFound] = useState<{ id?: string; stored?: StoredVersion }>({});
  useEffect(() => {
    if (!lattesId) return;
    let alive = true;
    listVersionInfo(lattesId)
      .then(([latest]) => {
        if (!alive) return;
        setFound({
          id: lattesId,
          stored:
            latest?.id !== undefined ? { date: versionDate(latest), id: latest.id } : undefined,
        });
      })
      .catch(() => alive && setFound({ id: lattesId }));
    return () => {
      alive = false;
    };
  }, [lattesId]);
  if (!lattesId) return undefined;
  return found.id === lattesId ? found.stored : 'procurando';
}

/**
 * Abre a última exportação guardada como o currículo de trabalho e, quando
 * ele está aberto (`ready`), chama `onOpened`: o App abre o Histórico já
 * comparando com o Lattes como ele está agora (a página de conferência, que
 * tem o que ainda não foi enviado ao CNPq). A página de conferência é texto,
 * não XML: ela não vira currículo editável, só comparação.
 */
export function useOpenStoredVersion(
  openFile: (file: File) => Promise<void>,
  ready: boolean,
  onOpened: () => void,
): (id: number) => void {
  // Em estado, e não em ref: marcar depois de abrir faz um render, e o efeito
  // vê o currículo pronto mesmo quando o render dele veio antes da marca.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened || !ready) return;
    setOpened(false);
    onOpened();
  }, [opened, ready, onOpened]);
  return useCallback(
    (id: number) => {
      void getVersion(id)
        .then(async (version) => {
          if (!version) return;
          await openFile(new File([versionBytes(version.xml)], `${version.lattesId}.xml`));
          setOpened(true);
        })
        .catch((err: unknown) => console.warn('Exportação guardada não abriu:', err));
    },
    [openFile],
  );
}
