// Lista de alterações a levar à mão ao Lattes, recalculada a cada edição, e a
// marcação de "feito", guardada com a cópia de trabalho.

import { useMemo } from 'react';

import type { Session } from '../forms/use-production.ts';
import { diffDocuments } from '../model/changes.ts';
import { SEQ_ATTR } from '../model/production.ts';
import { getAttr, parseXml, type XElement } from '../model/xml.ts';
import { type ChangeEntry, type ChangeGroup, groupChanges, openCount } from './changes-view.ts';
import type { Section } from './sections.ts';

export function useChanges(
  session: Session | null,
  sections: Section[],
  version: number,
  setSession: (s: Session) => void,
  onEdit: (note: string) => void,
): { groups: ChangeGroup[]; open: number; toggleDone: (entry: ChangeEntry) => void } {
  const originalXml = session?.meta.originalXml;
  const original = useMemo(
    () => (originalXml ? parseXml(originalXml).root : undefined),
    [originalXml],
  );

  const groups = useMemo(() => {
    if (!session || !original) return [];
    const loadedMax = session.meta.loadedMaxSequencia;
    // Produção nova vai pelo Importar, não por esta lista.
    const skip = (el: XElement) => Number(getAttr(el, SEQ_ATTR) ?? 0) > loadedMax;
    const changes = diffDocuments(original, session.doc.root, { skip });
    return groupChanges(
      changes,
      original,
      session.doc.root,
      sections,
      session.meta.doneChanges ?? {},
    );
    // O documento é mutado no lugar; `version` avisa a mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, original, sections, version]);

  const toggleDone = (entry: ChangeEntry) => {
    if (!session) return;
    const done = { ...(session.meta.doneChanges ?? {}) };
    if (entry.done) delete done[entry.change.key];
    else done[entry.change.key] = entry.signature;
    setSession({ doc: session.doc, meta: { ...session.meta, doneChanges: done } });
    onEdit(entry.done ? 'Alteração reaberta' : 'Alteração feita no Lattes');
  };

  return { groups, open: openCount(groups), toggleDone };
}
