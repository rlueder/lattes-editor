import type { WorkingCopy } from './database.ts';
import { type LoadedCv, maxSequenciaProducao } from './document.ts';
import { serializeXml } from './xml.ts';

/** Cópia de trabalho de um arquivo recém-carregado: a numeração do servidor vale a partir daqui (guia, 3.2). */
export function newWorkingCopy(cv: LoadedCv, now: number): WorkingCopy {
  const xml = serializeXml(cv.doc);
  const max = maxSequenciaProducao(cv.doc);
  return {
    encoding: cv.encoding,
    fileName: cv.fileName,
    id: 'current',
    loadedAt: now,
    loadedMaxSequencia: max,
    nextSequencia: max + 1,
    originalXml: xml,
    savedAt: now,
    xml,
  };
}
