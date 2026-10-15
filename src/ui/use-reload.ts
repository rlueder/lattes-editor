// "Recarregar do Lattes…" no App (LAT-46): pela ponte ou por arquivo, a
// exportação nova só toma o lugar da cópia de trabalho depois de confirmar,
// quando há trabalho que não foi ao Lattes, e a cópia de antes fica no
// histórico. As regras estão em lattes-reload.ts (reloadPlan).

import { createElement, useState } from 'react';

import type { PendingSummary } from '../import-export/ExportPanel.tsx';
import type { BackupSource } from '../model/backups.ts';
import { serializeXml, type XDocument } from '../model/xml.ts';
import { ReloadConfirm } from './dialogs.tsx';
import { reloadPlan } from './lattes-reload.ts';

/** O que openFile recebe num recarregar: com previous, a cópia de trabalho de antes. */
export interface ReloadArg {
  previous?: { note: string; xml: string };
}

export function useReload(
  session: { doc: XDocument; meta: { originalXml: string } } | null,
  work: { changes: number; pending: PendingSummary[] },
  openFile: (file: File, reload: ReloadArg, origin?: BackupSource) => unknown,
) {
  // origin: de onde veio a exportação (arquivo ou conector), para o ponto zero (LAT-59).
  const [queued, setQueued] = useState<{ file: File; origin?: BackupSource } | null>(null);
  const plan = () =>
    reloadPlan({
      currentXml: session ? serializeXml(session.doc) : '',
      newItems: work.pending.length,
      openChanges: work.changes,
      originalXml: session?.meta.originalXml ?? '',
    });

  const reload = (next: File, origin?: BackupSource) => {
    const p = plan();
    if (p.confirm) setQueued({ file: next, origin });
    else void openFile(next, { previous: p.previous }, origin);
  };

  const dialog = createElement(ReloadConfirm, {
    changes: work.changes,
    file: queued?.file ?? null,
    onCancel: () => setQueued(null),
    onConfirm: (next: File) => {
      const origin = queued?.origin;
      setQueued(null);
      void openFile(next, { previous: plan().previous }, origin);
    },
    pending: work.pending,
  });

  return { dialog, reload };
}
