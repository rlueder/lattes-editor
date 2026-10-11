// Estado da fila da ponte, guardado na sessão da extensão (some ao fechar o
// navegador) e lido pelo painel.

import type { OpResult } from '../../src/bridge/apply.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';

export interface QueueState {
  editorTabId?: number;
  /** Currículo aberto no editor quando a fila foi enviada. */
  lattesId?: string;
  ops: BridgeOp[];
  results: Record<string, OpResult>;
  running: boolean;
}

export const EMPTY: QueueState = { ops: [], results: {}, running: false };

export async function readState(): Promise<QueueState> {
  const { fila } = await chrome.storage.session.get('fila');
  return (fila as QueueState | undefined) ?? EMPTY;
}

export async function writeState(next: QueueState): Promise<void> {
  await chrome.storage.session.set({ fila: next });
}

/** Comandos do painel para o service worker. */
export type PanelCommand =
  { cmd: 'aplicar'; keys?: string[] } | { cmd: 'limpar' } | { cmd: 'parar' };

/** Menu do currículo no Lattes: é nessa aba que as requisições rodam. */
export const LATTES_MENU = 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu*';
