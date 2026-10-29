// As exportações abertas (LAT-12) para o App: cada uma fica guardada para o
// Histórico comparar, e, quando há uma anterior, a faixa curta diz o que
// mudou ("Recarregado do Lattes em 29/10: …") e leva ao Histórico.

import { createElement, useCallback, useState } from 'react';

import { addVersion, getVersion } from '../model/store.ts';
import { getAttr, parseXml, type XElement } from '../model/xml.ts';
import { OpenedBanner } from './HistoryChanges.tsx';
import { buildSections } from './sections.ts';
import { diffVersions, exportStamp, openedSummary } from './version-diff.ts';

export function useVersions(onShowHistory: () => void) {
  const [summary, setSummary] = useState<string>();

  /**
   * Exportação recém-aberta (já lida em `root`): fica guardada e, se havia
   * anterior, gera o resumo. Só a anterior é decifrada, e só quando gravou.
   * `reload`: veio de "Recarregar do Lattes".
   */
  const record = useCallback(async (root: XElement, xml: string, reload = false) => {
    // O aviso de antes era de outro arquivo; some já, mesmo se este não gravar.
    setSummary(undefined);
    const id = getAttr(root, 'NUMERO-IDENTIFICADOR');
    if (!id) return;
    const loadedAt = Date.now();
    const { added, previousId } = await addVersion({
      exportedAt: exportStamp(root),
      lattesId: id,
      loadedAt,
      xml,
    });
    const previous = added && previousId !== undefined ? await getVersion(previousId) : undefined;
    if (!previous) return;
    const diff = diffVersions(parseXml(previous.xml).root, root, buildSections(root));
    setSummary(openedSummary(diff, reload, loadedAt));
  }, []);

  const banner = createElement(OpenedBanner, {
    onClose: () => setSummary(undefined),
    onOpen: () => {
      setSummary(undefined);
      onShowHistory();
    },
    summary,
  });

  return { banner, record };
}
