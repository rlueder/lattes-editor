// Estado da fila do conector, guardado na sessão da extensão (some ao fechar o
// navegador) e lido pelo painel.

import type { OpResult } from '../../src/bridge/apply.ts';
import type { ContractReport } from '../../src/bridge/contract.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import type { RoundPause } from '../../src/bridge/write-brake.ts';

/** Onde está o editor que mandou a fila: o app de desktop ou uma aba (desenvolvimento). */
export type EditorEndpoint = 'app' | number;

export interface QueueState {
  editor?: EditorEndpoint;
  /** Currículo aberto no editor quando a fila foi enviada. */
  lattesId?: string;
  ops: BridgeOp[];
  /** A última rodada parou no teto de gravações (src/bridge/write-brake.ts). */
  pausa?: RoundPause;
  results: Record<string, OpResult>;
  running: boolean;
  /** Última verificação do Lattes contra o contrato do conector (src/bridge/contract.ts). */
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
  | { cmd: 'aplicar'; keys?: string[] }
  | { cmd: 'limpar' }
  | { cmd: 'parar' }
  /** auto: a verificação de fundo, que só roda com o Lattes aberto e de tempos em tempos. */
  | { auto?: boolean; cmd: 'verificar' };

/**
 * O que o editor anunciou no aperto de mão (versão e capacidades, ver
 * src/bridge/compat.ts), na sessão da extensão, para o painel comparar.
 */
export const APP_KEY = 'app';

export interface AppHello {
  features?: string[];
  version?: string;
}
