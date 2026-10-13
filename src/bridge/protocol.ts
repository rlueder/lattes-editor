// Mensagens entre o editor (página) e a extensão da ponte, por
// window.postMessage na própria página do editor. Versionadas: um lado que
// não conhece a versão do outro ignora a mensagem.

import type { OpResult } from './apply.ts';
import type { EspelhoItem } from './espelho.ts';
import type { ExportFailure } from './export.ts';
import type { LattesStatus } from './lattes-status.ts';
import type { BridgeOp } from './plan.ts';

export const PROTOCOL_VERSION = 1;
export const EDITOR_SOURCE = 'lattes-editor';
export const BRIDGE_SOURCE = 'lattes-ponte';

export type EditorMessage =
  /** lattesId: o currículo aberto no editor; a ponte só grava se a sessão do Lattes for dele. */
  | { lattesId?: string; ops: BridgeOp[]; type: 'enviar' }
  /** version e features: do app (src/bridge/compat.ts); versões antigas mandam só o tipo. */
  | { features?: string[]; type: 'ola'; version?: string }
  | { type: 'parar' }
  /** Pede o ZIP do Exportar do currículo da sessão (Abrir do Lattes). */
  | { type: 'pedir-curriculo' }
  /** Pede a versão atual do Lattes (página de conferência), só leitura. */
  | { type: 'pedir-espelho' };

export type BridgeMessage =
  /** lattesId: de qual currículo é o código, para o editor não guardar o de outro. */
  | { code: string; lattesId?: string; type: 'codigo-cv' }
  /** O que o menu do Lattes mostra: data da última publicação e pendência. */
  | { lattesId?: string; status: LattesStatus; type: 'estado-lattes' }
  | { result: OpResult; type: 'resultado' }
  /**
   * Os itens da página de conferência do Lattes, ou o motivo de não ter
   * lido; lattesId diz de qual currículo é a sessão.
   */
  | { error?: string; items?: EspelhoItem[]; lattesId?: string; type: 'espelho' }
  /**
   * O ZIP do Exportar em base64, ou o motivo de não ter vindo; lattesId diz
   * de qual currículo é a sessão.
   */
  | {
      detail?: string;
      fileName?: string;
      lattesId?: string;
      reason?: ExportFailure;
      type: 'curriculo';
      zip?: string;
    }
  | { type: 'fim' }
  /** features: o que esta extensão sabe fazer (src/bridge/compat.ts); ausente nas versões de antes do aperto de mão com capacidades. */
  | { features?: string[]; type: 'ola'; version: string }
  /** A extensão tentou ler o menu do Lattes e não conseguiu; reason diz por quê. */
  | { lattesId?: string; reason: NoReadingReason; type: 'sem-leitura' };

/**
 * Por que não há leitura do Lattes: sem o "ok" do aviso da extensão, sem aba
 * do Lattes aberta, aba fora do menu (ou sessão caída) e falha ao ler a aba.
 */
export type NoReadingReason = 'consentimento' | 'erro' | 'sem-aba' | 'sem-data';

type Envelope<T> = T & { source: string; v: number };

function hasEnvelope(data: unknown, source: string): data is Envelope<{ type: string }> {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.source === source && d.v === PROTOCOL_VERSION && typeof d.type === 'string';
}

export function isEditorMessage(data: unknown): data is Envelope<EditorMessage> {
  return hasEnvelope(data, EDITOR_SOURCE);
}

/**
 * O aperto de mão de uma extensão com outra versão do protocolo: o resto das
 * mensagens dela é ignorado, mas o editor consegue dizer por quê.
 */
export function isIncompatibleHello(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.source === BRIDGE_SOURCE && d.type === 'ola' && d.v !== PROTOCOL_VERSION;
}

export function isBridgeMessage(data: unknown): data is Envelope<BridgeMessage> {
  return hasEnvelope(data, BRIDGE_SOURCE);
}

export function editorMessage(msg: EditorMessage): Envelope<EditorMessage> {
  return { ...msg, source: EDITOR_SOURCE, v: PROTOCOL_VERSION };
}

export function bridgeMessage(msg: BridgeMessage): Envelope<BridgeMessage> {
  return { ...msg, source: BRIDGE_SOURCE, v: PROTOCOL_VERSION };
}

/**
 * Mensagem da própria página: mesma janela e mesma origem. Outra aba, iframe
 * ou site não conversa com a ponte.
 */
export function fromSamePage(
  event: { origin: string; source: unknown },
  page: { origin: string; window: unknown },
): boolean {
  return event.source === page.window && event.origin === page.origin;
}
