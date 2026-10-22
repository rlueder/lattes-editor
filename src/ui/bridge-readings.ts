// As leituras das respostas da extensão que o useBridge guarda (use-bridge.ts):
// o ZIP do Exportar, a troca da foto, o Importar e a versão atual do Lattes.

import type { EspelhoItem } from '../bridge/espelho.ts';
import type { ExportFailure } from '../bridge/export.ts';
import type { ImportStop, PageShape } from '../bridge/importar.ts';
import type { PhotoFailure } from '../bridge/photo.ts';
import type { ListSnapshot } from '../census/test-ledger.ts';

export interface CurriculoReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  detail?: string;
  fileName?: string;
  /** O id do pedido que a resposta atende. */
  id?: string;
  /** De qual currículo é a sessão do Lattes que respondeu. */
  lattesId?: string;
  reason?: ExportFailure;
  /** O ZIP em base64. */
  zip?: string;
}

export interface PhotoUploadReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  detail?: string;
  /** O id do pedido que a resposta atende. */
  id: string;
  ok: boolean;
  reason?: PhotoFailure;
}

export interface ImportReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  detail?: string;
  /** O id do pedido que a resposta atende. */
  id: string;
  page?: PageShape;
  reason: ImportStop;
  request?: string;
}

export interface EspelhoReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  error?: string;
  items?: EspelhoItem[];
  /**
   * Todas as listas do currículo no Lattes (src/bridge/cv-lists.ts), para a
   * comparação de todas as seções; ausentes numa extensão mais antiga.
   */
  lists?: ListSnapshot;
}
