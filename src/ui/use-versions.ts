// Estado da linha do tempo de versões (LAT-12) para o App: guarda cada
// exportação aberta, monta o resumo do que mudou desde a anterior e abre o
// diálogo "Versões do Lattes".

import { createElement, useCallback, useState } from 'react';

import {
  addVersion,
  clearVersions,
  getVersion,
  type LattesVersion,
  listVersions,
} from '../model/store.ts';
import { getAttr, parseXml, type XElement } from '../model/xml.ts';
import type { HashRoute } from './hash-route.ts';
import { buildSections } from './sections.ts';
import { diffSummary, diffVersions, exportStamp, versionDate } from './version-diff.ts';
import { VersionBanner, VersionsDialog } from './VersionsDialog.tsx';

/**
 * O currículo das versões vem do documento já aberto (NUMERO-IDENTIFICADOR
 * da raiz), para não reler o XML inteiro só por um atributo.
 */
export function useVersions(root: XElement | undefined, onGo: (route: HashRoute) => void) {
  const lattesId = root && getAttr(root, 'NUMERO-IDENTIFICADOR');
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<LattesVersion[]>([]);
  const [summary, setSummary] = useState<string>();

  /**
   * Exportação recém-aberta (já lida em `root`): vira versão e, se havia
   * anterior, gera o resumo. Só a anterior é decifrada, e só quando gravou.
   */
  const record = useCallback(async (root: XElement, xml: string) => {
    const id = getAttr(root, 'NUMERO-IDENTIFICADOR');
    if (!id) return;
    const { added, previousId } = await addVersion({
      exportedAt: exportStamp(root),
      lattesId: id,
      loadedAt: Date.now(),
      xml,
    });
    const previous = added && previousId !== undefined ? await getVersion(previousId) : undefined;
    if (!previous) {
      setSummary(undefined);
      return;
    }
    const diff = diffVersions(parseXml(previous.xml).root, root, buildSections(root));
    setSummary(diffSummary(diff, versionDate(previous)));
  }, []);

  const show = useCallback(async () => {
    setVersions(lattesId ? await listVersions(lattesId) : []);
    setOpen(true);
  }, [lattesId]);

  const banner = createElement(VersionBanner, {
    onClose: () => setSummary(undefined),
    onOpen: () => {
      setSummary(undefined);
      void show();
    },
    summary,
  });

  const dialog = createElement(VersionsDialog, {
    onClear: () => {
      if (!lattesId) return;
      void clearVersions(lattesId).then(() => setVersions([]));
    },
    onClose: () => setOpen(false),
    onGo: (route: HashRoute) => {
      setOpen(false);
      onGo(route);
    },
    open,
    versions,
  });

  return { banner, dialog, record, show };
}
