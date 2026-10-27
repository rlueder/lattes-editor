// O pedido do editor para o Importar pelo conector (LAT-50): o arquivo mínimo
// (opção 1 do guia, 3.3), os módulos a marcar no passo 2 e o ano do item novo
// mais antigo. Nada sai com IMPORT_ENABLED desligado.

import { toBase64 } from '../bridge/export.ts';
import {
  IMPORT_ENABLED,
  type ImportResult,
  importStopMessage,
  STEP2_MODULE_VALUES,
} from '../bridge/importar.ts';
import type { Link } from '../bridge/link.ts';
import type { EditorMessage } from '../bridge/protocol.ts';
import type { Loaded } from '../model/production.ts';
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
  loadedMax: Loaded,
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

/** Quanto esperar a resposta da extensão antes de liberar o botão de novo. */
export const IMPORT_REPLY_TIMEOUT_MS = 120_000;

/** Um clique no botão: o id do pedido, ou undefined quando nada foi pedido. */
export interface ImportAttempt {
  at: number;
  id?: string;
}

export type ImportStatus =
  | { busy: false; text?: string }
  /** Esperando a extensão: o botão fica desabilitado. */
  | { busy: true; text: string };

/**
 * O que o botão do Importar mostra depois de um clique: nada pedido, a
 * espera, a resposta da extensão ou, passado o prazo sem resposta, o botão
 * de volta com o aviso.
 */
export function importStatus(
  attempt: ImportAttempt | undefined,
  result: (Pick<ImportResult, 'detail' | 'reason'> & { id: string }) | undefined,
  now: number,
): ImportStatus {
  if (!attempt) return { busy: false };
  if (!attempt.id) return { busy: false, text: 'Não há item novo pronto para importar.' };
  if (result?.id === attempt.id) return { busy: false, text: importStopMessage(result) };
  if (now - attempt.at < IMPORT_REPLY_TIMEOUT_MS) {
    return { busy: true, text: 'Enviando ao Importar do Lattes…' };
  }
  return {
    busy: false,
    text: 'A extensão não respondeu. Confira o Importar no Lattes: se o arquivo chegou, a solicitação ficou pendente por lá.',
  };
}
