// As regras dos passos da janela "Enviar ao Lattes" (SendSteps.tsx): em que
// passo a pessoa está e o andamento de cada alteração da rodada.

import type { OpResult } from '../bridge/apply.ts';
import type { BridgeOp } from '../bridge/plan.ts';

export type StepState = 'atual' | 'depois' | 'feito';

export interface StepInput {
  /** Publicado no CNPq por esta janela, e nada novo desde então. */
  published?: boolean;
  /** O Lattes tem o que publicar (gravações do editor ou de fora). */
  toPublish: boolean;
  /** Alterações que a extensão leva e ainda não foram gravadas. */
  toWrite: number;
  /** Uma rodada em andamento: gravando, em pausa, ou a cópia de antes. */
  writing: boolean;
}

/** O estado de cada um dos três passos. */
export function stepStates({ published, toPublish, toWrite, writing }: StepInput): StepState[] {
  if (writing) return ['feito', 'atual', 'depois'];
  if (toWrite > 0) return ['atual', 'depois', 'depois'];
  if (toPublish) return ['feito', 'feito', 'atual'];
  if (published) return ['feito', 'feito', 'feito'];
  return ['atual', 'depois', 'depois'];
}

/**
 * O passo à vista: o atual; com os três feitos (acabou de publicar), o último,
 * para a confirmação ficar na tela em vez de a janela voltar ao início.
 */
export function currentStep(steps: StepState[]): number {
  if (steps.every((s) => s === 'feito')) return steps.length - 1;
  return Math.max(0, steps.indexOf('atual'));
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
      detail: r && (r.status !== 'conferido' || r.partial) ? r.detail : undefined,
      key: op.key,
      label: op.label,
      state,
      text: r?.partial ? 'gravada; confira uma parte' : TEXT[state],
    };
  });
}

/** A hora de um envio, como 21:55. */
export const timeLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Por que o passo ③ ainda não abre: publicar no meio da gravação, ou com
 * alteração ainda por gravar, deixaria de fora o que falta.
 */
export function publishLock(
  writing: boolean,
  toWrite: number,
  toPublish: boolean,
): string | undefined {
  if (writing) return 'Fica disponível quando a gravação terminar.';
  if (toWrite > 0) return 'Grave antes as alterações do passo 1, ou descarte as que não vão agora.';
  return toPublish ? undefined : 'Nada gravado no Lattes esperando publicação.';
}
