// Lista de alterações a levar à mão ao Lattes, recalculada a cada edição, e a
// marcação de "feito", guardada com a cópia de trabalho.

import { type Dispatch, type SetStateAction, useMemo } from 'react';

import type { Session } from '../forms/use-production.ts';
import { acceptChange, diffDocuments, revertChange, revertField } from '../model/changes.ts';
import { SEQ_ATTR } from '../model/production.ts';
import { insertInSchemaOrder } from '../model/schema-order.ts';
import { getAttr, parseXml, serializeXml, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { changeCount, type ChangeEntry, type ChangeGroup, groupChanges } from './changes-view.ts';
import type { Section } from './sections.ts';

export function useChanges(
  session: Session | null,
  sections: Section[],
  version: number,
  onEdit: (note: string) => void,
  setSession: Dispatch<SetStateAction<Session | null>>,
): {
  /** Mudança gravada e conferida no Lattes pela ponte: vira o novo original. */
  accept: (key: string) => void;
  discard: (entry: ChangeEntry) => void;
  discardField: (entry: ChangeEntry, attr: string) => void;
  groups: ChangeGroup[];
  open: number;
} {
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
    return groupChanges(changes, original, session.doc.root, sections);
    // O documento é mutado no lugar; `version` avisa a mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, original, sections, version]);

  /** Volta a mudança ao valor da exportação, na cópia de trabalho. */
  const discard = (entry: ChangeEntry) => {
    if (!session || !original) return;
    const ok = revertChange(original, session.doc.root, entry.change, (parent, child) =>
      insertInSchemaOrder(lattesSchema, parent, child),
    );
    if (!ok) return;
    onEdit(`Alteração descartada: ${entry.itemTitle || entry.change.form}`);
  };

  /** Volta um campo só de uma mudança "alterado". */
  const discardField = (entry: ChangeEntry, attr: string) => {
    if (!session || !original) return;
    if (!revertField(original, session.doc.root, entry.change, attr)) return;
    const label = entry.change.fields.find((f) => f.attr === attr)?.label ?? attr;
    onEdit(`Campo descartado: ${entry.itemTitle || entry.change.form} · ${label}`);
  };

  const accept = (key: string) => {
    if (!session || !originalXml) return;
    const entry = groups.flatMap((g) => g.entries).find((e) => e.change.key === key);
    if (!entry) return;
    const doc = parseXml(originalXml);
    if (!acceptChange(doc.root, session.doc.root, entry.change)) return;
    const xml = serializeXml(doc);
    setSession((s) => (s ? { doc: s.doc, meta: { ...s.meta, originalXml: xml } } : s));
    onEdit(`Conferido no Lattes: ${entry.itemTitle || entry.change.form}`);
  };

  return { accept, discard, discardField, groups, open: changeCount(groups) };
}
