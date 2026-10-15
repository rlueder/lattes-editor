// A última versão guardada de um currículo (LAT-46), para a tela inicial
// oferecer abri-la quando o Exportar do Lattes está bloqueado por pendência.
// Só lê o índice das versões; o XML é decifrado só ao abrir.

import { useCallback, useEffect, useRef, useState } from 'react';

import { getVersion, listVersionInfo } from '../model/store.ts';
import { versionBytes } from './lattes-reload.ts';
import type { StoredVersion } from './onboarding.ts';
import { versionDate } from './version-diff.ts';

export function useStoredVersion(lattesId: string | undefined): StoredVersion | undefined {
  const [stored, setStored] = useState<StoredVersion | undefined>();
  useEffect(() => {
    setStored(undefined);
    if (!lattesId) return;
    let alive = true;
    listVersionInfo(lattesId)
      .then(([latest]) => {
        if (alive && latest?.id !== undefined) {
          setStored({ date: versionDate(latest), id: latest.id });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lattesId]);
  return stored;
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
