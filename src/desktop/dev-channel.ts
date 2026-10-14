// Canal Dev (.github/workflows/dev.yml): o LattesEditor Dev traz a extensão
// Dev no pacote e a copia para uma pasta da pasta de dados
// (src-tauri/src/extensao_dev.rs). O editor só precisa dizer, uma vez, qual
// pasta carregar no navegador; depois a extensão se atualiza junto com o app.

import { useEffect, useState } from 'react';

import { isDesktop } from './native.ts';

/** A página do canal Dev, com o app e a extensão do último build da main. */
export const DEV_PAGE_URL = 'https://github.com/rlueder/lattes-editor/releases/tag/dev';

/** Versão do canal Dev: 0.22.0-dev.42. */
export function isDevVersion(version: string): boolean {
  return /-dev\.\d+$/.test(version);
}

/** A pasta da extensão Dev, no LattesEditor Dev; undefined fora dele. */
export function useDevExtensionFolder(): string | undefined {
  const [folder, setFolder] = useState<string | undefined>();
  useEffect(() => {
    if (!isDesktop() || !isDevVersion(__APP_VERSION__)) return;
    let alive = true;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<string | null>('extensao_dev_pasta'))
      .then((path) => alive && setFolder(path ?? undefined))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return folder;
}
