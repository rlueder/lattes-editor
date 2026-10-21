// A cópia de trabalho no App: restaurar a da última sessão ao abrir e gravar
// depois de cada edição, com uma pausa curta. Saiu do App.tsx sem mudar nada.

import { type MutableRefObject, useEffect, useState } from 'react';

import type { Session } from '../forms/use-production.ts';
import { maxSequenciaProducao } from '../model/document.ts';
import { loadWorkingCopy, saveWorkingCopy, workingGenerationToken } from '../model/store.ts';
import { parseXml, serializeXml } from '../model/xml.ts';
import type { SaveState } from './Topbar.tsx';

const AUTOSAVE_MS = 400;

/** Restaura a cópia de trabalho da última sessão; booting fica true até terminar. */
export function useRestoreWorkingCopy(
  setSession: (s: Session) => void,
  setError: (e: string | null) => void,
): boolean {
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    loadWorkingCopy()
      .then((copy) => {
        if (copy) {
          const { savedAt: _savedAt, xml, ...meta } = copy;
          // Cópias salvas antes do marco 2 não tinham o máximo da exportação.
          const loadedMaxSequencia =
            meta.loadedMaxSequencia ?? maxSequenciaProducao(parseXml(meta.originalXml));
          setSession({ doc: parseXml(xml), meta: { ...meta, loadedMaxSequencia } });
        }
      })
      .catch((err: unknown) =>
        setError(`Não foi possível ler a cópia salva no navegador: ${String(err)}`),
      )
      .finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return booting;
}

/** Autosave: cada edição marca uma versão; grava depois de uma pausa curta. */
export function useAutosave(
  session: Session | null,
  version: number,
  pendingNotes: MutableRefObject<string[]>,
): [SaveState, (s: SaveState) => void] {
  const [saveState, setSaveState] = useState<SaveState>('salvo');
  useEffect(() => {
    if (!session || version === 0) return;
    setSaveState('salvando');
    let current = true;
    const generation = workingGenerationToken();
    const timer = setTimeout(() => {
      const notes = pendingNotes.current.splice(0);
      const note =
        notes.length > 1 ? `${notes.at(-1)} (+${notes.length - 1})` : (notes[0] ?? 'Alteração');
      saveWorkingCopy(
        { ...session.meta, savedAt: Date.now(), xml: serializeXml(session.doc) },
        note,
        generation,
      )
        .then(() => current && setSaveState('salvo'))
        .catch(() => current && setSaveState('erro'));
    }, AUTOSAVE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [session, version, pendingNotes]);
  return [saveState, setSaveState];
}
