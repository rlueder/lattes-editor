// Mensagens entre o editor (página) e a extensão da ponte, por
// window.postMessage na própria página do editor. Versionadas: um lado que
// não conhece a versão do outro ignora a mensagem.

import type { OpResult } from './apply.ts';
import type { BridgeOp } from './plan.ts';

export const PROTOCOL_VERSION = 1;
export const EDITOR_SOURCE = 'lattes-editor';
export const BRIDGE_SOURCE = 'lattes-ponte';

export type EditorMessage =
  { ops: BridgeOp[]; type: 'enviar' } | { type: 'ola' } | { type: 'parar' };

export type BridgeMessage =
  | { code: string; type: 'codigo-cv' }
  | { result: OpResult; type: 'resultado' }
  | { type: 'fim' }
  | { type: 'ola'; version: string };

type Envelope<T> = T & { source: string; v: number };

function hasEnvelope(data: unknown, source: string): data is Envelope<{ type: string }> {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.source === source && d.v === PROTOCOL_VERSION && typeof d.type === 'string';
}

export function isEditorMessage(data: unknown): data is Envelope<EditorMessage> {
  return hasEnvelope(data, EDITOR_SOURCE);
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
