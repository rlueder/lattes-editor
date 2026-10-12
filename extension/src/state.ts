// Estado da fila da ponte, guardado na sessão da extensão (some ao fechar o
// navegador) e lido pelo painel.

import type { OpResult } from '../../src/bridge/apply.ts';
import type { ContractReport } from '../../src/bridge/contract.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';

/** Onde está o editor que mandou a fila: o app de desktop ou uma aba (desenvolvimento). */
export type EditorEndpoint = 'app' | number;

export interface QueueState {
  editor?: EditorEndpoint;
  /** Currículo aberto no editor quando a fila foi enviada. */
  lattesId?: string;
  ops: BridgeOp[];
  results: Record<string, OpResult>;
  running: boolean;
  /** Última verificação do Lattes contra o contrato da ponte (src/bridge/contract.ts). */
  verificacao?: ContractReport;
  verificando?: boolean;
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
  { cmd: 'aplicar'; keys?: string[] } | { cmd: 'limpar' } | { cmd: 'parar' } | { cmd: 'verificar' };

/** Menu do currículo no Lattes: é nessa aba que as requisições rodam. */
export const LATTES_MENU = 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu*';
