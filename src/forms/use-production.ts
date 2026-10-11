// Estado e ações dos itens de produção novos: abrir formulário, salvar,
// remover, listar pendentes e montar o arquivo de importação.

import { useMemo, useState } from 'react';

import type { PendingSummary } from '../import-export/ExportPanel.tsx';
import { buildImportFile, type ImportFile } from '../import-export/import-file.ts';
import { applyCrossref, crossrefAuthors, type CrossrefWork } from '../lookups/crossref.ts';
import {
  addProduction,
  authorElementName,
  findBySequencia,
  knownAreas,
  knownAuthors,
  newItem,
  nextSequencia,
  pendingItems,
  type ProductionType,
  productionType,
  pruneEmptyExtras,
  removeProduction,
  replaceProduction,
  SEQ_ATTR,
  setAuthors,
} from '../model/production.ts';
import type { WorkingCopy } from '../model/store.ts';
import { validateItem } from '../model/validate.ts';
import { setAttr, type XDocument, type XElement } from '../model/xml.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { itemMeta } from '../ui/item-meta.ts';

export type SessionMeta = Omit<WorkingCopy, 'xml' | 'savedAt'>;

export interface Session {
  doc: XDocument;
  meta: SessionMeta;
}

export interface FormState {
  isNew: boolean;
  item: XElement;
  sequencia: number;
  type: ProductionType;
}

export function useProduction(
  session: Session | null,
  setSession: (s: Session) => void,
  version: number,
  onEdit: (note: string) => void,
) {
  const [form, setForm] = useState<FormState | null>(null);
  const loadedMax = session?.meta.loadedMaxSequencia ?? Number.POSITIVE_INFINITY;

  const pending = useMemo(
    () => (session ? pendingItems(session.doc, loadedMax) : []),
    // O documento é mutado no lugar; `version` avisa a mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version, loadedMax],
  );

  const summaries: PendingSummary[] = useMemo(
    () =>
      pending.map((el) => {
        const meta = itemMeta(el);
        return {
          problems: validateItem(schema, el),
          sequencia: Number(el.attrs.find((a) => a.name === SEQ_ATTR)?.value),
          title: meta.title,
          type: el.name,
          year: meta.year,
        };
      }),
    [pending],
  );

  const authors = useMemo(
    () => (session ? knownAuthors(session.doc) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );

  const areas = useMemo(
    () => (session ? knownAreas(session.doc) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );

  const startNew = (type: ProductionType, work?: CrossrefWork) => {
    if (!session) return;
    const sequencia = nextSequencia(session.doc, session.meta.nextSequencia);
    const item = newItem(schema, type.itemName, sequencia);
    if (work) applyCrossref(item, work);
    // O dono do currículo é o autor 1 por padrão (guia, marco 2); com DOI, vale a lista do Crossref.
    if (authorElementName(schema, type.itemName)) {
      const fromDoi = work ? crossrefAuthors(work, authors) : [];
      const list = fromDoi.length > 0 ? fromDoi : authors.slice(0, 1);
      if (list.length > 0) setAuthors(schema, item, list);
    }
    setForm({ isNew: true, item, sequencia, type });
  };

  const openItem = (sequencia: number) => {
    if (!session) return;
    const el = findBySequencia(session.doc, sequencia);
    const type = el && productionType(schema, el.name);
    if (!el || !type) return;
    setForm({ isNew: false, item: structuredClone(el), sequencia, type });
  };

  /** `another`: depois de salvar um item novo, abre outro em branco do mesmo tipo. */
  const save = (item: XElement, another = false) => {
    if (!session || !form) return;
    pruneEmptyExtras(item);
    if (form.isNew) {
      // O número só é gasto ao salvar; cancelar um rascunho não abre lacuna.
      const sequencia = nextSequencia(session.doc, session.meta.nextSequencia);
      setAttr(item, SEQ_ATTR, String(sequencia));
      addProduction(schema, session.doc, form.type, item);
      setSession({ doc: session.doc, meta: { ...session.meta, nextSequencia: sequencia + 1 } });
      onEdit(`Novo item: ${itemMeta(item).title || form.type.itemName}`);
      if (another) {
        const next = nextSequencia(session.doc, sequencia + 1);
        const blank = newItem(schema, form.type.itemName, next);
        if (authorElementName(schema, form.type.itemName) && authors.length > 0) {
          setAuthors(schema, blank, authors.slice(0, 1));
        }
        setForm({ isNew: true, item: blank, sequencia: next, type: form.type });
        return;
      }
    } else {
      replaceProduction(session.doc, form.sequencia, item);
      onEdit(`Item editado: ${itemMeta(item).title || item.name}`);
    }
    setForm(null);
  };

  const remove = () => {
    if (!session || !form || form.isNew) return;
    removeProduction(session.doc, form.sequencia);
    onEdit(`Item removido: nº ${form.sequencia}`);
    setForm(null);
  };

  const buildFile = (): ImportFile | undefined =>
    session && summaries.every((s) => s.problems.length === 0) && pending.length > 0
      ? buildImportFile(session.doc, session.meta.encoding, loadedMax)
      : undefined;

  return {
    areas,
    authors,
    buildFile,
    cancel: () => setForm(null),
    form,
    loadedMax,
    openItem,
    pending,
    remove,
    save,
    startNew,
    summaries,
  };
}
