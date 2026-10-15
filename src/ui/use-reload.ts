// "Recarregar do Lattes…" no App (LAT-46): pela ponte ou por arquivo, a
// exportação nova só toma o lugar da cópia de trabalho depois de confirmar,
// quando há trabalho que não foi ao Lattes, e a cópia de antes fica no
// histórico. As regras estão em lattes-reload.ts (reloadPlan).

import { createElement, useState } from 'react';

import type { PendingSummary } from '../import-export/ExportPanel.tsx';
import { serializeXml, type XDocument } from '../model/xml.ts';
import { ReloadConfirm } from './dialogs.tsx';
import { reloadPlan } from './lattes-reload.ts';

export function useReload(
  session: { doc: XDocument; meta: { originalXml: string } } | null,
  work: { changes: number; pending: PendingSummary[] },
  openFile: (file: File, reload: { previous?: { note: string; xml: string } }) => unknown,
) {
  const [file, setFile] = useState<File | null>(null);
  const plan = () =>
    reloadPlan({
      currentXml: session ? serializeXml(session.doc) : '',
      newItems: work.pending.length,
      openChanges: work.changes,
      originalXml: session?.meta.originalXml ?? '',
    });

  const reload = (next: File) => {
    const p = plan();
    if (p.confirm) setFile(next);
    else void openFile(next, { previous: p.previous });
  };

  const dialog = createElement(ReloadConfirm, {
    changes: work.changes,
    file,
    onCancel: () => setFile(null),
    onConfirm: (next: File) => {
      setFile(null);
      void openFile(next, { previous: plan().previous });
    },
    pending: work.pending,
  });

  return { dialog, reload };
}
