// O pedido do editor para o Importar pelo conector (LAT-50): o arquivo mínimo
// (opção 1 do guia, 3.3), os módulos a marcar no passo 2 e o ano do item novo
// mais antigo. Nada sai com IMPORT_ENABLED desligado.

import { toBase64 } from '../bridge/export.ts';
import { IMPORT_ENABLED, STEP2_MODULE_VALUES } from '../bridge/importar.ts';
import type { Link } from '../bridge/link.ts';
import type { EditorMessage } from '../bridge/protocol.ts';
import type { XDocument } from '../model/xml.ts';
import { buildMinimalImportFile } from './import-file.ts';

export type ImportMessage = Extract<EditorMessage, { type: 'importar' }>;

/**
 * A mensagem "importar" para a extensão, ou undefined quando o Importar pelo
 * conector está desligado, quando não há item novo ou quando algum item cai
 * fora dos 17 módulos.
 */
export function importMessage(
  doc: XDocument,
  encoding: string,
  loadedMax: number,
  ids: { id: string; lattesId?: string },
  enabled = IMPORT_ENABLED,
  now = new Date(),
): ImportMessage | undefined {
  if (!enabled) return undefined;
  const file = buildMinimalImportFile(doc, encoding, loadedMax, now);
  if (file.newItems === 0) return undefined;
  const modules = file.modules.map((m) => STEP2_MODULE_VALUES[m.id]);
  if (!modules.length || modules.some((m) => m === undefined)) return undefined;
  return {
    file: toBase64(file.bytes),
    fileName: file.fileName,
    id: ids.id,
    lattesId: ids.lattesId,
    modules: modules as number[],
    oldestYear: file.oldestYear,
    type: 'importar',
  };
}

/**
 * O botão do Importar pelo conector aparece só com IMPORT_ENABLED e com uma
 * extensão que sabe importar, ligada ao Lattes do mesmo currículo.
 */
export function canImportByConnector(link: Link, enabled = IMPORT_ENABLED): boolean {
  return enabled && link.state.kind === 'lido' && Boolean(link.features?.includes('importar'));
}
