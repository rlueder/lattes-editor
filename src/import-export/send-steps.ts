// As regras dos passos da janela "Enviar ao Lattes" (SendSteps.tsx): em que
// passo a pessoa está e o andamento de cada alteração da rodada.

import type { OpResult } from '../bridge/apply.ts';
import type { BridgeOp } from '../bridge/plan.ts';

export type StepState = 'atual' | 'depois' | 'feito';

export interface StepInput {
  /** O Lattes tem o que publicar (gravações do editor ou de fora). */
  toPublish: boolean;
  /** Alterações que a extensão leva e ainda não foram gravadas. */
  toWrite: number;
  /** Uma rodada em andamento: gravando, em pausa, ou a cópia de antes. */
  writing: boolean;
}

/** O estado de cada um dos três passos. */
export function stepStates({ toPublish, toWrite, writing }: StepInput): StepState[] {
  if (writing) return ['feito', 'atual', 'depois'];
  if (toWrite > 0) return ['atual', 'depois', 'depois'];
  if (toPublish) return ['feito', 'feito', 'atual'];
  return ['atual', 'depois', 'depois'];
}

export type RowState = OpResult['status'] | 'fila' | 'gravando' | 'parada';

export interface WriteRow {
  detail?: string;
  key: string;
  label: string;
  state: RowState;
  text: string;
}

const TEXT: Record<RowState, string> = {
  conferido: 'gravada e conferida',
  divergente: 'confira no Lattes',
  erro: 'não gravada',
  fila: 'na fila',
  gravando: 'gravando…',
  parada: 'não enviada',
  sessao: 'a sessão do Lattes caiu',
};

/**
 * Uma linha por alteração da rodada. Com a rodada correndo, a primeira sem
 * resultado está sendo gravada e as outras esperam; parada (pausa, problema),
 * as que ficaram sem resultado não foram enviadas; na pausa, esperam o
 * "Continuar".
 */
export function writeRows(
  round: readonly BridgeOp[],
  results: Record<string, OpResult>,
  running: boolean,
  paused = false,
): WriteRow[] {
  let current = running;
  return round.map((op) => {
    const r = results[op.key];
    let state: RowState;
    if (r) state = r.status;
    else if (current) {
      state = 'gravando';
      current = false;
    } else state = running || paused ? 'fila' : 'parada';
    return {
      detail: r && r.status !== 'conferido' ? r.detail : undefined,
      key: op.key,
      label: op.label,
      state,
      text: TEXT[state],
    };
  });
}
