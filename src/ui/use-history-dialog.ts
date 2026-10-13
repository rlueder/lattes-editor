// O diálogo "Histórico de alterações": os pontos guardados no app, restaurar
// um deles e salvar a cópia de um ponto num arquivo.

import { useCallback, useState } from 'react';

import { saveBytes } from '../desktop/native.ts';
import type { Session } from '../forms/use-production.ts';
import { encodeCv } from '../model/document.ts';
import { type HistoryEntry, listHistory } from '../model/store.ts';
import { parseXml, type XDocument } from '../model/xml.ts';
import { copyFileName } from './copy-name.ts';

export function useHistoryDialog(
  session: Session | null,
  /** Troca o documento aberto pelo do ponto, com a nota para o próximo ponto. */
  onRestore: (doc: XDocument, note: string) => void,
) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const close = useCallback(() => setOpen(false), []);
  return {
    close,
    entries,
    open,
    restore: (entry: HistoryEntry) => {
      onRestore(
        parseXml(entry.xml),
        `Restaurado: ${new Date(entry.savedAt).toLocaleString('pt-BR')}`,
      );
      setOpen(false);
    },
    saveCopy: (entry: HistoryEntry) => {
      if (!session) return;
      void saveBytes(
        encodeCv(parseXml(entry.xml), session.meta.encoding),
        copyFileName(session.meta.fileName, new Date(entry.savedAt)),
      );
    },
    show: async () => {
      setEntries(await listHistory());
      setOpen(true);
    },
  };
}
