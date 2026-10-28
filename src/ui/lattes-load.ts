// "Carregar do Lattes" no editor: o currículo montado pelas listas e pelos
// formulários (src/bridge/load/) entra pelo mesmo caminho do ZIP do Exportar
// (lattes-open.ts, lattes-reload.ts), como um arquivo XML. Aqui ficam as
// regras; o efeito está em use-lattes-load.ts.

import type { ExportFailure } from '../bridge/export.ts';
import { toBase64 } from '../bridge/export.ts';
import type { LoadGap, LoadProgress, LoadResult } from '../bridge/load/loader.ts';
import { encodeLatin1 } from '../model/latin1.ts';
import { getAttr, serializeXml } from '../model/xml.ts';
import type { CurriculoReading } from './bridge-readings.ts';
import type { Notice } from './notifications.ts';

export const LOAD_FEATURE = 'carregar-do-lattes';

/** O nome do arquivo que o editor mostra para o currículo lido do Lattes. */
export const LOADED_NAME = 'curriculo-lattes.xml';

/** O motivo da falha, como o caminho do Exportar o entende. */
function reasonOf(stopped: LoadResult['stopped'], failure?: string): ExportFailure {
  if (failure === 'consentimento' || failure === 'sem-aba') return failure;
  return stopped?.reason === 'sessao' ? 'sessao' : 'erro';
}

/** A resposta do pedido, no formato da do Exportar: o XML em base64, ou o motivo. */
export function loadReply(
  id: string,
  result: LoadResult,
  failure: { lattesId?: string; reason?: string } | undefined,
  at: number,
): CurriculoReading {
  if (!result.doc || result.stopped) {
    return {
      at,
      detail: result.stopped?.error,
      id,
      lattesId: failure?.lattesId,
      reason: reasonOf(result.stopped, failure?.reason),
    };
  }
  const bytes = encodeLatin1(serializeXml(result.doc));
  return {
    at,
    fileName: LOADED_NAME,
    id,
    lattesId: getAttr(result.doc.root, 'NUMERO-IDENTIFICADOR'),
    zip: toBase64(new Uint8Array(bytes)),
  };
}

export function progressText(p: LoadProgress): string {
  switch (p.phase) {
    case 'menu':
      return 'Lendo o menu do currículo.';
    case 'listas':
      return `Lendo as listas (${p.done} páginas).`;
    case 'formularios':
      return `Lendo os formulários (${p.done} páginas).`;
  }
}

/** O que não veio, no sino; nada quando tudo veio. */
export function loadNotice(gaps: readonly LoadGap[]): Notice | undefined {
  if (gaps.length === 0) return undefined;
  const lines = gaps.map((g) => `${g.section}: ${g.reason}${g.count > 1 ? ` (${g.count})` : ''}.`);
  return {
    id: 'carregar-lattes',
    level: 'info',
    text: lines.join(' '),
    title: 'O que não veio dos formulários do Lattes',
  };
}
