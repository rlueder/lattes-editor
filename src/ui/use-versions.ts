// Estado da linha do tempo de versões (LAT-12) para o App: guarda cada
// exportação aberta, monta o resumo do que mudou desde a anterior e abre o
// diálogo "Versões do Lattes".

import { createElement, useCallback, useMemo, useState } from 'react';

import { addVersion, clearVersions, type LattesVersion, listVersions } from '../model/store.ts';
import { getAttr, parseXml } from '../model/xml.ts';
import type { HashRoute } from './hash-route.ts';
import { buildSections } from './sections.ts';
import { diffSummary, diffVersions, exportStamp, versionDate } from './version-diff.ts';
import { VersionBanner, VersionsDialog } from './VersionsDialog.tsx';

const lattesIdOf = (xml: string | undefined) =>
  xml ? getAttr(parseXml(xml).root, 'NUMERO-IDENTIFICADOR') : undefined;

export function useVersions(originalXml: string | undefined, onGo: (route: HashRoute) => void) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<LattesVersion[]>([]);
  const [summary, setSummary] = useState<string>();
  const lattesId = useMemo(() => lattesIdOf(originalXml), [originalXml]);

  /** Exportação recém-aberta: vira versão e, se havia anterior, gera o resumo. */
  const record = useCallback(async (xml: string) => {
    const root = parseXml(xml).root;
    const id = getAttr(root, 'NUMERO-IDENTIFICADOR');
    if (!id) return;
    const [previous] = await listVersions(id, 1);
    const added = await addVersion({
      exportedAt: exportStamp(root),
      lattesId: id,
      loadedAt: Date.now(),
      xml,
    });
    if (!added || !previous) {
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
