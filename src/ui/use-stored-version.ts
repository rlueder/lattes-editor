// A última versão guardada de um currículo (LAT-46), para a tela inicial
// oferecer abri-la quando o Exportar do Lattes está bloqueado por pendência.
// Só lê o índice das versões; o XML é decifrado só ao abrir.

import { useCallback, useEffect, useRef, useState } from 'react';

import { getVersion, listVersionInfo } from '../model/store.ts';
import { versionBytes } from './lattes-reload.ts';
import type { StoredVersion } from './onboarding.ts';
import { versionDate } from './version-diff.ts';

/**
 * A última versão guardada, 'procurando' enquanto o índice é lido (para a
 * tela não dizer "nenhuma versão" antes de saber), ou undefined sem versão.
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
 * Abre uma versão guardada como o currículo de trabalho e, com a extensão
 * ligada, abre o diagnóstico já comparando com a versão atual do Lattes
 * (a página de conferência, que tem o que ainda não foi enviado ao CNPq).
 * A página de conferência é texto, não XML: ela não vira currículo editável,
 * só diagnóstico.
 */
export function useOpenStoredVersion(
  openFile: (file: File) => Promise<void>,
  bridge: { available: boolean; requestEspelho: () => void },
  openDiagnosis: () => void,
): (id: number) => void {
  const compare = useRef(false);
  const { available, requestEspelho } = bridge;
  useEffect(() => {
    if (!compare.current || !available) return;
    compare.current = false;
    requestEspelho();
  });
  return useCallback(
    (id: number) => {
      void getVersion(id)
        .then(async (version) => {
          if (!version) return;
          await openFile(new File([versionBytes(version.xml)], `${version.lattesId}.xml`));
          compare.current = true;
          openDiagnosis();
        })
        .catch((err: unknown) => console.warn('Versão guardada não abriu:', err));
    },
    [openFile, openDiagnosis],
  );
}
